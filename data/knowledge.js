// ============================================================
//  knowledge.js — FAQ Knowledge Base & Decision Tree
//  Predefined Q&A, keywords, and offline response data
// ============================================================

const KnowledgeBase = {

  // ── FAQ entries ──────────────────────────────────────────
  faqs: [
    {
      id: "faq_1",
      category: "General",
      question: "Yeh app kya hai?",
      keywords: ["app", "kya", "what", "chatbot", "about"],
      answer: "Yeh ek offline AI-powered chatbot app hai jisme chat, tools, file reading aur admin panel sab kuch ek hi jagah milta hai."
    },
    {
      id: "faq_2",
      category: "General",
      question: "Kya yeh app internet ke bina kaam karta hai?",
      keywords: ["offline", "internet", "online", "network", "bina"],
      answer: "Haan! Yeh app poori tarah offline kaam karta hai. Aapka data sirf aapke device par store hota hai."
    },
    {
      id: "faq_3",
      category: "Chat",
      question: "Chat history kahan save hoti hai?",
      keywords: ["history", "save", "store", "data", "kahan"],
      answer: "Aapki chat history browser ke localStorage mein save hoti hai. Yeh sirf aapke browser mein rehti hai aur kisi server par nahi jaati."
    },
    {
      id: "faq_4",
      category: "Chat",
      question: "Message kaise delete karein?",
      keywords: ["delete", "remove", "message", "hatao"],
      answer: "Kisi bhi message par hover karein, phir message ke upar aayi delete button (🗑️) par click karein. Confirm karne par message delete ho jaayega."
    },
    {
      id: "faq_5",
      category: "Chat",
      question: "Kya main markdown use kar sakta hoon?",
      keywords: ["markdown", "bold", "italic", "format", "code"],
      answer: "Bilkul! Aap markdown use kar sakte hain:\n- **Bold** ke liye `**text**`\n- *Italic* ke liye `*text*`\n- Code ke liye backticks `` `code` ``\n- Table bhi support hai!"
    },
    {
      id: "faq_6",
      category: "Tools",
      question: "Calculator kaise use karein?",
      keywords: ["calculator", "calculate", "math", "calculation", "jod", "ghatao"],
      answer: "Tools panel mein jaayein (🔧 icon), phir Calculator tab select karein. Basic aur scientific calculations support hain."
    },
    {
      id: "faq_7",
      category: "Tools",
      question: "PDF kaise read karein?",
      keywords: ["pdf", "read", "extract", "file", "document"],
      answer: "Tools panel mein File Reader tab mein jaayein, phir PDF file upload karein. App automatically text extract kar dega jo aap copy kar sakte hain."
    },
    {
      id: "faq_8",
      category: "Tools",
      question: "Password kaise generate karein?",
      keywords: ["password", "generate", "strong", "secure"],
      answer: "Tools mein Password Generator section mein length aur character types select karein, phir Generate button click karein."
    },
    {
      id: "faq_9",
      category: "Settings",
      question: "Dark mode kaise on karein?",
      keywords: ["dark", "light", "mode", "theme", "night", "raat"],
      answer: "Top right corner mein 🌙/☀️ icon click karein ya Settings mein jaake Theme toggle karein. Aapki preference save ho jaayegi."
    },
    {
      id: "faq_10",
      category: "Admin",
      question: "Admin panel kaise access karein?",
      keywords: ["admin", "panel", "dashboard", "login", "access"],
      answer: "Admin panel ke liye admin.html open karein. Default password: **admin123** (pehle login ke baad zaroor change karein)."
    },
    {
      id: "faq_11",
      category: "General",
      question: "Hello / Hi",
      keywords: ["hello", "hi", "hey", "hii", "namaste", "namaskar", "salam", "assalam"],
      answer: "Hello! 👋 Main aapka AI assistant hoon. Aap mujhse kuch bhi pooch sakte hain — chat, tools, ya koi bhi sawaal!"
    },
    {
      id: "faq_12",
      category: "General",
      question: "Aap kaisa hai?",
      keywords: ["kaisa", "kaise", "how are you", "theek", "fine"],
      answer: "Main bilkul theek hoon, shukriya poochne ke liye! 😊 Aap kaise hain? Aur main aapki kya madad kar sakta hoon?"
    },
    {
      id: "faq_13",
      category: "General",
      question: "Aapka naam kya hai?",
      keywords: ["naam", "name", "kaun", "who", "tumhara"],
      answer: "Main AJ AI hoon — aapka local, offline AI assistant! 🤖 Aap mujhe settings mein koi bhi naam de sakte hain."
    },
    {
      id: "faq_14",
      category: "General",
      question: "Shukriya / Thank you",
      keywords: ["shukriya", "thank", "thanks", "dhanyawad", "meherbani"],
      answer: "Aapka bhi shukriya! 😊 Koi aur madad chahiye to zaroor batayein."
    },
    {
      id: "faq_15",
      category: "General",
      question: "Alvida / Bye",
      keywords: ["bye", "alvida", "goodbye", "phir milenge", "baad mein"],
      answer: "Alvida! 👋 Jab bhi zaroorat ho, main yahan hoon. Take care!"
    }
  ],

  // ── Suggested prompts shown on new chat ──────────────────
  suggestedPrompts: [
    { icon: "🧮", text: "Calculator open karo", category: "tools" },
    { icon: "📄", text: "PDF se text extract karo", category: "files" },
    { icon: "🔑", text: "Secure password banao", category: "tools" },
    { icon: "📝", text: "Word count karo mere text ka", category: "tools" },
    { icon: "💬", text: "Aap kya kar sakte hain?", category: "general" },
    { icon: "🌙", text: "Dark mode on karo", category: "settings" },
    { icon: "🔄", text: "Unit convert karo", category: "tools" },
    { icon: "📅", text: "Aaj ki date aur time", category: "general" }
  ],

  // ── Decision tree for offline logic ──────────────────────
  decisionTree: {
    root: "start",
    nodes: {
      start: {
        question: "Aapko kisme madad chahiye?",
        options: [
          { label: "💬 Chat & Sawaal", next: "chat_help" },
          { label: "🔧 Tools & Utilities", next: "tools_help" },
          { label: "📁 Files", next: "files_help" },
          { label: "⚙️ Settings", next: "settings_help" }
        ]
      },
      chat_help: {
        question: "Chat ke baare mein aur batayein:",
        options: [
          { label: "📜 History save karna", answer: "faq_3" },
          { label: "🗑️ Message delete karna", answer: "faq_4" },
          { label: "✍️ Markdown use karna", answer: "faq_5" }
        ]
      },
      tools_help: {
        question: "Kaunsa tool use karna hai?",
        options: [
          { label: "🧮 Calculator", answer: "faq_6" },
          { label: "🔑 Password Generator", answer: "faq_8" },
          { label: "📄 PDF Reader", answer: "faq_7" }
        ]
      },
      files_help: {
        question: "Files ke baare mein:",
        options: [
          { label: "📄 PDF read karna", answer: "faq_7" },
          { label: "📝 Text file open karna", answer: "faq_7" }
        ]
      },
      settings_help: {
        question: "Settings mein kya change karna hai?",
        options: [
          { label: "🌙 Dark/Light Mode", answer: "faq_9" },
          { label: "👤 Admin Panel", answer: "faq_10" }
        ]
      }
    }
  },

  // ── Find answer by keywords ───────────────────────────────
  findAnswer(query) {
    if (!query) return null;
    const q = query.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;

    for (const faq of this.faqs) {
      let score = 0;
      for (const kw of faq.keywords) {
        if (q.includes(kw.toLowerCase())) score++;
      }
      // Also check partial question match
      if (q.includes(faq.question.toLowerCase().substring(0, 10))) score += 2;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = faq;
      }
    }
    return bestScore > 0 ? bestMatch : null;
  }
};

// Make globally available
window.KnowledgeBase = KnowledgeBase;
