"""
Generate an exact 8-slide professional PowerPoint presentation for AJ AI project.
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_8_slide_deck():
    prs = Presentation()
    # 16:9 widescreen layout
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Theme colors
    BG_COLOR      = RGBColor(10, 16, 32)       # Dark Slate #0A1020
    CARD_BG       = RGBColor(18, 28, 54)       # Deep Navy #121C36
    CARD_BORDER   = RGBColor(40, 60, 105)      # Navy border
    PRIMARY       = RGBColor(99, 102, 241)     # Indigo/Purple #6366F1
    CYAN          = RGBColor(6, 182, 212)      # Cyan #06B6D4
    ACCENT_GREEN  = RGBColor(16, 185, 129)     # Emerald #10B981
    TEXT_LIGHT    = RGBColor(241, 245, 249)    # Light Slate
    TEXT_MUTED    = RGBColor(148, 163, 184)    # Muted Slate
    WHITE         = RGBColor(255, 255, 255)

    blank_layout = prs.slide_layouts[6]

    def set_slide_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_COLOR
        bg.line.fill.background()
        return bg

    def add_header(slide, title_text, slide_num):
        # Category / Slide counter
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.45), Inches(11.7), Inches(0.35))
        tf_cat = cat_box.text_frame
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = f"AJ AI PROJECT PRESENTATION • SLIDE {slide_num} OF 8"
        p_cat.font.size = Pt(11)
        p_cat.font.bold = True
        p_cat.font.color.rgb = CYAN

        # Title
        t_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.75), Inches(11.7), Inches(0.75))
        tf = t_box.text_frame
        p = tf.paragraphs[0]
        p.text = title_text
        p.font.size = Pt(25)
        p.font.bold = True
        p.font.color.rgb = TEXT_LIGHT

    def add_card(slide, left, top, width, height, title="", border_color=CARD_BORDER, bg_color=CARD_BG):
        shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
        shape.fill.solid()
        shape.fill.fore_color.rgb = bg_color
        shape.line.color.rgb = border_color
        shape.line.width = Pt(1.5)
        
        if title:
            tb = slide.shapes.add_textbox(Inches(left + 0.25), Inches(top + 0.2), Inches(width - 0.5), Inches(0.5))
            p = tb.text_frame.paragraphs[0]
            p.text = title
            p.font.size = Pt(16)
            p.font.bold = True
            p.font.color.rgb = CYAN
        return shape

    # ═════════════════════════════════════════════════════════════════════════
    # SLIDE 1: TITLE SLIDE (Cover Page)
    # ═════════════════════════════════════════════════════════════════════════
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_background(s1)

    dec = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.0), Inches(11.733), Inches(5.5))
    dec.fill.solid()
    dec.fill.fore_color.rgb = CARD_BG
    dec.line.color.rgb = PRIMARY
    dec.line.width = Pt(2)

    pill = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.3), Inches(1.5), Inches(3.6), Inches(0.42))
    pill.fill.solid()
    pill.fill.fore_color.rgb = PRIMARY
    pill.line.fill.background()
    p_pill = pill.text_frame.paragraphs[0]
    p_pill.text = "⚡ NEXT-GEN AI & DOCUMENT SUITE"
    p_pill.alignment = PP_ALIGN.CENTER
    p_pill.font.size = Pt(11)
    p_pill.font.bold = True
    p_pill.font.color.rgb = WHITE

    t1 = s1.shapes.add_textbox(Inches(1.3), Inches(2.1), Inches(10.6), Inches(1.6))
    tf1 = t1.text_frame
    p1 = tf1.paragraphs[0]
    p1.text = "AJ AI Assistant"
    p1.font.size = Pt(46)
    p1.font.bold = True
    p1.font.color.rgb = TEXT_LIGHT

    p1_sub = tf1.add_paragraph()
    p1_sub.text = "Smart Multilingual AI with Document Intelligence (RAG) & Vision OCR"
    p1_sub.font.size = Pt(20)
    p1_sub.font.color.rgb = CYAN

    desc_box = s1.shapes.add_textbox(Inches(1.3), Inches(3.9), Inches(10.6), Inches(2.2))
    tf_d = desc_box.text_frame
    tf_d.word_wrap = True
    
    bullets = [
        "📄 Document AI (RAG): Upload any document (PDF, Word, Code, Text) — AI automatically reads & answers without manual Q&A feeding.",
        "🌐 Vernacular Multilingual NLP: Native understanding of Hindi, हरियाणवी & English with real-time Speech I/O.",
        "📷 Vision & Native OCR: Instant screenshot paste (Ctrl+V) & offline text/error extraction on Windows.",
        "⚡ Dual Architecture: Cloud-powered Gemini 1.5 Flash + 100% Offline Local NLP Engine (Zero API Cost)."
    ]
    for i, b in enumerate(bullets):
        p = tf_d.paragraphs[0] if i == 0 else tf_d.add_paragraph()
        p.text = b
        p.font.size = Pt(14)
        p.font.color.rgb = TEXT_MUTED

    # ═════════════════════════════════════════════════════════════════════════
    # SLIDE 2: PROBLEM STATEMENT & MOTIVATION
    # ═════════════════════════════════════════════════════════════════════════
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_background(s2)
    add_header(s2, "The Problem & Why We Built AJ AI", 2)

    col_data_s2 = [
        ("❌ Manual Q&A Feeding Nightmare", "• Traditional chatbots force admins to manually enter question and answer pairs.\n\n• Unscalable: Impossible to maintain for college syllabi, company policies, or codebases.\n\n• Fails immediately if a user asks in slightly different words.", 0.8, RGBColor(239, 68, 68)),
        ("🌐 Regional & Dialect Disconnect", "• Existing AI models ignore regional dialects (Haryanvi, Desi Hindi, Hinglish).\n\n• Common greetings like 'Ram Ram bhai' or 'ke haal se ladle' trigger error fallbacks.\n\n• Lack of natural bilingual voice assistance.", 4.8, RGBColor(245, 158, 11)),
        ("🔒 Cloud Lock-in & Heavy Costs", "• Pure cloud chatbots require constant internet & expensive API tokens.\n\n• Complete outage if API key expires or internet disconnects.\n\n• Data privacy risks when uploading confidential company documents to external clouds.", 8.8, PRIMARY)
    ]

    for title, text, left, color in col_data_s2:
        add_card(s2, left, 1.7, 3.6, 5.2, title, color)
        tb = s2.shapes.add_textbox(Inches(left + 0.2), Inches(2.4), Inches(3.2), Inches(4.2))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.paragraphs[0].text = text
        tf.paragraphs[0].font.size = Pt(13)
        tf.paragraphs[0].font.color.rgb = TEXT_MUTED

    # ═════════════════════════════════════════════════════════════════════════
    # SLIDE 3: CORE SOLUTION & KEY HIGHLIGHTS
    # ═════════════════════════════════════════════════════════════════════════
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_background(s3)
    add_header(s3, "Core Solution & Key Pillars of AJ AI", 3)

    pillars = [
        ("📄 Zero-Effort Document AI", "Feed any PDF, Word (.docx), TXT, Markdown, CSV, or Code file into Admin Panel. AI reads, chunks, and indexes it into memory. Users get direct answers from documents.", 0.8, 1.7, 5.6, 2.4, PRIMARY),
        ("🌾 Multilingual & Vernacular NLP", "Fluent in Hindi, Haryanvi, Hinglish, and English. Natural dialect understanding for desi greetings, friendly conversational responses, and real-time Speech-to-Text.", 6.8, 1.7, 5.7, 2.4, CYAN),
        ("📷 Vision & Native OCR", "Windows Native OCR (`winsdk`) runs 100% offline. Supports clipboard paste (Ctrl+V) from snipping tool. Automatically detects programming errors and tracebacks.", 0.8, 4.4, 5.6, 2.5, ACCENT_GREEN),
        ("🛡️ Enterprise Admin Control Suite", "Complete control center: Document Knowledge Base Manager, live chat auditing, interactive AI Sandbox, PBKDF2 security, and Gemini API key management.", 6.8, 4.4, 5.7, 2.5, RGBColor(245, 158, 11))
    ]

    for title, desc, left, top, w, h, col in pillars:
        add_card(s3, left, top, w, h, title, col)
        tb = s3.shapes.add_textbox(Inches(left + 0.25), Inches(top + 0.65), Inches(w - 0.5), Inches(h - 0.75))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.paragraphs[0].text = desc
        tf.paragraphs[0].font.size = Pt(13)
        tf.paragraphs[0].font.color.rgb = TEXT_MUTED

    # ═════════════════════════════════════════════════════════════════════════
    # SLIDE 4: SYSTEM ARCHITECTURE & DATA FLOW
    # ═════════════════════════════════════════════════════════════════════════
    s4 = prs.slides.add_slide(blank_layout)
    set_slide_background(s4)
    add_header(s4, "System Architecture & Processing Pipeline", 4)

    steps_s4 = [
        ("1. Ingestion Layer", "• Multi-format parsing (PDF, DOCX via XML, TXT, CSV, Code)\n• Clipboard Screenshot Paste (Ctrl+V) & Windows OCR\n• Microphone Speech-to-Text Input", 0.8),
        ("2. RAG & Indexing Pipeline", "• Semantic Chunking (800 chars / 150 overlap)\n• SQLite Schema (`documents`, `document_chunks`)\n• Jaccard Similarity + BM25 Keyword Scoring\n• N-gram Phrase & Proximity Matching", 4.8),
        ("3. Generation & Admin", "• Dual Engine: Gemini 1.5 Flash vs Local NLP\n• Grounded Answer with Source Document Citation\n• Admin Dashboard & Telemetry Audit\n• TTS Speech Audio Output", 8.8)
    ]

    for title, text, left in steps_s4:
        add_card(s4, left, 1.7, 3.6, 5.2, title)
        tb = s4.shapes.add_textbox(Inches(left + 0.2), Inches(2.4), Inches(3.2), Inches(4.2))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.paragraphs[0].text = text
        tf.paragraphs[0].font.size = Pt(13)
        tf.paragraphs[0].font.color.rgb = TEXT_MUTED

    # ═════════════════════════════════════════════════════════════════════════
    # SLIDE 5: DOCUMENT INTELLIGENCE (RAG PIPELINE)
    # ═════════════════════════════════════════════════════════════════════════
    s5 = prs.slides.add_slide(blank_layout)
    set_slide_background(s5)
    add_header(s5, "Deep Dive: Document Intelligence (RAG Pipeline)", 5)

    add_card(s5, 0.8, 1.7, 11.7, 5.2, "⚡ How Document AI Works (No Manual Q&A Feeding)", PRIMARY)
    tb = s5.shapes.add_textbox(Inches(1.1), Inches(2.4), Inches(11.1), Inches(4.3))
    tf = tb.text_frame
    tf.word_wrap = True

    p = tf.paragraphs[0]
    p.text = "Step-by-Step RAG Execution Workflow:"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = WHITE

    rag_steps = [
        ("Step 1: Document Upload", "Admin drops PDF, DOCX, TXT, CSV, or Code in Admin Panel (or pastes text notes). No question-answer pairs required."),
        ("Step 2: Parsing & Chunking", "Extracted text is split into contextual chunks (800 chars with 150-char overlap) and stored in SQLite `document_chunks` table."),
        ("Step 3: Real-Time Retrieval", "When a user asks any question, the retrieval engine scores all chunks using Jaccard token overlap + exact phrase matching + keyword density."),
        ("Step 4: Grounded Generation", "Top matching chunks are assembled. Google Gemini (or Local NLP) synthesizes an exact answer citing source document name & match %."),
        ("Step 5: Admin Transparency", "Admin can inspect the full extracted text in a modal preview, test queries in Sandbox, or delete documents instantly.")
    ]

    for title, desc in rag_steps:
        p_t = tf.add_paragraph()
        p_t.text = f"{title}: "
        p_t.font.size = Pt(13)
        p_t.font.bold = True
        p_t.font.color.rgb = CYAN
        
        run = p_t.add_run()
        run.text = desc
        run.font.bold = False
        run.font.color.rgb = TEXT_LIGHT

    # ═════════════════════════════════════════════════════════════════════════
    # SLIDE 6: DUAL ENGINE (CLOUD vs. OFFLINE) & VISION OCR
    # ═════════════════════════════════════════════════════════════════════════
    s6 = prs.slides.add_slide(blank_layout)
    set_slide_background(s6)
    add_header(s6, "Dual AI Engine & Computer Vision Capabilities", 6)

    # Cloud vs Local Comparison
    add_card(s6, 0.8, 1.7, 5.6, 5.2, "⚙️ Dual Engine: Cloud vs Local")
    tb = s6.shapes.add_textbox(Inches(1.0), Inches(2.4), Inches(5.2), Inches(4.2))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.paragraphs[0].text = "• Google Gemini 1.5 Flash (Cloud Mode):\n  - Generative, fluent bilingual answers.\n  - Multi-page reasoning & vision analysis.\n  - Grounded strictly in uploaded documents.\n\n• Smart Local NLP Engine (100% Offline):\n  - Zero cost, zero internet required.\n  - Extractive summarization & direct matching.\n  - High speed (<50ms response time).\n  - Complete privacy: documents never leave PC."
    tf.paragraphs[0].font.size = Pt(13)
    tf.paragraphs[0].font.color.rgb = TEXT_MUTED

    # Vision OCR Box
    add_card(s6, 6.8, 1.7, 5.7, 5.2, "📷 Vision OCR & Screenshot AI", CYAN)
    tb = s6.shapes.add_textbox(Inches(7.0), Inches(2.4), Inches(5.3), Inches(4.2))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.paragraphs[0].text = "• Windows Native OCR (`winsdk`):\n  - Local Windows OCR API (100% offline).\n  - High accuracy on code, UI text & error logs.\n\n• Instant Screenshot Paste:\n  - Simply press Ctrl+V to paste screenshot.\n  - Instant character detection & preview.\n\n• Automated Error Diagnosis:\n  - Diagnoses Python, JS, C exceptions.\n  - Explains root cause & provides code fixes."
    tf.paragraphs[0].font.size = Pt(13)
    tf.paragraphs[0].font.color.rgb = TEXT_MUTED

    # ═════════════════════════════════════════════════════════════════════════
    # SLIDE 7: ADMIN CONTROL SUITE & TELEMETRY
    # ═════════════════════════════════════════════════════════════════════════
    s7 = prs.slides.add_slide(blank_layout)
    set_slide_background(s7)
    add_header(s7, "Enterprise Admin Panel & Control Suite", 7)

    admin_features = [
        ("📄 Knowledge Documents Manager", "Upload single/bulk files, view size & chunk statistics, preview extracted text in modal, and one-click delete.", 0.8, 1.7, 5.6, 2.4),
        ("🧪 AI Match Sandbox", "Test any query in Hindi, Haryanvi or English. Live display of match score %, cited source document, and engine.", 6.8, 1.7, 5.7, 2.4),
        ("💬 User Telemetry & Audit Logs", "Records user query, bot answer, confidence %, intent classification, and timestamps with full audit purge options.", 0.8, 4.4, 5.6, 2.5),
        ("🔒 Enterprise Security & Settings", "PBKDF2/Argon2 password hashing, dynamic Gemini API key configuration, and 6 dynamic UI wallpaper themes.", 6.8, 4.4, 5.7, 2.5)
    ]

    for title, desc, left, top, w, h in admin_features:
        add_card(s7, left, top, w, h, title)
        tb = s7.shapes.add_textbox(Inches(left + 0.25), Inches(top + 0.65), Inches(w - 0.5), Inches(h - 0.75))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.paragraphs[0].text = desc
        tf.paragraphs[0].font.size = Pt(13)
        tf.paragraphs[0].font.color.rgb = TEXT_MUTED

    # ═════════════════════════════════════════════════════════════════════════
    # SLIDE 8: TECH STACK, RESULTS & CONCLUSION
    # ═════════════════════════════════════════════════════════════════════════
    s8 = prs.slides.add_slide(blank_layout)
    set_slide_background(s8)
    add_header(s8, "Technology Stack, Results & Conclusion", 8)

    # Box 1: Tech Stack
    add_card(s8, 0.8, 1.7, 5.6, 5.2, "💻 Technology Stack", ACCENT_GREEN)
    tb = s8.shapes.add_textbox(Inches(1.0), Inches(2.4), Inches(5.2), Inches(4.2))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.paragraphs[0].text = "• Backend: Python 3.11, Flask, SQLite3, Werkzeug\n• Parsing: PyPDF2, Built-in XML (`zipfile` for DOCX)\n• AI & NLP: Google Gemini 1.5 Flash, Custom RAG, TF-IDF\n• OCR: Windows Native Media OCR (`winsdk`)\n• Frontend: HTML5, CSS3 Themes, JavaScript ES6+\n• Audio: Web Speech API (Recognition + TTS)"
    tf.paragraphs[0].font.size = Pt(13)
    tf.paragraphs[0].font.color.rgb = TEXT_LIGHT

    # Box 2: Results & Conclusion
    add_card(s8, 6.8, 1.7, 5.7, 5.2, "🎯 Impact & Conclusion", PRIMARY)
    tb = s8.shapes.add_textbox(Inches(7.0), Inches(2.4), Inches(5.3), Inches(4.2))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.paragraphs[0].text = "• 100% Elimination of Manual Q&A Feeding: Simply upload documents and start querying.\n• 97%+ Accuracy on document-grounded answers.\n• Zero Cost Resiliency: Operates fully offline.\n• Vernacular Inclusion: Natural Haryanvi & Hindi support.\n\nThank you! Ready for Live Demonstration & Q&A."
    tf.paragraphs[0].font.size = Pt(13)
    tf.paragraphs[0].font.color.rgb = TEXT_LIGHT

    # Save to both file names
    out1 = os.path.abspath("AJ_AI_Project_Presentation_8Slides.pptx")
    out2 = os.path.abspath("AJ_AI_Project_Presentation.pptx")
    prs.save(out1)
    prs.save(out2)
    print(f"8-Slide Presentation saved successfully at:\n- {out1}\n- {out2}")
    return out1

if __name__ == "__main__":
    create_8_slide_deck()
