"""
AJ AI — Flask Chatbot with Full NLP Pipeline
=============================================
Pipeline:
  1. Text Preprocessing   — clean & normalize raw input
  2. Tokenization         — split into meaningful tokens
  3. Intent Detection     — classify user intent category
  4. Semantic Matching    — TF-IDF + Cosine Similarity over KB
  5. Knowledge Base       — JSON file + SQLite history store
  6. Confidence Score     — weighted multi-signal scoring
  7. Fallback Handling    — tiered responses when KB misses
"""

from __future__ import annotations

import base64
import io
import json
import logging
import math
import os
import re
import secrets
import sqlite3
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime
from functools import wraps
from typing import Any

from flask import (
    Flask, jsonify, make_response, redirect,
    render_template, request, session,
)
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

# Optional: Pillow for image handling
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# Optional: PyPDF2 for PDF text extraction
try:
    import PyPDF2
    PYPDF2_AVAILABLE = True
except ImportError:
    PYPDF2_AVAILABLE = False

# Optional: Windows Native OCR (winsdk)
WINSDK_OCR_AVAILABLE = False
try:
    from winsdk.windows.media.ocr import OcrEngine
    from winsdk.windows.graphics.imaging import BitmapDecoder
    from winsdk.windows.storage.streams import InMemoryRandomAccessStream, DataWriter
    WINSDK_OCR_AVAILABLE = True
except Exception:
    WINSDK_OCR_AVAILABLE = False

# Optional: Google Generative AI for Vision & Reasoning
GEMINI_AVAILABLE = False
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except Exception:
    GEMINI_AVAILABLE = False

# ══════════════════════════════════════════════════════════════════════════════
#  LOGGING
# ══════════════════════════════════════════════════════════════════════════════
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("aj_ai")

# ══════════════════════════════════════════════════════════════════════════════
#  APP & CONFIG
# ══════════════════════════════════════════════════════════════════════════════
app = Flask(__name__)
app.secret_key = os.environ.get("AJ_AI_SECRET_KEY", "aj-ai-secret-key-production-ready")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    MAX_CONTENT_LENGTH=16 * 1024 * 1024,  # 16 MB upload limit (for images/PDFs)
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "qa.db")
QA_FILE  = os.path.join(BASE_DIR, "qa_data.json")
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ── In-memory file context store (session_id → extracted text) ───────────────
_context_store: dict[str, str] = {}

# ── Admin file context store (session_id → rich file info dict) ──────────────
_admin_file_store: dict[str, dict] = {}

# ── Allowed upload extensions ─────────────────────────────────────────────────
ALLOWED_EXTENSIONS = {
    "txt", "md", "py", "js", "html", "css", "c", "cpp", "java",
    "pdf", "docx", "doc", "rtf", "json", "csv", "xml", "yaml", "yml", "sql", "sh", "bat", "log",
    "png", "jpg", "jpeg", "gif", "bmp", "webp",
}

def _allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _get_session_id() -> str:
    """Get or create a unique session ID for file context."""
    if "uid" not in session:
        session["uid"] = secrets.token_hex(16)
    return session["uid"]


def extract_text_from_image_bytes(image_bytes: bytes) -> tuple[str, bool]:
    """
    Extract readable text from image bytes using Windows Native OCR (winsdk).
    Runs 100% locally and offline on Windows 10/11.
    Returns (extracted_text, success_boolean).
    """
    if not WINSDK_OCR_AVAILABLE:
        return ("", False)
    try:
        import asyncio

        async def _run():
            engine = OcrEngine.try_create_from_user_profile_languages()
            if not engine:
                return ""
            writer = DataWriter()
            writer.write_bytes(image_bytes)
            stream = InMemoryRandomAccessStream()
            await stream.write_async(writer.detach_buffer())
            stream.seek(0)
            decoder = await BitmapDecoder.create_async(stream)
            software_bitmap = await decoder.get_software_bitmap_async()
            result = await engine.recognize_async(software_bitmap)
            lines = [line.text for line in result.lines]
            return "\n".join(lines) if lines else (result.text or "")

        text = asyncio.run(_run())
        return (text.strip(), bool(text.strip()))
    except Exception as exc:
        log.warning("OCR extraction error: %s", exc)
        return ("", False)


def ask_gemini_vision(api_key: str, image_bytes: bytes, mime_type: str, prompt: str) -> str:
    """
    Ask Gemini 1.5 Flash multimodal vision model about an image/screenshot.
    """
    if not GEMINI_AVAILABLE or not api_key:
        raise RuntimeError("Gemini is not configured or available")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")

    system_instruction = (
        "You are AJ AI, an intelligent multilingual coding and technical assistant. "
        "The user uploaded a screenshot/image and asked a question about it. "
        "Analyze everything visible in the image (code, errors, UI, tables, text, diagrams) "
        "and answer the user's question clearly, helpfully, and accurately in Hindi, Hinglish, or English. "
        "If there are errors, explain the root cause and provide clear code fixes."
    )

    parts = [
        {"mime_type": mime_type or "image/png", "data": image_bytes},
        f"{system_instruction}\n\nUser Question: {prompt}"
    ]
    resp = model.generate_content(parts)
    return resp.text.strip() if resp and resp.text else "No response generated by Gemini."


def ask_gemini_document(api_key: str, doc_text: str, filename: str, prompt: str) -> str:
    """
    Ask Gemini 1.5 Flash about an uploaded document/file text.
    """
    if not GEMINI_AVAILABLE or not api_key:
        raise RuntimeError("Gemini is not configured or available")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")

    full_prompt = (
        f"You are AJ AI, an intelligent multilingual assistant. The user uploaded '{filename}' "
        f"with the following content:\n\n"
        f"--- START FILE CONTENT ---\n{doc_text[:35000]}\n--- END FILE CONTENT ---\n\n"
        f"User Question: {prompt}\n\n"
        f"Answer clearly and accurately in Hindi, Hinglish, or English."
    )
    resp = model.generate_content(full_prompt)
    return resp.text.strip() if resp and resp.text else "No response generated by Gemini."


def extract_text_from_docx_bytes(file_bytes: bytes) -> str:
    """Extract all text paragraphs from a DOCX file using built-in zipfile and XML."""
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as docx:
            xml_content = docx.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            paragraphs = []
            for p in tree.iterfind(".//w:p", ns):
                texts = [node.text for node in p.iterfind(".//w:t", ns) if node.text]
                if texts:
                    paragraphs.append("".join(texts))
            return "\n\n".join(paragraphs)
    except Exception as exc:
        log.warning("extract_text_from_docx_bytes error: %s", exc)
        return f"[DOCX read error: {exc}]"


def _extract_text_from_file(file_obj, filename: str) -> tuple[str, str]:
    """
    Extract readable text from uploaded file.
    Supports PDF, DOCX, TXT, MD, CSV, JSON, code files, and images.
    Returns (extracted_text, file_type_label).
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    raw = file_obj.read() if hasattr(file_obj, "read") else file_obj
    if not isinstance(raw, bytes):
        raw = str(raw).encode("utf-8")

    # ── Plain text / code files ──────────────────────────────────────────────
    text_exts = {"txt", "md", "py", "js", "html", "css", "c", "cpp",
                 "java", "json", "csv", "xml", "yaml", "yml", "sql", "sh", "bat", "rtf", "log"}
    if ext in text_exts:
        try:
            content = raw.decode("utf-8", errors="replace")
            label = "code" if ext in {"py", "js", "html", "css", "c", "cpp", "java", "sql", "sh"} else "text"
            return content[:100000], label
        except Exception as e:
            return f"[Read error: {e}]", "text"

    # ── DOCX files ────────────────────────────────────────────────────────────
    if ext in {"docx", "doc"}:
        text = extract_text_from_docx_bytes(raw)
        return (text[:100000] if text.strip() else "[DOCX file is empty]"), "docx"

    # ── PDF files ─────────────────────────────────────────────────────────────
    if ext == "pdf":
        if not PYPDF2_AVAILABLE:
            return "[PDF support not installed. Please install PyPDF2.]", "pdf"
        try:
            reader = PyPDF2.PdfReader(io.BytesIO(raw))
            pages_text = []
            for i, page in enumerate(reader.pages):
                if i >= 60:
                    pages_text.append(f"\n[...{len(reader.pages)-60} more pages truncated]")
                    break
                t = page.extract_text() or ""
                if t.strip():
                    pages_text.append(f"--- Page {i+1} ---\n{t.strip()}")
            extracted = "\n\n".join(pages_text)[:100000]
            return extracted if extracted.strip() else "[PDF has no readable text (may be scanned image)]", "pdf"
        except Exception as e:
            return f"[PDF read error: {e}]", "pdf"

    # ── Images / Screenshots ──────────────────────────────────────────────────
    if ext in {"png", "jpg", "jpeg", "gif", "bmp", "webp"}:
        if not PIL_AVAILABLE:
            return "[Image support not installed. Please install Pillow.]", "image"
        try:
            img = Image.open(io.BytesIO(raw))
            w, h = img.size
            ocr_text, ocr_ok = extract_text_from_image_bytes(raw)
            if ocr_ok and ocr_text:
                return (
                    f"[Screenshot/Image: {filename} ({w}×{h} px)]\n\n"
                    f"--- Extracted Text via Windows OCR ---\n"
                    f"{ocr_text}"
                ), "image"
            else:
                return (
                    f"[Screenshot/Image: {filename} ({w}×{h} px)]\n"
                    f"Dimensions: {w}×{h} pixels | Color mode: {img.mode}\n\n"
                    f"No text detected automatically by OCR."
                ), "image"
        except Exception as e:
            return f"[Image read error: {e}]", "image"

    return f"[Unsupported file type: .{ext}]", "unknown"


# ══════════════════════════════════════════════════════════════════════════════
#  DATABASE — with auto-migration for old schemas
# ══════════════════════════════════════════════════════════════════════════════
def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def _column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    cols = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(c["name"] == column for c in cols)


def init_database() -> None:
    """Create tables if missing; migrate old schemas; seed default admin."""
    conn = get_db()
    try:
        # ── History table ────────────────────────────────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS history (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_question TEXT    NOT NULL,
                bot_answer    TEXT    NOT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Migrate: add intent + confidence columns if they don't exist yet
        if not _column_exists(conn, "history", "intent"):
            conn.execute("ALTER TABLE history ADD COLUMN intent TEXT DEFAULT 'unknown'")
            log.info("Migrated: added 'intent' column to history.")
        if not _column_exists(conn, "history", "confidence"):
            conn.execute("ALTER TABLE history ADD COLUMN confidence REAL DEFAULT 0.0")
            log.info("Migrated: added 'confidence' column to history.")

        # ── Admins table ─────────────────────────────────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS admins (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        """)

        # ── Settings table ───────────────────────────────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT
            )
        """)

        # ── Documents table (Permanent AI Knowledge Base) ────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                filename      TEXT NOT NULL,
                file_type     TEXT NOT NULL,
                file_size     INTEGER DEFAULT 0,
                char_count    INTEGER DEFAULT 0,
                summary       TEXT DEFAULT '',
                content       TEXT NOT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── Document Chunks table ────────────────────────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS document_chunks (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id        INTEGER NOT NULL,
                chunk_index   INTEGER NOT NULL,
                chunk_text    TEXT NOT NULL,
                FOREIGN KEY(doc_id) REFERENCES documents(id) ON DELETE CASCADE
            )
        """)

        # Seed / migrate default admin
        row = conn.execute(
            "SELECT id, password FROM admins WHERE username = ?", ("admin",)
        ).fetchone()

        if not row:
            # Fresh install — create with hashed password
            conn.execute(
                "INSERT INTO admins (username, password) VALUES (?, ?)",
                ("admin", generate_password_hash("admin123")),
            )
            log.info("Default admin created (admin / admin123).")
        else:
            # Migrate plain-text password → hashed (detect by missing 'pbkdf2:' prefix)
            stored_pw = row["password"]
            if not stored_pw.startswith(("pbkdf2:", "scrypt:", "argon2:")):
                hashed = generate_password_hash(stored_pw)
                conn.execute(
                    "UPDATE admins SET password = ? WHERE id = ?",
                    (hashed, row["id"]),
                )
                log.info("Migrated: admin password hashed.")

        conn.commit()
    except Exception as exc:
        conn.rollback()
        log.error("init_database: %s", exc)
    finally:
        conn.close()

    log.info("Database ready.")


