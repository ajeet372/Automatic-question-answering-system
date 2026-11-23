// ============================================================
//  ai.js — Rule-based AI engine, FAQ matching, decision tree
// ============================================================

const AI = {

  // ── Generate a response to user input ────────────────────
  async respond(userText, conversationHistory = []) {
    const text = userText.trim();

    // 1. Check tool commands
    const toolResponse = this.checkToolCommand(text);
    if (toolResponse) return { type: "tool", ...toolResponse };

    // 2. Math expression
    if (this.isMathExpression(text)) {
      const result = this.evalMath(text);
      if (result !== null) {
        return {
          type: "text",
          content: `🧮 **Calculation Result:**\n\n\`${text} = ${result}\`\n\nCalculator tools ke liye sidebar mein 🔧 Tools panel open karein.`
        };
      }
    }

    // 3. Date/time queries
    const dtResponse = this.checkDateTime(text);
    if (dtResponse) return { type: "text", content: dtResponse };

    // 4. Knowledge base match
    const kbMatch = KnowledgeBase.findAnswer(text);
    if (kbMatch) {
      return { type: "text", content: kbMatch.answer };
    }

    // 5. Custom KB entries from admin
    const customMatch = this.searchCustomKB(text);
    if (customMatch) return { type: "text", content: customMatch };

    // 6. Code request
    if (this.isCodeRequest(text)) {
      return { type: "text", content: this.generateCodeHelp(text) };
    }

    // 7. Fallback
    return {
      type: "text",
      content: this.getFallbackResponse(text)
    };
  },

  // ── Tool command detection ────────────────────────────────
  checkToolCommand(text) {
    const t = text.toLowerCase();
    if (t.includes("calculator") || t.includes("calculate") || t.includes("calc")) {
      return { action: "openTool", tool: "calculator", content: "Calculator open kar raha hoon! 🧮" };
    }
    if (t.includes("password") && (t.includes("generate") || t.includes("banao") || t.includes("create"))) {
      return { action: "openTool", tool: "password", content: "Password Generator open kar raha hoon! 🔑" };
    }
    if (t.includes("word count") || t.includes("word counter") || (t.includes("count") && t.includes("word"))) {
      return { action: "openTool", tool: "wordcount", content: "Word Counter open kar raha hoon! 📝" };
    }
    if (t.includes("unit convert") || t.includes("convert")) {
      return { action: "openTool", tool: "converter", content: "Unit Converter open kar raha hoon! 🔄" };
    }
    if (t.includes("pdf") && (t.includes("read") || t.includes("open") || t.includes("upload"))) {
      return { action: "openTool", tool: "filereader", content: "PDF / File Reader open kar raha hoon! 📄" };
    }
    if (t.includes("dark mode") || t.includes("dark theme")) {
      return { action: "setTheme", theme: "dark", content: "Dark mode on kar raha hoon! 🌙" };
    }
    if (t.includes("light mode") || t.includes("light theme")) {
      return { action: "setTheme", theme: "light", content: "Light mode on kar raha hoon! ☀️" };
    }
    if (t.includes("new chat") || t.includes("naya chat")) {
      return { action: "newChat", content: "Naya chat shuru kar raha hoon! 💬" };
    }
    return null;
  },

  // ── Math detection ────────────────────────────────────────
  isMathExpression(text) {
    return /^[\d\s\+\-\*\/\(\)\.\%\^]+$/.test(text.replace(/\s/g, "")) && /[\d]/.test(text);
  },

  evalMath(expr) {
    try {
      // Safe eval using Function
      const result = Function('"use strict"; return (' + expr + ')')();
      if (typeof result === "number" && isFinite(result)) {
        return Math.round(result * 1e10) / 1e10;
      }
    } catch (e) {}
    return null;
  },

  // ── Date/Time ─────────────────────────────────────────────
  checkDateTime(text) {
    const t = text.toLowerCase();
    const now = new Date();
    if (t.includes("date") || t.includes("aaj") || t.includes("today") || t.includes("tarikh")) {
      const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
      return `📅 **Aaj ki Tarikh:**\n\n${now.toLocaleDateString("hi-IN", options)}\n\n**English:** ${now.toLocaleDateString("en-IN", options)}`;
    }
    if (t.includes("time") || t.includes("samay") || t.includes("waqt") || t.includes("baj")) {
      return `🕐 **Abhi ka Samay:**\n\n**${now.toLocaleTimeString("hi-IN")}**\n\nTimezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
    }
    return null;
  },

  // ── Code request detection ────────────────────────────────
  isCodeRequest(text) {
    const t = text.toLowerCase();
    const codeKeywords = ["code", "function", "program", "script", "write", "create", "html", "css", "javascript", "python", "java", "sql"];
    return codeKeywords.some(k => t.includes(k));
  },

  generateCodeHelp(text) {
    const t = text.toLowerCase();
    if (t.includes("hello world") && t.includes("python")) {
      return "**Python Hello World:**\n\n```python\nprint('Hello, World!')\n```";
    }
    if (t.includes("hello world") && t.includes("javascript")) {
      return "**JavaScript Hello World:**\n\n```javascript\nconsole.log('Hello, World!');\n```";
    }
    if (t.includes("html") && (t.includes("template") || t.includes("basic"))) {
      return "**Basic HTML Template:**\n\n```html\n<!DOCTYPE html>\n<html lang=\"hi\">\n<head>\n  <meta charset=\"UTF-8\">\n  <title>Meri Website</title>\n</head>\n<body>\n  <h1>Namaste Duniya!</h1>\n</body>\n</html>\n```";
    }
    return `💡 **Code Assistance:**\n\nMain ek local AI assistant hoon. Aap jo code chahte hain uske baare mein aur detail mein batayein aur main koshish karoonga help karne ki!\n\n*Tip: Agar aap local AI model (Ollama) use karte hain to main aur behtar code help kar sakta hoon.*`;
  },

  // ── Custom Knowledge Base search ──────────────────────────
  searchCustomKB(text) {
    const entries = Storage.getKBEntries();
    if (!entries.length) return null;
    const t = text.toLowerCase();
    for (const entry of entries) {
      const keywords = (entry.keywords || "").toLowerCase().split(",").map(k => k.trim());
      const matches = keywords.filter(k => k && t.includes(k));
      if (matches.length > 0) return entry.answer;
      if (t.includes(entry.question.toLowerCase().substring(0, 10))) return entry.answer;
    }
    return null;
  },

  // ── Fallback responses ────────────────────────────────────
  getFallbackResponse(text) {
    const responses = [
      `Aapka sawaal samajh aa gaya, lekin mujhe iska exact jawab nahi pata. 🤔\n\nKuch suggestions:\n- Aur detail mein batayein\n- Tools panel try karein (🔧)\n- Ya FAQ check karein`,
      `Interesting sawaal! 💭 Main ek offline AI hoon isliye meri knowledge limited hai.\n\n**Main yeh kar sakta hoon:**\n- ✅ FAQ answers\n- ✅ Calculator & tools\n- ✅ Date/time\n- ✅ File reading\n\nKya main kisi tool se help kar sakta hoon?`,
      `Hmm, yeh meri knowledge ke bahar hai. 😅\n\nKya aap yeh try karna chahenge:\n1. Tools panel (🔧 icon)\n2. PDF reader mein koi document\n3. Ya mujhse koi aur sawaal?`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  },

  // ── Text tools ────────────────────────────────────────────
  wordCount(text) {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    return {
      words: words.length,
      characters: text.length,
      charactersNoSpace: text.replace(/\s/g, "").length,
      sentences: text.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
      paragraphs: text.split(/\n\n+/).filter(p => p.trim().length > 0).length,
      readingTime: Math.ceil(words.length / 200)
    };
  },

  convertCase(text, type) {
    switch (type) {
      case "upper": return text.toUpperCase();
      case "lower": return text.toLowerCase();
      case "title": return text.replace(/\b\w/g, c => c.toUpperCase());
      case "sentence": return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
      case "camel": return text.replace(/(?:^\w|[A-Z]|\b\w)/g, (w, i) => i === 0 ? w.toLowerCase() : w.toUpperCase()).replace(/\s+/g, "");
      case "snake": return text.toLowerCase().replace(/\s+/g, "_");
      case "kebab": return text.toLowerCase().replace(/\s+/g, "-");
      default: return text;
    }
  },

  generatePassword(length = 16, options = {}) {
    const { upper = true, lower = true, numbers = true, symbols = true } = options;
    let chars = "";
    if (upper) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (lower) chars += "abcdefghijklmnopqrstuvwxyz";
    if (numbers) chars += "0123456789";
    if (symbols) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?";
    if (!chars) chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  },

  formatJSON(text) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch (e) {
      return "Invalid JSON: " + e.message;
    }
  },

  unitConvert(value, from, to, category) {
    const conversions = {
      length: {
        m: 1, km: 0.001, cm: 100, mm: 1000, ft: 3.28084, inch: 39.3701, mile: 0.000621371
      },
      weight: {
        kg: 1, g: 1000, lb: 2.20462, oz: 35.274, ton: 0.001
      },
      temperature: "special",
      speed: {
        "m/s": 1, "km/h": 3.6, mph: 2.23694, knot: 1.94384
      },
      data: {
        b: 1, kb: 0.001, mb: 0.000001, gb: 1e-9, tb: 1e-12
      }
    };

    if (category === "temperature") {
      const v = parseFloat(value);
      if (from === "c" && to === "f") return (v * 9/5 + 32).toFixed(2);
      if (from === "f" && to === "c") return ((v - 32) * 5/9).toFixed(2);
      if (from === "c" && to === "k") return (v + 273.15).toFixed(2);
      if (from === "k" && to === "c") return (v - 273.15).toFixed(2);
      return v.toFixed(2);
    }

    const conv = conversions[category];
    if (!conv) return "Unknown category";
    const baseValue = parseFloat(value) / (conv[from] || 1);
    return (baseValue * (conv[to] || 1)).toFixed(6);
  }
};

window.AI = AI;