def get_setting(key: str, default: str = "") -> str:
    """Read a setting from the settings table."""
    try:
        conn = get_db()
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        conn.close()
        return row["value"] if row and row["value"] is not None else default
    except Exception:
        return default


def set_setting(key: str, value: str) -> None:
    """Store or update a setting in the settings table."""
    try:
        conn = get_db()
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
        conn.commit()
        conn.close()
    except Exception as exc:
        log.error("set_setting: %s", exc)


def save_history(question: str, answer: str, intent: str, confidence: float) -> None:
    try:
        conn = get_db()
        conn.execute(
            "INSERT INTO history (user_question, bot_answer, intent, confidence) VALUES (?, ?, ?, ?)",
            (question, answer, intent, round(confidence, 4)),
        )
        conn.commit()
        conn.close()
    except Exception as exc:
        log.error("save_history: %s", exc)


# ══════════════════════════════════════════════════════════════════════════════
#  KNOWLEDGE BASE
# ══════════════════════════════════════════════════════════════════════════════
def load_questions() -> list[dict]:
    if not os.path.exists(QA_FILE):
        log.warning("qa_data.json not found.")
        return []
    try:
        with open(QA_FILE, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError) as exc:
        log.error("load_questions: %s", exc)
        return []


def save_questions(questions: list[dict]) -> bool:
    try:
        with open(QA_FILE, "w", encoding="utf-8") as fh:
            json.dump(questions, fh, ensure_ascii=False, indent=2)
        _tfidf_cache.clear()   # invalidate TF-IDF cache on KB change
        return True
    except OSError as exc:
        log.error("save_questions: %s", exc)
        return False


# ══════════════════════════════════════════════════════════════════════════════
#  PIPELINE — STEP 1 · TEXT PREPROCESSING
# ══════════════════════════════════════════════════════════════════════════════
_ABBR: dict[str, str] = {
    r"\bk\b":   "ke",   r"\bh\b":   "hai",  r"\bm\b":   "mein",
    r"\bu\b":   "you",  r"\br\b":   "are",  r"\bw/o\b": "without",
    r"\bw/\b":  "with", r"&":       "and",  r"@":       "at",
}

def preprocess(text: str) -> str:
    """
    Step 1 — Preprocess raw user input:
      • Unicode NFKC normalization
      • Lowercase + abbreviation expansion
      • Remove special chars (keep letters, digits, spaces)
      • Collapse whitespace
    """
    text = unicodedata.normalize("NFKC", str(text)).lower().strip()
    for pattern, replacement in _ABBR.items():
        text = re.sub(pattern, replacement, text)
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ══════════════════════════════════════════════════════════════════════════════
#  PIPELINE — STEP 2 · TOKENIZATION
# ══════════════════════════════════════════════════════════════════════════════
STOPWORDS: frozenset[str] = frozenset({
    # English
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "of", "in", "at", "by",
    "for", "with", "about", "to", "from", "on", "as", "into", "through",
    "and", "or", "but", "if", "then", "what", "which", "who", "how",
    "when", "where", "why", "that", "this", "these", "those", "it", "its",
    "you", "your", "we", "me", "my", "i", "tell", "explain", "show",
    "give", "please", "define", "meaning", "detail", "details",
    # Hindi / Haryanvi
    "kya", "hai", "hain", "tha", "the", "hoga", "hogi", "ke", "ki", "ka",
    "ko", "se", "mein", "par", "pe", "aur", "ya", "lekin", "agar", "toh",
    "bhi", "hi", "jo", "jab", "kab", "kahan", "kaise", "kyun", "kyu",
    "bata", "batao", "bataiye", "samjhao", "ladle", "bhai", "bhaiya",
    "bhiya", "yaar", "keval", "sirf", "bas", "thoda", "bahut", "zyada",
    "haan", "nahi", "na", "mat", "h", "k", "re", "yo", "ok", "ab",
})


def tokenize(preprocessed: str) -> list[str]:
    """
    Step 2 — Tokenize preprocessed text:
      • Split on whitespace, remove stopwords, keep tokens length > 1
      • Return unique tokens preserving order
    """
    seen: set[str] = set()
    tokens: list[str] = []
    for word in preprocessed.split():
        if word not in STOPWORDS and len(word) > 1 and word not in seen:
            tokens.append(word)
            seen.add(word)
    return tokens


# ══════════════════════════════════════════════════════════════════════════════
#  PIPELINE — STEP 3 · INTENT DETECTION
# ══════════════════════════════════════════════════════════════════════════════
_INTENT_PATTERNS: list[tuple[str, list[str]]] = [
    ("greeting",   [r"\b(hi|hello|hey|namaste|namaskar|ram ram|jai shree ram|salaam)\b",
                    r"\b(good morning|good evening|subah|shubh)\b"]),
    ("farewell",   [r"\b(bye|goodbye|alvida|phir milenge)\b"]),
    ("gratitude",  [r"\b(thanks|thank you|shukriya|dhanyawad|meherbani)\b"]),
    ("identity",   [r"\b(kaun|who are you|tera naam|your name|tu kaun|tum kya)\b"]),
    ("capability", [r"\b(kya kar sakte|what can you|kya jaanta|abilities|features)\b"]),
    ("wellbeing",  [r"\b(haal|hal|how are you|kaise ho|ke haal|theek|badiya)\b"]),
    ("definition", [r"\b(kya hota|what is|define|definition|matlab|meaning|arth)\b"]),
    ("howto",      [r"\b(kaise|how to|how do|how can|kaise kare|steps|tarika)\b"]),
    ("difference", [r"\b(difference|fark|antar|versus|vs|compare)\b"]),
    ("example",    [r"\b(example|udaharan|misal|for example|jaise)\b"]),
    ("list",       [r"\b(list|naam batao|types|prakar|kitne|saare|sabhi)\b"]),
    ("general",    []),
]

def detect_intent(preprocessed: str) -> str:
    """Step 3 — Detect the intent of the user's message."""
    for intent_label, patterns in _INTENT_PATTERNS:
        for pat in patterns:
            if re.search(pat, preprocessed, re.IGNORECASE):
                return intent_label
    return "general"


# ══════════════════════════════════════════════════════════════════════════════
#  CONVERSATIONAL KB  (greetings / small-talk)
# ══════════════════════════════════════════════════════════════════════════════
_CONV_MAP: dict[str, str] = {
    "ram ram":            "Ram Ram bhai ladle! \U0001f64f Bol ke haal chaal se? AJ AI tera poora sath dega!",
    "ram ram bhai":       "Ram Ram mere bhai! \U0001f64f Kaho ladle, aaj ke seekhna ya poochna chaho se?",
    "ram ram ji":         "Ram Ram ji! \U0001f64f AJ AI haazir se, btao ke sewa karein thari?",
    "jai shree ram":      "Jai Shree Ram mere bhai! \U0001f64f Bol ladle ke hal chal se?",
    "hi":                 "Hello! \U0001f44b I'm **AJ AI**. How can I help you today? (Hindi, Haryanvi, English supported)",
    "hello":              "Hello brother! \U0001f44b Kaho ladle, kya help karu aaj?",
    "hey":                "Hey there! \U0001f60a Ask me anything in Hindi, Haryanvi or English.",
    "namaste":            "Namaste! \U0001f64f Main AJ AI hoon. Aap kya poochna chahte hain?",
    "how are you":        "I am doing fantastic! \U0001f60a How can I assist you today?",
    "tu kaun se":         "Main **AJ AI** su mere ladle bhai! Haryana ka desi aur smart AI dost!",
    "who are you":        "I am **AJ AI**, your AI assistant for programming, tech, and general knowledge!",
    "tera naam kya hai":  "Mera naam **AJ AI** hai! Aapka smart AI assistant. \U0001f4aa",
    "tera naam ke se":    "Mera naam **AJ AI** se ladle! \U0001f4aa",
    "what can you do":    "I can help with Coding (Python, HTML, CSS, JS, C++), CS, AI, Databases, and Q&A in English, Hindi, or Haryanvi!",
    "aap kya kar sakte ho": "Main Programming, Tech concepts, General Knowledge aur Computer basics ke sabhi sawalo ke answer de sakta hoon!",
    "ke haal se":         "Ghanu badiya ladle! \U0001f4aa Tu bata kisa chal rya se sab kime?",
    "ke haal hai":        "Ek dum badiya mere bhai! \U0001f4aa Tu bata kisa chal rya se sab kime?",
    "ke hal h":           "Ghanu top chal rya se ladle! Tu suna kime naya?",
    "k hal h":            "Full badiya bhai! Kaho ke jankari chahiye aaj?",
    "kya haal hai":       "Bilkul badhiya bhai! \U0001f60a Aap bataiye, aaj kya seekhna chahte ho?",
    "theek hai":          "Badhiya bhai! Koi sawal ya tech topic poochna hai?",
    "badiya":             "Full badiya ladle! Kime naya seekhna ho toh bata zaroor.",
    "dhanyawad":          "Arre dhanyawad ki ke baat ladle, apna hi bhai se tu! Kime aur poochna ho toh bol!",
    "shukriya":           "Welcome bhai! Har waqt thari help khatir haazir su.",
    "thank you":          "You're most welcome brother! Always here to assist you! \U0001f60a",
    "thanks":             "Welcome ladle! Anytime help ke liye tayaar hoon. \U0001f44d",
    "bye":                "Goodbye ladle! Apna dhyaan rakhna, phir milenge! \U0001f44b\u2728",
    "goodbye":            "Goodbye! Have a great day ahead! Ram Ram! \u2728",
    "chala ja":           "Arre ladle, itni narazgi kyu? Kime galti hogi toh batao, theek karange!",
    "chup ho ja":         "Theek se ladle, main chup su. Jab zaroorat pade tab aawaz laga diye!",
}

def _conv_lookup(preprocessed: str) -> str | None:
    """Exact or prefix match in conversational map."""
    if preprocessed in _CONV_MAP:
        return _CONV_MAP[preprocessed]
    for key, val in _CONV_MAP.items():
        if preprocessed.startswith(key) or key.startswith(preprocessed):
            return val
    return None


# ══════════════════════════════════════════════════════════════════════════════
#  PIPELINE — STEP 4 · SEMANTIC MATCHING  (TF-IDF + Cosine Similarity)
# ══════════════════════════════════════════════════════════════════════════════
_tfidf_cache: dict[str, Any] = {}


def _build_idf(corpus_tokens: list[list[str]]) -> dict[str, float]:
    N = len(corpus_tokens)
    df: dict[str, int] = defaultdict(int)
    for doc_tokens in corpus_tokens:
        for term in set(doc_tokens):
            df[term] += 1
    return {term: math.log((N + 1) / (count + 1)) + 1.0 for term, count in df.items()}


def _tfidf_vector(tokens: list[str], idf: dict[str, float]) -> dict[str, float]:
    tf: dict[str, float] = defaultdict(float)
    total = len(tokens) or 1
    for t in tokens:
        tf[t] += 1.0 / total
    return {t: tf[t] * idf.get(t, 0.0) for t in tf}


def _cosine(vec_a: dict[str, float], vec_b: dict[str, float]) -> float:
    common = set(vec_a) & set(vec_b)
    if not common:
        return 0.0
    dot    = sum(vec_a[t] * vec_b[t] for t in common)
    norm_a = math.sqrt(sum(v * v for v in vec_a.values()))
    norm_b = math.sqrt(sum(v * v for v in vec_b.values()))
    return 0.0 if (norm_a == 0 or norm_b == 0) else dot / (norm_a * norm_b)


def _ensure_tfidf_cache(questions: list[dict]) -> None:
    if _tfidf_cache.get("questions") is questions:
        return
    corpus_tokens = [tokenize(preprocess(q.get("question", ""))) for q in questions]
    _tfidf_cache.update({
        "questions":      questions,
        "corpus_tokens":  corpus_tokens,
        "idf":            _build_idf(corpus_tokens),
    })


def semantic_match(user_tokens: list[str], questions: list[dict]) -> tuple[str, float, str]:
    """
    Step 4 — Semantic matching using TF-IDF cosine similarity.
    Returns (best_answer, confidence_score, matched_question).
    """
    if not questions:
        return "", 0.0, ""

    _ensure_tfidf_cache(questions)
    idf           = _tfidf_cache["idf"]
    corpus_tokens = _tfidf_cache["corpus_tokens"]
    user_vec      = _tfidf_vector(user_tokens, idf)

    if not user_vec:
        return "", 0.0, ""

    best_score    = 0.0
    best_answer   = ""
    best_question = ""

    for item, doc_tokens in zip(questions, corpus_tokens):
        if not isinstance(item, dict):
            continue
        answer = item.get("answer", "")
        if not answer:
            continue

        doc_vec      = _tfidf_vector(doc_tokens, idf)
        cosine_score = _cosine(user_vec, doc_vec)

        user_set = set(user_tokens)
        doc_set  = set(doc_tokens)
        union    = user_set | doc_set
        jaccard  = len(user_set & doc_set) / len(union) if union else 0.0

        phrase_bonus = 0.15 if (
            " ".join(user_tokens) in " ".join(doc_tokens) or
            " ".join(doc_tokens) in " ".join(user_tokens)
        ) else 0.0

        # Step 6 — Weighted confidence score
        combined = round(min((cosine_score * 0.60) + (jaccard * 0.25) + phrase_bonus, 1.0), 4)

        if combined > best_score:
            best_score    = combined
            best_answer   = answer
            best_question = item.get("question", "")

    return best_answer, best_score, best_question


# ══════════════════════════════════════════════════════════════════════════════
#  PIPELINE — STEP 7 · FALLBACK HANDLING
# ══════════════════════════════════════════════════════════════════════════════
CONFIDENCE_THRESHOLD = 0.22

_FALLBACK_TIERS: list[tuple[float, str]] = [
    (0.20, "Thoda aur detail mein batao ladle \U0001f914 — mujhe lagta hai main kuch aur pooch raha hoon. Ya thode doosre words try karo!"),
    (0.10, "Hmm, is topic pe mujhe seedha jawab nahi mila \U0001f615. Kya aap question ko doosre tareeqe se pooch sakte ho? Ya Admin Panel se add karo!"),
    (0.0,  "Sorry ladle \U0001f615, is sawal ka jawab abhi mere database mein nahi hai.\n\n**Kya try karo:**\n- Question ko simple words mein likho\n- English ya Hindi mein poochho\n- Admin Panel se naya question add karo"),
]

def fallback_response(score: float) -> str:
    for min_score, message in _FALLBACK_TIERS:
        if score >= min_score:
            return message
    return _FALLBACK_TIERS[-1][1]


# ══════════════════════════════════════════════════════════════════════════════
#  DOCUMENT KNOWLEDGE BASE ENGINE (RAG)
# ══════════════════════════════════════════════════════════════════════════════
def create_document_chunks(text: str, chunk_size: int = 800, overlap: int = 150) -> list[str]:
    """Split document text into overlapping semantic chunks for retrieval."""
    if not text or not text.strip():
        return []

    # Split on paragraph breaks or multiple newlines
    paragraphs = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]
    if not paragraphs:
        paragraphs = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
    if not paragraphs:
        paragraphs = [text.strip()]

    chunks: list[str] = []
    current_chunk: list[str] = []
    current_len = 0

    for p in paragraphs:
        p_len = len(p)
        if current_len + p_len > chunk_size and current_chunk:
            combined = "\n\n".join(current_chunk)
            chunks.append(combined)
            overlap_text = combined[-overlap:] if len(combined) > overlap else ""
            current_chunk = [overlap_text, p] if overlap_text else [p]
            current_len = len(overlap_text) + p_len
        else:
            current_chunk.append(p)
            current_len += p_len + 1

    if current_chunk:
        combined = "\n\n".join(current_chunk).strip()
        if combined and (not chunks or combined != chunks[-1]):
            chunks.append(combined)

    return chunks if chunks else [text[:1000]]


def save_document_to_db(filename: str, file_type: str, file_size: int, content: str) -> int:
    """Save an uploaded document and its indexed chunks to SQLite."""
    content = content.strip()
    char_count = len(content)
    summary = content[:220].replace("\n", " ").strip()
    if len(content) > 220:
        summary += "..."

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO documents (filename, file_type, file_size, char_count, summary, content)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (filename, file_type, file_size, char_count, summary, content))
    doc_id = cursor.lastrowid

    chunks = create_document_chunks(content)
    for idx, ch in enumerate(chunks):
        cursor.execute("""
            INSERT INTO document_chunks (doc_id, chunk_index, chunk_text)
            VALUES (?, ?, ?)
        """, (doc_id, idx, ch))

    conn.commit()
    conn.close()
    log.info("Document saved to DB: %s (id=%d, chars=%d, chunks=%d)", filename, doc_id, char_count, len(chunks))
    return doc_id


def delete_document_from_db(doc_id: int) -> bool:
    """Delete a document and all its chunks from the database."""
    try:
        conn = get_db()
        conn.execute("DELETE FROM document_chunks WHERE doc_id = ?", (doc_id,))
        conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.commit()
        conn.close()
        log.info("Document deleted from DB: id=%d", doc_id)
        return True
    except Exception as exc:
        log.error("delete_document_from_db error: %s", exc)
        return False


def get_all_documents() -> list[dict]:
    """Retrieve all documents metadata from SQLite."""
    try:
        conn = get_db()
        rows = conn.execute("""
            SELECT d.id, d.filename, d.file_type, d.file_size, d.char_count, d.summary, d.created_at,
                   COUNT(c.id) AS chunk_count
            FROM documents d
            LEFT JOIN document_chunks c ON d.id = c.doc_id
            GROUP BY d.id
            ORDER BY d.id DESC
        """).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as exc:
        log.error("get_all_documents error: %s", exc)
        return []


def get_document_by_id(doc_id: int) -> dict | None:
    """Get full document content and metadata by ID."""
    try:
        conn = get_db()
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
        conn.close()
        return dict(row) if row else None
    except Exception as exc:
        log.error("get_document_by_id error: %s", exc)
        return None


def answer_from_knowledge_base(question: str) -> dict:
    """
    RAG engine: search uploaded documents, retrieve best chunks,
    and generate accurate answers using Gemini (if configured) or local smart NLP.
    """
    q_raw = question.strip()
    if not q_raw:
        return {"found": False, "answer": "", "confidence": 0.0}

    try:
        conn = get_db()
        docs_count = conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
        if docs_count == 0:
            conn.close()
            return {"found": False, "answer": "", "confidence": 0.0}

        chunks_rows = conn.execute("""
            SELECT c.doc_id, c.chunk_text, d.filename, d.file_type
            FROM document_chunks c
            JOIN documents d ON c.doc_id = d.id
        """).fetchall()
        conn.close()
    except Exception as exc:
        log.error("answer_from_knowledge_base db error: %s", exc)
        return {"found": False, "answer": "", "confidence": 0.0}

    if not chunks_rows:
        return {"found": False, "answer": "", "confidence": 0.0}

    q_clean = preprocess(q_raw)
    q_tokens = set(tokenize(q_clean))
    q_lower = q_raw.lower()
    q_words = [w for w in re.findall(r'\b[a-zA-Z0-9_\u0900-\u097F]+\b', q_lower) if len(w) > 2]
    stop_words = {"kya", "hai", "hain", "ke", "ki", "ka", "ko", "se", "me", "mein", "par",
                  "bata", "batao", "bataiye", "dikhao", "what", "is", "the", "in", "of", "and",
                  "to", "a", "an", "kon", "kaise", "kab", "kahan", "kyun", "who", "where", "how"}
    meaningful_words = [w for w in q_words if w not in stop_words]

    is_summary = any(w in q_lower for w in {"summary", "summarize", "samjhao", "overview", "brief", "poora", "documents me kya hai", "kya document"})

    scored: list[tuple[float, dict]] = []
    for r in chunks_rows:
        chunk_dict = dict(r)
        ch_text = chunk_dict["chunk_text"]
        ch_lower = ch_text.lower()
        ch_tokens = set(tokenize(preprocess(ch_text)))

        if not ch_tokens:
            continue

        union = ch_tokens | q_tokens
        jaccard = (len(ch_tokens & q_tokens) / len(union)) if union else 0.0

        kw_hits = sum(1 for w in meaningful_words if w in ch_lower)
        kw_bonus = min(kw_hits * 0.15, 0.45)

        phrase_bonus = 0.0
        for i in range(len(meaningful_words) - 1):
            pair = f"{meaningful_words[i]} {meaningful_words[i+1]}"
            if pair in ch_lower:
                phrase_bonus = 0.35
                break

        score = (jaccard * 0.50) + kw_bonus + phrase_bonus
        scored.append((score, chunk_dict))

    scored.sort(key=lambda x: x[0], reverse=True)

    top = [c for sc, c in scored if sc > 0.04][:5]

    if not top and not is_summary:
        return {"found": False, "answer": "", "confidence": 0.0}

    if not top and is_summary:
        top = [c for _, c in scored[:4]]

    context_blocks = []
    source_docs = []
    seen_texts = set()

    for item in top:
        txt = item["chunk_text"].strip()
        if txt not in seen_texts:
            seen_texts.add(txt)
            fname = item["filename"]
            if fname not in source_docs:
                source_docs.append(fname)
            context_blocks.append(f"### [Document: {fname}]\n{txt}")

    combined_context = "\n\n".join(context_blocks)

    # ── Attempt 1: Gemini AI ──────────────────────────────────────────────────
    gemini_key = get_setting("gemini_api_key", os.environ.get("GEMINI_API_KEY", "")).strip()
    if gemini_key and GEMINI_AVAILABLE:
        try:
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = (
                "You are AJ AI, an expert multilingual assistant (fluent in Hindi, Hinglish, Haryanvi, and English).\n"
                "The user has asked a question. Answer it accurately, clearly, and thoroughly based ON THE UPLOADED KNOWLEDGE BASE DOCUMENTS below.\n"
                "Cite the document name where the info was found (e.g. 📄 **Source Document:** <name>).\n"
                "If user asks in Hindi/Hinglish/Haryanvi, answer politely in the same language. Use Markdown formatting.\n\n"
                f"--- KNOWLEDGE BASE CONTEXT ---\n{combined_context[:32000]}\n--- END OF CONTEXT ---\n\n"
                f"User Question: {q_raw}\n\n"
                "Answer:"
            )
            resp = model.generate_content(prompt)
            if resp and resp.text:
                return {
                    "found": True,
                    "answer": resp.text.strip(),
                    "confidence": 0.98,
                    "source_doc": ", ".join(source_docs),
                    "engine": "Google Gemini 1.5 Flash (Document Knowledge Base)",
                }
        except Exception as exc:
            log.warning("Gemini doc qa failed, falling back to local NLP: %s", exc)

    # ── Attempt 2: Smart Local NLP Engine (100% Offline) ─────────────────────
    local_res = _smart_local_qa(
        context=combined_context,
        question=q_raw,
        filename=", ".join(source_docs),
    )
    doc_attribution = f"\n\n---\n📄 **Knowledge Base Source:** `{', '.join(source_docs)}`"
    final_answer = local_res["answer"] + doc_attribution

    return {
        "found": True,
        "answer": final_answer,
        "confidence": local_res.get("confidence", 0.88),
        "source_doc": ", ".join(source_docs),
        "engine": local_res.get("engine", "Local Smart NLP (Document Knowledge Base)"),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN ANSWER ENGINE
# ══════════════════════════════════════════════════════════════════════════════
def find_answer_detailed(raw_question: str) -> dict:
    """Full NLP Pipeline — returns answer, intent, confidence, matched_question."""
    if not str(raw_question).strip():
        return {"answer": "Please enter a question / Koi sawal poocho ladle.",
                "intent": "empty", "confidence": 0.0, "matched_question": ""}

    # Step 1 — Preprocess
    cleaned = preprocess(raw_question)

    # Step 3 — Intent Detection
    intent = detect_intent(cleaned)

    # Conversational shortcut (greetings, identity, etc.)
    if intent in ("greeting", "farewell", "gratitude", "identity", "capability", "wellbeing"):
        conv = _conv_lookup(cleaned)
        if conv:
            return {"answer": conv, "intent": intent, "confidence": 1.0, "matched_question": cleaned, "engine": "Conversational"}

    # Step 2 — Document Knowledge Base Check (AI answers from uploaded documents!)
    doc_res = answer_from_knowledge_base(raw_question)
    if doc_res and doc_res.get("found"):
        return {
            "answer": doc_res["answer"],
            "intent": "doc_kb",
            "confidence": doc_res["confidence"],
            "matched_question": doc_res.get("source_doc", "Document Knowledge Base"),
            "engine": doc_res.get("engine", "Doc AI"),
        }

    # Steps 4, 5, 6 — Semantic match over Manual KB (qa_data.json) if any exist
    tokens = tokenize(cleaned)
    questions = load_questions()
    if questions:
        best_answer, best_score, best_question = semantic_match(tokens, questions)
        if best_score >= CONFIDENCE_THRESHOLD and best_answer:
            return {"answer": best_answer, "intent": intent,
                    "confidence": best_score, "matched_question": best_question, "engine": "Manual KB"}

    # Step 7 — Fallback
    conv = _conv_lookup(cleaned)
    if conv:
        return {"answer": conv, "intent": intent, "confidence": 0.85, "matched_question": cleaned, "engine": "Conversational"}

    return {"answer": fallback_response(0.1), "intent": intent,
            "confidence": 0.15, "matched_question": "", "engine": "Fallback"}


def find_answer(raw_question: str) -> str:
    return find_answer_detailed(raw_question)["answer"]


# ══════════════════════════════════════════════════════════════════════════════
#  AUTH DECORATOR
# ══════════════════════════════════════════════════════════════════════════════
def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("admin"):
            return redirect("/admin/login")
        return fn(*args, **kwargs)
    return wrapper


# ══════════════════════════════════════════════════════════════════════════════
#  ROUTES — PUBLIC
# ══════════════════════════════════════════════════════════════════════════════
@app.route("/")
def home():
    return render_template("index.html")


@app.route("/ask", methods=["POST"])
def ask():
    data  = request.get_json(silent=True) or {}
    raw_q = str(data.get("question", "")).strip()
    if not raw_q:
        return jsonify(success=False, error="Empty question", answer=""), 400

    result = find_answer_detailed(raw_q)
    save_history(raw_q, result["answer"], result["intent"], result["confidence"])
    return jsonify(
        success    = True,
        answer     = result["answer"],
        intent     = result["intent"],
        confidence = result["confidence"],
    )


# ══════════════════════════════════════════════════════════════════════════════
#  ROUTES — FILE CONTEXT UPLOAD & CONTEXT-AWARE Q&A
# ══════════════════════════════════════════════════════════════════════════════

def _split_sentences(text: str) -> list[str]:
    """Split text into clean sentences, filtering very short ones."""
    # Split on sentence endings, newlines, or dashes
    raw = re.split(r'(?<=[.!?])\s+|\n+|(?<=:)\s*\n', text)
    sentences = []
    for s in raw:
        s = s.strip()
        if len(s) > 20:  # ignore tiny fragments
            sentences.append(s)
    return sentences if sentences else [text[:500]]


def _smart_local_qa(context: str, question: str, filename: str = "", file_type: str = "text") -> dict:
    """
    Super-smart local Q&A engine — NO API needed.
    Uses sentence scoring, Jaccard similarity, keyword matching,
    error detection, and context window retrieval.
    """
    if not context or not context.strip():
        return {
            "answer": "❌ Document mein koi content nahi mila. Kripya doosri file upload karein.",
            "confidence": 0.0, "engine": "Local NLP"
        }

    q_raw    = question.strip()
    q_lower  = q_raw.lower()
    q_tokens = set(tokenize(preprocess(q_raw)))
    q_words  = set(q_lower.split())

    # ── Split context into sentences ──────────────────────────────────────────
    raw_lines = [ln.strip() for ln in context.splitlines() if ln.strip()]
    sentences: list[str] = []
    for ln in raw_lines:
        for p in re.split(r'(?<=[.!?])\s+', ln):
            p = p.strip()
            if len(p) > 10:
                sentences.append(p)
    if not sentences:
        sentences = raw_lines[:80]

    # ── Question type detection ──────────────────────────────────────────────
    is_summary = (len(q_tokens) < 5 and any(
        t in q_lower for t in {"summary","summarize","samjhao","overview","brief","describe","topic","main"}
    ))
    is_error = any(t in q_lower for t in {
        "error","bug","issue","problem","exception","fail","fix","galti","traceback","warning","crash"
    })
    is_howto = any(t in q_lower for t in {
        "how to","kaise","steps","tarika","method","procedure"
    })

    # ── Score every sentence ──────────────────────────────────────────────────
    def _score(sent: str) -> float:
        sl  = sent.lower()
        st  = set(tokenize(preprocess(sent)))
        if not st:
            return 0.0
        union   = st | q_tokens
        jaccard = len(st & q_tokens) / len(union) if union else 0.0
        kw_hits = sum(1 for w in q_words if len(w) > 3 and w in sl)
        kw_bon  = min(kw_hits * 0.12, 0.40)
        ph_bon  = 0.25 if any(len(w) > 4 and w in sl for w in q_words) else 0.0
        err_bon = 0.30 if (is_error and re.search(
            r'\b(error|exception|failed|traceback|line \d+|cannot|undefined)\b', sl, re.I)) else 0.0
        return min(jaccard * 0.55 + kw_bon + ph_bon + err_bon, 1.0)

    scored = sorted([(_score(s), s) for s in sentences], key=lambda x: x[0], reverse=True)
    top    = [(sc, s) for sc, s in scored if sc > 0.05]

    # ── Summary mode ──────────────────────────────────────────────────────────
    if is_summary or not q_tokens:
        bullets: list[str] = []
        seen_b: set[str] = set()
        for _, s in scored[:12]:
            if s not in seen_b and len(s) > 20:
                bullets.append(f"- {s}")
                seen_b.add(s)
            if len(bullets) >= 7:
                break
        blk = "\n".join(bullets) if bullets else "\n".join(f"- {s}" for s in sentences[:5])
        return {
            "answer": (
                f"### 📋 Summary: `{filename or 'Document'}`\n\n"
                f"**{len(sentences)} sentences** · {len(context)} characters\n\n"
                f"**Key Points:**\n{blk}\n\n"
                f"---\n*Specific topic ke baare mein poochho for detailed answer!*"
            ),
            "confidence": 0.88, "engine": "Local Summarizer"
        }

    # ── Error analysis ────────────────────────────────────────────────────────
    if is_error:
        err_lns: list[str] = []
        for i, s in enumerate(sentences):
            if re.search(r'\b(error|exception|failed|traceback|line \d+|cannot|undefined|null|syntax|timeout)\b', s, re.I):
                err_lns.extend(sentences[max(0, i-1): min(len(sentences), i+3)])
        seen_e: set[str] = set()
        uniq = [l for l in err_lns if not (l in seen_e or seen_e.add(l))][:8]
        if uniq:
            blk = "\n".join(uniq)
            return {
                "answer": (
                    f"### 🔍 Error Analysis:\n\n"
                    f"```\n{blk}\n```\n\n"
                    f"**💡 Diagnosis Steps:**\n"
                    f"- Error type aur line number carefully dekho\n"
                    f"- Variable names, syntax aur imports verify karo\n"
                    f"- File paths aur dependencies check karo\n\n"
                    f"*Specific line ya function ke baare mein poochho for detailed fix!*"
                ),
                "confidence": 0.93, "engine": "Error Analyzer"
            }

    # ── Best sentence + context window retrieval ──────────────────────────────
    if top:
        best_sc = top[0][0]
        sel: list[str] = []
        seen_w: set[str] = set()
        for _, sent in top[:4]:
            if sent in seen_w:
                continue
            seen_w.add(sent)
            try:
                idx = sentences.index(sent)
                for w in sentences[max(0, idx-1): min(len(sentences), idx+2)]:
                    if w not in seen_w:
                        sel.append(w)
                        seen_w.add(w)
            except ValueError:
                sel.append(sent)

        conf  = min(0.97, round(best_sc * 1.7, 2))
        label = (
            "📌 Steps / Method:" if is_howto else
            "✅ Direct Answer:"  if best_sc > 0.7 else
            "📄 Relevant Information:" if best_sc > 0.4 else
            "🔎 Related Content:"
        )

        formatted_paragraphs = []
        for s in sel[:6]:
            s_clean = s.strip()
            if not s_clean:
                continue
            if s_clean.startswith(("-", "•", "*")):
                formatted_paragraphs.append(s_clean)
            elif is_howto:
                formatted_paragraphs.append(f"• {s_clean}")
            else:
                formatted_paragraphs.append(s_clean)

        body = "\n\n".join(formatted_paragraphs)
        return {
            "answer": (
                f"### {label}\n\n{body}\n\n"
                f"---\n*Sawal **'{q_raw}'** ke liye document se match (Confidence: {int(conf*100)}%)*"
            ),
            "confidence": conf, "engine": "Local Semantic Search"
        }

    # ── Fallback ──────────────────────────────────────────────────────────────
    fb = "\n".join(f"- {s}" for s in sentences[:6] if len(s) > 15)
    return {
        "answer": (
            f"❓ **'{q_raw}'** ka exact match document mein nahi mila.\n\n"
            f"**Document mein available content sample:**\n{fb}\n\n"
            f"💡 *Sawal ko doosre words mein ya document ke specific keyword ke baare mein try karo.*"
        ),
        "confidence": 0.25, "engine": "Fallback NLP"
    }


def _answer_from_context_advanced(context: str, question: str, file_type: str = "text", filename: str = "") -> dict:
    """
    Advanced local context-aware Q&A engine for screenshots & files.
    Works 100% offline using OCR lines, token matching, and NLP heuristics.
    """
    if not context or not context.strip():
        return {
            "answer": "Document/Screenshot mein koi content nahi mila. Kripya doosri file upload karein.",
            "confidence": 0.0,
            "engine": "Local NLP",
            "snippets": [],
        }

    q_raw = question.strip()
    q_lower = q_raw.lower()
    q_tokens = set(tokenize(preprocess(q_raw)))
    lines = [ln.strip() for ln in context.splitlines() if ln.strip()]

    # ── 1. Error / Issue / Bug / Troubleshooting Detection ──────────────────
    error_triggers = {"error", "bug", "issue", "problem", "exception", "fail", "failed",
                      "fix", "galti", "dikkat", "traceback", "warning", "solve", "kya galat"}
    if any(t in q_lower for t in error_triggers):
        err_lines = []
        for i, line in enumerate(lines):
            if re.search(r'\b(error|exception|failed|traceback|line \d+|status \d+|cannot|undefined|nullpointer|syntaxerror|typeerror|nameerror|valueerror|zerodivisionerror|filenotfounderror)\b', line, re.IGNORECASE):
                start = max(0, i - 1)
                end = min(len(lines), i + 3)
                err_lines.extend(lines[start:end])

        if err_lines:
            unique_err = []
            seen = set()
            for ln in err_lines:
                if ln not in seen:
                    unique_err.append(ln)
                    seen.add(ln)
            err_block = "\n".join(unique_err[:8])

            answer = (
                f"### 🔍 Screenshot / File Error Analysis:\n\n"
                f"**Screenshot mein yeh error detect hua:**\n"
                f"```text\n{err_block}\n```\n\n"
                f"**💡 Diagnosis & Solution:**\n"
                f"- Screenshot ke hisaab se yeh error execution ke dauraan aaya hai.\n"
                f"- Code mein file path, variable name, syntax ya runtime conditions check karein.\n"
                f"- Agar koi exception line number mention hai toh us specific line ko inspect karein.\n\n"
                f"*Tip: Agar aap specific line ya function ka code dekhna chahte hain toh poochh sakte hain!*"
            )
            return {"answer": answer, "confidence": 0.95, "engine": "Windows OCR + Error Analyzer", "snippets": unique_err[:4]}

    summary_words = {"summary", "summarize", "samjhao", "overview", "explain", "brief", "parichay", "poora", "full"}
    non_stopwords = q_tokens - summary_words - {"kya", "hai", "hain", "ke", "ki", "ka", "bata", "batao", "dikhao", "bataiye"}

    # ── 2. Line / Entity Search using TF-IDF & Keyword Proximity ────────────
    scored_lines: list[tuple[float, str]] = []
    search_tokens = non_stopwords if non_stopwords else q_tokens
    if search_tokens:
        for line in lines:
            ln_tokens = set(tokenize(preprocess(line)))
            if not ln_tokens:
                continue

            overlap = len(search_tokens & ln_tokens)
            union = len(search_tokens | ln_tokens)
            jaccard = overlap / union if union else 0.0

            phrase_bonus = 0.35 if any(t in line.lower() for t in search_tokens) else 0.0
            score = (jaccard * 0.65) + phrase_bonus
            if score > 0.08:
                scored_lines.append((score, line))

        scored_lines.sort(key=lambda x: x[0], reverse=True)

    if scored_lines and non_stopwords:
        best_lines = []
        seen = set()
        for score, ln in scored_lines:
            if ln not in seen:
                best_lines.append(ln)
                seen.add(ln)
            if len(best_lines) >= 4:
                break

        joined_result = "\n\n".join([f"> {ln}" for ln in best_lines])
        confidence = min(0.95, round(scored_lines[0][0] * 1.6, 2))
        answer = (
            f"### 🎯 Screenshot / File se Match:\n\n"
            f"{joined_result}\n\n"
            f"---\n"
            f"*Aapke sawal **'{q_raw}'** ke mutabiq yeh jankari mili hai (Match Confidence: {int(confidence*100)}%).*"
        )
        return {"answer": answer, "confidence": confidence, "engine": "Windows OCR + Semantic Search", "snippets": best_lines}

    # ── 3. Summary / Overview (General Query or Low Specific Match) ──────────
    top_lines = lines[:10]
    bullet_points = "\n".join([f"- {ln}" for ln in top_lines if len(ln) > 10][:6])
    if not bullet_points:
        bullet_points = "- " + "\n- ".join(top_lines[:4])

    answer = (
        f"### 📄 Screenshot / File Overview:\n\n"
        f"**File:** `{filename or 'Uploaded Screenshot'}` ({file_type.upper()})\n\n"
        f"**Key Points & Detected Content:**\n"
        f"{bullet_points}\n\n"
        f"---\n"
        f"*Total Lines: {len(lines)} | Characters: {len(context)}*\n"
        f"*Aap is content ke kisi bhi specific topic ya line ke baare mein sawal poochh sakte hain.*"
    )
    return {"answer": answer, "confidence": 0.88, "engine": "Windows OCR + Summarizer", "snippets": top_lines[:5]}

    # ── 4. Fallback: closest lines ──────────────────────────────────────────
    fallback_sample = "\n".join([f"- {ln}" for ln in lines[:4]])
    answer = (
        f"Aapke sawal **'{q_raw}'** ka exact jawab file mein seedha nahi mila.\n\n"
        f"**File mein maujood content:**\n{fallback_sample}\n\n"
        f"💡 *Sawal ko doosre shabdon mein poochhein ya file ke kisi specific word ke baare mein poochein.*"
    )
    return {"answer": answer, "confidence": 0.35, "engine": "Windows OCR + Local NLP", "snippets": lines[:3]}


def _answer_from_context(context: str, question: str) -> str:
    res = _answer_from_context_advanced(context, question)
    return res["answer"]



@app.route("/docai")
def docai():
    """Document Intelligence page — upload any doc/image/text and ask questions."""
    return render_template("docai.html")


@app.route("/upload-context", methods=["POST"])
def upload_context():
    """
    Upload a file (screenshot, PDF, text) or submit a paragraph
    to set as context for subsequent questions.
    """
    sid = _get_session_id()

    # ── Case 1: Direct paragraph text submitted ───────────────────────────────
    paragraph = request.form.get("paragraph", "").strip()
    if paragraph and not request.files.get("file"):
        _context_store[sid] = paragraph
        _context_store[sid + "_meta"] = {"filename": "Text Input", "file_type": "text"}
        preview = paragraph[:300] + ("..." if len(paragraph) > 300 else "")
        return jsonify(
            success      = True,
            file_type    = "text",
            filename     = "Direct Text Input",
            preview      = preview,
            char_count   = len(paragraph),
            message      = "✅ Text ready! Ab questions poochho.",
        )

    # ── Case 2: File uploaded ─────────────────────────────────────────────────
    file = request.files.get("file")
    if not file or file.filename == "":
        return jsonify(success=False, error="No file or text provided"), 400

    if not _allowed_file(file.filename):
        return jsonify(
            success = False,
            error   = f"File type not supported. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        ), 400

    filename = secure_filename(file.filename)
    extracted, file_type = _extract_text_from_file(file.stream, filename)

    _context_store[sid] = extracted
    _context_store[sid + "_meta"] = {"filename": filename, "file_type": file_type}

    # Also automatically save to permanent Knowledge Base if valid content
    if extracted and len(extracted.strip()) > 20 and not extracted.startswith("[Read error") and not extracted.startswith("[Unsupported"):
        try:
            save_document_to_db(filename, file_type, len(extracted.encode("utf-8")), extracted)
            log.info("Chat uploaded file automatically saved to Knowledge Base: %s", filename)
        except Exception as e:
            log.warning("Could not auto-save chat file to DB: %s", e)

    preview = extracted[:300] + ("..." if len(extracted) > 300 else "")
    return jsonify(
        success    = True,
        file_type  = file_type,
        filename   = filename,
        preview    = preview,
        char_count = len(extracted),
        message    = (
            f"✅ **{filename}** upload ho gaya! ({file_type.upper()}). Ab questions poochho!"
            if file_type != "image" else
            f"🖼️ **{filename}** OCR complete! Ab image ke baare mein sawal poochho!"
        ),
    )


@app.route("/ask-context", methods=["POST"])
def ask_context():
    """
    Ask a question about the uploaded file/paragraph context.
    Uses Google Gemini if available, or smart local NLP engine (100% offline).
    Falls back to permanent KB if no context is set.
    """
    data  = request.get_json(silent=True) or {}
    raw_q = str(data.get("question", "")).strip()
    if not raw_q:
        return jsonify(success=False, error="Empty question", answer=""), 400

    sid     = _get_session_id()
    context = _context_store.get(sid, "")
    ctx_meta = _context_store.get(sid + "_meta", {})

    if not context:
        # No session context set — fall back to permanent KB answer
        result = find_answer_detailed(raw_q)
        save_history(raw_q, result["answer"], result["intent"], result["confidence"])
        return jsonify(
            success      = True,
            answer       = result["answer"],
            intent       = result["intent"],
            confidence   = result["confidence"],
            engine       = result.get("engine", "Doc AI"),
            used_context = False,
        )

    filename  = ctx_meta.get("filename", "document")
    file_type = ctx_meta.get("file_type", "text")

    # ── Attempt 1: Gemini AI if configured ────────────────────────────────────
    gemini_key = get_setting("gemini_api_key", os.environ.get("GEMINI_API_KEY", "")).strip()
    if gemini_key and GEMINI_AVAILABLE:
        try:
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = (
                "You are AJ AI, an advanced intelligent multilingual AI assistant (fluent in Hindi, Hinglish, Haryanvi, English).\n"
                f"The user uploaded a document '{filename}' ({file_type}) with the following content:\n\n"
                f"--- START DOCUMENT CONTENT ---\n{context[:32000]}\n--- END DOCUMENT CONTENT ---\n\n"
                f"User Question: {raw_q}\n\n"
                "Please provide a thorough, accurate, and beautifully structured answer directly based on the document. "
                "Use bullet points, bold key terms, or code blocks where appropriate. "
                f"Cite the source document at the end: 📄 **Source Document:** `{filename}`."
            )
            resp = model.generate_content(prompt)
            if resp and resp.text:
                answer = resp.text.strip()
                save_history(raw_q, answer, "context_qa", 0.98)
                return jsonify(
                    success      = True,
                    answer       = answer,
                    intent       = "context_qa",
                    confidence   = 0.98,
                    engine       = "Google Gemini 1.5 Flash (Doc AI)",
                    used_context = True,
                )
        except Exception as exc:
            log.warning("Gemini ask_context failed, falling back to local NLP: %s", exc)

    # ── Attempt 2: Smart Local NLP Engine ─────────────────────────────────────
    result = _smart_local_qa(context, raw_q, filename=filename, file_type=file_type)
    answer = result["answer"]
    if "Source Document" not in answer and "Knowledge Base Source" not in answer:
        answer += f"\n\n---\n📄 **Source Document:** `{filename}`"
    save_history(raw_q, answer, "context_qa", result["confidence"])
    return jsonify(
        success      = True,
        answer       = answer,
        intent       = "context_qa",
        confidence   = result["confidence"],
        engine       = result.get("engine", "Local Smart Doc Engine"),
        used_context = True,
    )


@app.route("/api/kb-stats", methods=["GET"])
def api_kb_stats():
    """Return public Knowledge Base status and stats for UI badges."""
    try:
        docs = get_all_documents()
        conn = get_db()
        total_chunks = conn.execute("SELECT COUNT(*) FROM document_chunks").fetchone()[0]
        conn.close()
        gemini_key = get_setting("gemini_api_key", os.environ.get("GEMINI_API_KEY", "")).strip()
        engine = "Google Gemini 1.5 Flash" if (gemini_key and GEMINI_AVAILABLE) else "Smart Local NLP (Offline)"
        return jsonify(
            success=True,
            total_docs=len(docs),
            total_chunks=total_chunks,
            engine=engine,
            has_gemini=bool(gemini_key),
            documents=[{"id": d["id"], "filename": d["filename"], "chars": d["char_count"]} for d in docs[:10]]
        )
    except Exception as exc:
        return jsonify(success=False, error=str(exc)), 500


@app.route("/clear-context", methods=["POST"])
def clear_context():
    """Clear the uploaded file context for this session."""
    sid = _get_session_id()
    _context_store.pop(sid, None)
    return jsonify(success=True, message="Context clear ho gaya! Ab normal chat mode mein ho.")


@app.route("/context-status", methods=["GET"])
def context_status():
    """Check if a file context is currently loaded."""
    sid     = _get_session_id()
    context = _context_store.get(sid, "")
    if context:
        return jsonify(
            success    = True,
            has_context= True,
            char_count = len(context),
            preview    = context[:150] + ("..." if len(context) > 150 else ""),
        )
    return jsonify(success=True, has_context=False)


@app.route("/history", methods=["GET"])
def get_history():
    try:
        conn = get_db()
        rows = conn.execute(
            "SELECT id, user_question, bot_answer, intent, confidence, created_at "
            "FROM history ORDER BY id DESC LIMIT 50"
        ).fetchall()
        conn.close()
        return jsonify(success=True, history=[dict(r) for r in rows])
    except Exception as exc:
        log.error("get_history: %s", exc)
        return jsonify(success=False, error=str(exc)), 500


@app.route("/clear-history", methods=["GET", "POST"])
def clear_history():
    try:
        conn = get_db()
        conn.execute("DELETE FROM history")
        conn.commit()
        conn.close()
        return jsonify(success=True)
    except Exception as exc:
        return jsonify(success=False, error=str(exc)), 500


@app.route("/new-chat")
def new_chat():
    return jsonify(success=True)


@app.route("/health")
def health():
    return jsonify(success=True, status="ok", version="2.0")


@app.route("/test")
def test():
    return jsonify(success=True, message="AJ AI is running!")


# ══════════════════════════════════════════════════════════════════════════════
#  ROUTES — ADMIN
# ══════════════════════════════════════════════════════════════════════════════
@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()
        conn = get_db()
        row  = conn.execute(
            "SELECT id, password FROM admins WHERE username = ?", (username,)
        ).fetchone()
        conn.close()
        if row and check_password_hash(row["password"], password):
            session["admin"]          = True
            session["admin_username"] = username
            return redirect("/admin")
        # Wrong credentials — re-render login with error
        return render_template("admin.html", login=True, error="Invalid credentials")
    return render_template("admin.html", login=True)


@app.route("/admin")
@admin_required
def admin():
    questions = load_questions()
    documents = get_all_documents()
    conn      = get_db()
    history   = conn.execute(
        "SELECT id, user_question, bot_answer, intent, confidence, created_at "
        "FROM history ORDER BY id DESC LIMIT 100"
    ).fetchall()
    total_queries = conn.execute("SELECT COUNT(*) FROM history").fetchone()[0]
    total_chunks  = conn.execute("SELECT COUNT(*) FROM document_chunks").fetchone()[0]
    today_date    = datetime.now().strftime("%Y-%m-%d")
    today_queries = conn.execute(
        "SELECT COUNT(*) FROM history WHERE DATE(created_at) = ?", (today_date,)
    ).fetchone()[0]
    conn.close()

    gemini_key = get_setting("gemini_api_key", os.environ.get("GEMINI_API_KEY", "")).strip()
    masked_key = (gemini_key[:4] + "..." + gemini_key[-4:]) if len(gemini_key) > 8 else ("Configured" if gemini_key else "")

    stats = {
        "total_docs":     len(documents),
        "total_chunks":   total_chunks,
        "total_qa":       len(questions),
        "total_queries":  total_queries,
        "today_queries":  today_queries,
        "admin_user":     session.get("admin_username", "admin"),
        "has_gemini":     bool(gemini_key),
        "gemini_masked":  masked_key,
        "ocr_available":  WINSDK_OCR_AVAILABLE,
    }
    return render_template(
        "admin.html",
        login     = False,
        documents = documents,
        questions = questions,
        history   = history,
        stats     = stats,
    )


# ══════════════════════════════════════════════════════════════════════════════
#  ROUTES — ADMIN DOCUMENT KNOWLEDGE BASE
# ══════════════════════════════════════════════════════════════════════════════
@app.route("/admin/upload-document", methods=["POST"])
@admin_required
def admin_upload_document():
    """
    Upload one or multiple documents (PDF, DOCX, TXT, MD, CSV, Code, Images)
    or paste text notes directly into the permanent Knowledge Base.
    """
    text_content = request.form.get("text_content", "").strip()
    doc_title    = request.form.get("doc_title", "").strip()

    uploaded_docs = []

    # Case A: Direct text / notes paste
    if text_content:
        filename = (doc_title or f"Notes_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        if not any(filename.lower().endswith(f".{ext}") for ext in ["txt", "md"]):
            filename += ".txt"
        doc_id = save_document_to_db(filename, "text", len(text_content.encode('utf-8')), text_content)
        uploaded_docs.append({"id": doc_id, "filename": filename, "chars": len(text_content)})

    # Case B: Uploaded file(s)
    files = request.files.getlist("files") or request.files.getlist("file")
    for file in files:
        if file and file.filename:
            raw_filename = secure_filename(file.filename)
            raw_bytes = file.read()
            if not raw_bytes:
                continue
            extracted_text, file_type = _extract_text_from_file(raw_bytes, raw_filename)
            if extracted_text and not extracted_text.startswith("[Read error") and not extracted_text.startswith("[Unsupported"):
                doc_id = save_document_to_db(raw_filename, file_type, len(raw_bytes), extracted_text)
                uploaded_docs.append({"id": doc_id, "filename": raw_filename, "chars": len(extracted_text)})

    if not uploaded_docs:
        if request.headers.get("X-Requested-With") == "XMLHttpRequest" or request.is_json:
            return jsonify(success=False, error="Koi valid document ya text select nahi kiya gaya!"), 400
        return redirect("/admin")

    if request.headers.get("X-Requested-With") == "XMLHttpRequest" or request.is_json:
        return jsonify(
            success=True,
            message=f"✅ {len(uploaded_docs)} document(s) successfully AI Knowledge Base mein add ho gaye!",
            documents=uploaded_docs,
        )

    return redirect("/admin")


@app.route("/admin/delete-document/<int:doc_id>", methods=["GET", "POST"])
@admin_required
def admin_delete_document(doc_id: int):
    success = delete_document_from_db(doc_id)
    if request.headers.get("X-Requested-With") == "XMLHttpRequest" or request.is_json:
        return jsonify(success=success)
    return redirect("/admin")


@app.route("/admin/document/<int:doc_id>", methods=["GET"])
@admin_required
def admin_get_document(doc_id: int):
    doc = get_document_by_id(doc_id)
    if not doc:
        return jsonify(success=False, error="Document not found"), 404
    return jsonify(success=True, document=doc)


@app.route("/admin/ask-docs", methods=["POST"])
@admin_required
def admin_ask_docs():
    data = request.get_json(silent=True) or {}
    question = str(data.get("question", "")).strip()
    if not question:
        return jsonify(success=False, error="Empty question"), 400

    result = answer_from_knowledge_base(question)
    return jsonify(
        success    = True,
        found      = result.get("found", False),
        question   = question,
        answer     = result.get("answer", ""),
        confidence = result.get("confidence", 0.0),
        source_doc = result.get("source_doc", ""),
        engine     = result.get("engine", "Doc AI"),
    )


@app.route("/admin/add", methods=["POST"])
@admin_required
def admin_add():
    question  = request.form.get("question", "").strip()
    answer    = request.form.get("answer",   "").strip()
    if question and answer:
        questions = load_questions()
        questions.insert(0, {"question": question, "answer": answer})
        save_questions(questions)
    return redirect("/admin")


@app.route("/admin/edit/<int:question_id>", methods=["POST"])
@admin_required
def admin_edit(question_id: int):
    question  = request.form.get("question", "").strip()
    answer    = request.form.get("answer",   "").strip()
    questions = load_questions()
    if 0 <= question_id < len(questions) and question and answer:
        questions[question_id] = {"question": question, "answer": answer}
        save_questions(questions)
    return redirect("/admin")


@app.route("/admin/delete/<int:question_id>", methods=["GET", "POST"])
@admin_required
def admin_delete(question_id: int):
    questions = load_questions()
    if 0 <= question_id < len(questions):
        questions.pop(question_id)
        save_questions(questions)
    return redirect("/admin")


@app.route("/admin/export-qa")
@admin_required
def admin_export_qa():
    questions = load_questions()
    json_data = json.dumps(questions, indent=2, ensure_ascii=False)
    response  = make_response(json_data)
    response.headers["Content-Disposition"] = "attachment; filename=aj_ai_qa_backup.json"
    response.headers["Content-Type"]        = "application/json; charset=utf-8"
    return response


@app.route("/admin/import-qa", methods=["POST"])
@admin_required
def admin_import_qa():
    file = request.files.get("qa_file")
    mode = request.form.get("mode", "merge")
    if file and file.filename.endswith(".json"):
        try:
            content       = file.read().decode("utf-8", "replace")
            imported_data = json.loads(content)
            if isinstance(imported_data, list):
                if mode == "merge":
                    existing    = load_questions()
                    existing_qs = {preprocess(q.get("question", "")) for q in existing}
                    for item in imported_data:
                        if isinstance(item, dict) and item.get("question") and item.get("answer"):
                            pq = preprocess(item["question"])
                            if pq not in existing_qs:
                                existing.append(item)
                                existing_qs.add(pq)
                    save_questions(existing)
                else:
                    save_questions(imported_data)
        except Exception as exc:
            log.error("admin_import_qa: %s", exc)
    return redirect("/admin")


@app.route("/admin/delete-history/<int:history_id>", methods=["GET", "POST"])
@admin_required
def admin_delete_history(history_id: int):
    conn = get_db()
    conn.execute("DELETE FROM history WHERE id = ?", (history_id,))
    conn.commit()
    conn.close()
    return redirect("/admin")


@app.route("/admin/clear-all-history", methods=["GET", "POST"])
@admin_required
def admin_clear_all_history():
    conn = get_db()
    conn.execute("DELETE FROM history")
    conn.commit()
    conn.close()
    return redirect("/admin")


@app.route("/admin/change-password", methods=["POST"])
@admin_required
def admin_change_password():
    old_pw   = request.form.get("old_password", "").strip()
    new_pw   = request.form.get("new_password", "").strip()
    username = session.get("admin_username")
    if new_pw:
        conn = get_db()
        row  = conn.execute(
            "SELECT id, password FROM admins WHERE username = ?", (username,)
        ).fetchone()
        if row and check_password_hash(row["password"], old_pw):
            conn.execute(
                "UPDATE admins SET password = ? WHERE id = ?",
                (generate_password_hash(new_pw), row["id"]),
            )
            conn.commit()
        conn.close()
    return redirect("/admin")


@app.route("/admin/test-query", methods=["POST"])
@admin_required
def admin_test_query():
    data  = request.get_json(silent=True) or {}
    raw_q = str(data.get("question", "")).strip()
    if not raw_q:
        return jsonify(success=False, error="Empty question"), 400

    result = find_answer_detailed(raw_q)
    return jsonify(
        success          = True,
        question         = raw_q,
        answer           = result["answer"],
        score            = result["confidence"],   # template reads data.score
        confidence       = result["confidence"],
        intent           = result["intent"],
        matched_question = result.get("matched_question", ""),
        engine           = result.get("engine", "AI NLP Engine"),
    )


# ══════════════════════════════════════════════════════════════════════════════
#  ROUTES — ADMIN SCREENSHOT & FILE Q&A
# ══════════════════════════════════════════════════════════════════════════════
@app.route("/admin/upload-file", methods=["POST"])
@admin_required
def admin_upload_file():
    """
    Handle screenshot or file upload in Admin Panel.
    Supports multipart file upload, base64 screenshot paste (Ctrl+V), and raw text.
    """
    sid = _get_session_id()

    # ── Case A: Base64 Screenshot Paste (from clipboard) ──────────────────────
    base64_data = ""
    if request.is_json:
        base64_data = request.json.get("image_base64", "")
    else:
        base64_data = request.form.get("image_base64", "")

    if base64_data:
        try:
            if "," in base64_data:
                base64_data = base64_data.split(",", 1)[1]
            raw_bytes = base64.b64decode(base64_data)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"admin_screenshot_{timestamp}.png"
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            with open(file_path, "wb") as f:
                f.write(raw_bytes)

            img = Image.open(io.BytesIO(raw_bytes)) if PIL_AVAILABLE else None
            w, h = img.size if img else (0, 0)
            ocr_text, ocr_ok = extract_text_from_image_bytes(raw_bytes)

            _admin_file_store[sid] = {
                "filename": filename,
                "file_type": "image",
                "file_url": f"/static/uploads/{filename}",
                "mime_type": "image/png",
                "raw_bytes": raw_bytes,
                "extracted_text": ocr_text,
                "char_count": len(ocr_text),
                "line_count": len(ocr_text.splitlines()) if ocr_text else 0,
                "width": w,
                "height": h,
                "ocr_success": ocr_ok,
                "history": [],
                "uploaded_at": datetime.now().strftime("%H:%M:%S"),
            }

            return jsonify(
                success=True,
                filename=filename,
                file_type="image",
                file_url=f"/static/uploads/{filename}",
                extracted_text=ocr_text,
                char_count=len(ocr_text),
                line_count=len(ocr_text.splitlines()) if ocr_text else 0,
                ocr_success=ocr_ok,
                ocr_available=WINSDK_OCR_AVAILABLE,
                message=f"Screenshot upload ho gaya ({w}×{h} px)! " +
                        (f"OCR ne {len(ocr_text)} characters detect kiye." if ocr_ok else "No text detected by OCR."),
            )
        except Exception as exc:
            log.error("admin_upload_file base64: %s", exc)
            return jsonify(success=False, error=f"Screenshot processing failed: {exc}"), 500

    # ── Case B: Direct Text Content Paste ─────────────────────────────────────
    text_content = ""
    if request.is_json:
        text_content = request.json.get("text_content", "").strip()
    else:
        text_content = request.form.get("text_content", "").strip()

    if text_content and not request.files.get("file"):
        filename = f"text_snippet_{datetime.now().strftime('%H%M%S')}.txt"
        _admin_file_store[sid] = {
            "filename": filename,
            "file_type": "text",
            "file_url": "",
            "mime_type": "text/plain",
            "raw_bytes": text_content.encode("utf-8"),
            "extracted_text": text_content,
            "char_count": len(text_content),
            "line_count": len(text_content.splitlines()),
            "width": 0,
            "height": 0,
            "ocr_success": False,
            "history": [],
            "uploaded_at": datetime.now().strftime("%H:%M:%S"),
        }
        return jsonify(
            success=True,
            filename=filename,
            file_type="text",
            file_url="",
            extracted_text=text_content,
            char_count=len(text_content),
            line_count=len(text_content.splitlines()),
            ocr_success=False,
            ocr_available=WINSDK_OCR_AVAILABLE,
            message="Text snippet ready! Ab sawal poochhein.",
        )

    # ── Case C: Multipart File Upload ─────────────────────────────────────────
    file = request.files.get("file")
    if not file or file.filename == "":
        return jsonify(success=False, error="Koi file ya screenshot select nahi ki gayi!"), 400

    if not _allowed_file(file.filename):
        return jsonify(
            success=False,
            error=f"File type not supported. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        ), 400

    raw_filename = secure_filename(file.filename)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_filename = f"admin_{timestamp}_{raw_filename}"
    saved_path = os.path.join(UPLOAD_FOLDER, unique_filename)

    raw_bytes = file.read()
    with open(saved_path, "wb") as f:
        f.write(raw_bytes)

    ext = raw_filename.rsplit(".", 1)[-1].lower() if "." in raw_filename else ""
    file_type = "text"
    extracted_text = ""
    ocr_success = False
    w, h = 0, 0
    mime_type = "application/octet-stream"

    if ext in {"png", "jpg", "jpeg", "gif", "bmp", "webp"}:
        file_type = "image"
        mime_type = f"image/{ext if ext != 'jpg' else 'jpeg'}"
        if PIL_AVAILABLE:
            try:
                img = Image.open(io.BytesIO(raw_bytes))
                w, h = img.size
            except Exception:
                pass
        extracted_text, ocr_success = extract_text_from_image_bytes(raw_bytes)
    elif ext == "pdf":
        file_type = "pdf"
        mime_type = "application/pdf"
        if PYPDF2_AVAILABLE:
            try:
                reader = PyPDF2.PdfReader(io.BytesIO(raw_bytes))
                pages = [page.extract_text() or "" for page in reader.pages[:25]]
                extracted_text = "\n".join(pages)
            except Exception as e:
                extracted_text = f"[PDF Error: {e}]"
    else:
        file_type = "code" if ext in {"py", "js", "html", "css", "c", "cpp", "java", "sql", "sh"} else "text"
        mime_type = "text/plain"
        try:
            extracted_text = raw_bytes.decode("utf-8", errors="replace")
        except Exception as e:
            extracted_text = f"[Read error: {e}]"

    _admin_file_store[sid] = {
        "filename": raw_filename,
        "file_type": file_type,
        "file_url": f"/static/uploads/{unique_filename}",
        "mime_type": mime_type,
        "raw_bytes": raw_bytes,
        "extracted_text": extracted_text,
        "char_count": len(extracted_text),
        "line_count": len(extracted_text.splitlines()) if extracted_text else 0,
        "width": w,
        "height": h,
        "ocr_success": ocr_success,
        "history": [],
        "uploaded_at": datetime.now().strftime("%H:%M:%S"),
    }

    return jsonify(
        success=True,
        filename=raw_filename,
        file_type=file_type,
        file_url=f"/static/uploads/{unique_filename}",
        extracted_text=extracted_text,
        char_count=len(extracted_text),
        line_count=len(extracted_text.splitlines()) if extracted_text else 0,
        ocr_success=ocr_success,
        ocr_available=WINSDK_OCR_AVAILABLE,
        message=f"✅ {raw_filename} successfully upload ho gaya!",
    )


@app.route("/admin/ask-file", methods=["POST"])
@admin_required
def admin_ask_file():
    """
    Answer questions about the currently uploaded screenshot or file in Admin Panel.
    Uses Gemini Vision if configured, or Native Windows OCR + Local NLP pipeline.
    """
    data = request.get_json(silent=True) or {}
    question = str(data.get("question", "")).strip()
    edited_text = data.get("edited_text")
    use_gemini = data.get("use_gemini", True)

    if not question:
        return jsonify(success=False, error="Sawal likhiye / Please enter a question"), 400

    sid = _get_session_id()
    ctx = _admin_file_store.get(sid)

    if not ctx:
        return jsonify(
            success=False,
            error="Pehle koi screenshot ya file upload karein!",
        ), 400

    if edited_text is not None and isinstance(edited_text, str):
        ctx["extracted_text"] = edited_text
        ctx["char_count"] = len(edited_text)
        ctx["line_count"] = len(edited_text.splitlines())

    gemini_key = get_setting("gemini_api_key", os.environ.get("GEMINI_API_KEY", "")).strip()
    answer = ""
    engine = ""
    confidence = 0.9

    # ── Attempt Gemini AI Vision / Reasoning if API key is present ────────────
    if gemini_key and use_gemini and GEMINI_AVAILABLE:
        try:
            if ctx["file_type"] == "image" and ctx.get("raw_bytes"):
                answer = ask_gemini_vision(gemini_key, ctx["raw_bytes"], ctx.get("mime_type", "image/png"), question)
                engine = "Google Gemini Vision AI"
                confidence = 0.98
            else:
                answer = ask_gemini_document(gemini_key, ctx["extracted_text"], ctx["filename"], question)
                engine = "Google Gemini 1.5 Flash"
                confidence = 0.98
        except Exception as exc:
            log.warning("Gemini query failed, falling back to local OCR engine: %s", exc)
            answer = ""

    # ── Local Engine fallback (Windows OCR + Local NLP) ──────────────────────
    if not answer:
        local_res = _answer_from_context_advanced(
            context=ctx["extracted_text"],
            question=question,
            file_type=ctx["file_type"],
            filename=ctx["filename"],
        )
        answer = local_res["answer"]
        confidence = local_res["confidence"]
        engine = local_res["engine"]

    # Record in active file's session history
    ctx["history"].insert(0, {
        "question": question,
        "answer": answer,
        "engine": engine,
        "time": datetime.now().strftime("%H:%M:%S"),
    })

    # Also log to SQLite history for auditing
    save_history(f"[Admin Q&A: {ctx['filename']}] {question}", answer, "admin_file_qa", confidence)

    return jsonify(
        success=True,
        question=question,
        answer=answer,
        engine=engine,
        confidence=confidence,
        history=ctx["history"],
    )


@app.route("/admin/save-to-kb", methods=["POST"])
@admin_required
def admin_save_to_kb():
    """Save a question and generated answer into permanent qa_data.json."""
    data = request.get_json(silent=True) or {}
    q = str(data.get("question", "")).strip()
    a = str(data.get("answer", "")).strip()

    if not q or not a:
        return jsonify(success=False, error="Question aur Answer dono zaroori hain!"), 400

    questions = load_questions()
    questions.insert(0, {"question": q, "answer": a})
    if save_questions(questions):
        return jsonify(
            success=True,
            total_qa=len(questions),
            message=f"✅ Topic Knowledge Base mein save ho gaya! Bot ab iska jawab dega.",
        )
    return jsonify(success=False, error="File save karne mein error aayi."), 500


@app.route("/admin/clear-file-context", methods=["POST"])
@admin_required
def admin_clear_file_context():
    """Clear active admin file/screenshot context."""
    sid = _get_session_id()
    _admin_file_store.pop(sid, None)
    return jsonify(success=True, message="File context cleared.")


@app.route("/admin/file-context-status", methods=["GET"])
@admin_required
def admin_file_context_status():
    """Get status of active uploaded file in Admin."""
    sid = _get_session_id()
    ctx = _admin_file_store.get(sid)
    if not ctx:
        return jsonify(success=True, has_file=False)

    return jsonify(
        success=True,
        has_file=True,
        filename=ctx["filename"],
        file_type=ctx["file_type"],
        file_url=ctx["file_url"],
        extracted_text=ctx["extracted_text"],
        char_count=ctx["char_count"],
        line_count=ctx["line_count"],
        width=ctx.get("width", 0),
        height=ctx.get("height", 0),
        ocr_success=ctx.get("ocr_success", False),
        history=ctx.get("history", []),
        uploaded_at=ctx.get("uploaded_at", ""),
    )


@app.route("/admin/save-gemini-key", methods=["POST"])
@admin_required
def admin_save_gemini_key():
    """Save Google Gemini API Key into database settings."""
    data = request.get_json(silent=True) or {}
    api_key = str(data.get("api_key", request.form.get("api_key", ""))).strip()
    set_setting("gemini_api_key", api_key)
    masked = (api_key[:4] + "..." + api_key[-4:]) if len(api_key) > 8 else ("Configured" if api_key else "")
    return jsonify(
        success=True,
        has_gemini=bool(api_key),
        masked=masked,
        message="Gemini API Key updated successfully!" if api_key else "Gemini API Key cleared (Using Native Windows OCR).",
    )


@app.route("/admin/logout")
def admin_logout():
    session.clear()
    return redirect("/")


# ══════════════════════════════════════════════════════════════════════════════
#  ERROR HANDLERS
# ══════════════════════════════════════════════════════════════════════════════
@app.errorhandler(404)
def page_not_found(error):
    if request.path.startswith("/api") or request.path.startswith("/ask"):
        return jsonify(success=False, error="Endpoint not found."), 404
    return "AJ AI - Page not found", 404


@app.errorhandler(500)
def internal_server_error(error):
    log.error("500: %s — %s", request.path, error)
    if request.path.startswith(("/ask", "/history", "/clear-history")):
        return jsonify(success=False, error="Internal server error.",
                       answer="Server mein problem aa gayi"), 500
    return "AJ AI - Internal Server Error", 500


# ══════════════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    init_database()
    print("=" * 52)
    print("   AJ AI CHATBOT v2  —  NLP Pipeline Edition")
    print("   Website : http://127.0.0.1:5000")
    print("   Admin   : http://127.0.0.1:5000/admin/login")
    print("   Login   : admin / admin123")
    print("=" * 52)
    app.run(host="0.0.0.0", port=5000, debug=True)
