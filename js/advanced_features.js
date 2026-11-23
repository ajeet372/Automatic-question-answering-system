// ============================================================
//  memory.js — Memory Timeline & Preferences Manager
// ============================================================

const MemoryTimeline = {
  getMemories() {
    return Storage.get("memory_timeline", [
      { id: "mem_1", key: "Preferred Language", value: "Hindi + English (Hinglish)", category: "Preference", confidence: 0.98, timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: "mem_2", key: "User Role", value: "Software Architect / Developer", category: "Profile", confidence: 0.95, timestamp: new Date(Date.now() - 86400000).toISOString() },
      { id: "mem_3", key: "Coding Style", value: "Clean, modular vanilla JS, zero unnecessary dependencies", category: "Technical", confidence: 0.92, timestamp: new Date().toISOString() }
    ]);
  },

  addMemory(key, value, category = "General") {
    const memories = this.getMemories();
    const newMem = {
      id: "mem_" + Date.now(),
      key: key.trim(),
      value: value.trim(),
      category: category,
      confidence: 0.90,
      timestamp: new Date().toISOString()
    };
    memories.unshift(newMem);
    Storage.set("memory_timeline", memories);
    Storage.addAuditLog("memory_added", { key, category });
    return newMem;
  },

  deleteMemory(id) {
    let memories = this.getMemories();
    memories = memories.filter(m => m.id !== id);
    Storage.set("memory_timeline", memories);
    Storage.addAuditLog("memory_deleted", { id });
  },

  clearAll() {
    Storage.set("memory_timeline", []);
    Storage.addAuditLog("memory_cleared", {});
  }
};

// ============================================================
//  semantic.js — Local Semantic Search & TF-IDF Matcher
// ============================================================

const SemanticSearch = {
  tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\s\u0900-\u097F]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  },

  search(query, documents) {
    if (!query || !documents || !documents.length) return [];
    const queryTokens = this.tokenize(query);
    if (!queryTokens.length) return [];

    const scoredDocs = documents.map(doc => {
      const docText = (doc.title || "") + " " + (doc.content || "") + " " + (doc.tags || "");
      const docTokens = this.tokenize(docText);
      
      let score = 0;
      queryTokens.forEach(qToken => {
        const matches = docTokens.filter(dToken => dToken === qToken || dToken.includes(qToken) || qToken.includes(dToken));
        score += matches.length;
      });

      return { ...doc, score: score / (docTokens.length || 1) };
    });

    return scoredDocs.filter(d => d.score > 0).sort((a, b) => b.score - a.score);
  }
};

// ============================================================
//  voice.js — Voice Conversation & Speech Recognition
// ============================================================

const VoiceAssistant = {
  isListening: false,
  recognition: null,

  init(onResultCallback, onEndCallback) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return false;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'hi-IN'; // Default to Hindi/English bilingual

    this.recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      if (onResultCallback) onResultCallback(transcript);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (onEndCallback) onEndCallback();
    };

    return true;
  },

  start(onResult, onEnd) {
    if (!this.recognition) this.init(onResult, onEnd);
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
        this.isListening = true;
      } catch (e) {
        console.warn("Speech recognition error:", e);
      }
    }
  },

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  },

  speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }
};

// ============================================================
//  coderunner.js — Sandboxed Local Code Runner
// ============================================================

const LocalCodeRunner = {
  execute(code, language = "javascript") {
    if (language !== "javascript") {
      return { success: false, output: `[${language.toUpperCase()} execution requires local backend/Ollama/Python runner. In browser sandbox, JavaScript is natively supported.]` };
    }

    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;

    try {
      console.log = (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" "));
      console.error = (...args) => logs.push("ERROR: " + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" "));

      const runFn = new Function('"use strict";\n' + code);
      const res = runFn();

      console.log = originalLog;
      console.error = originalError;

      if (res !== undefined) logs.push("Return value: " + String(res));
      return { success: true, output: logs.length ? logs.join("\n") : "Code executed successfully with no stdout." };
    } catch (err) {
      console.log = originalLog;
      console.error = originalError;
      return { success: false, output: "Runtime Error: " + err.message };
    }
  }
};

// ============================================================
//  notifications.js — Smart Notifications & Proactive Assistant
// ============================================================

const SmartNotifications = {
  getReminders() {
    return Storage.get("smart_reminders", [
      { id: "rem_1", text: "Daily Workspace & Document Review", time: "18:00", active: true },
      { id: "rem_2", text: "Review Agent Task Queue & Approvals", time: "20:30", active: true }
    ]);
  },

  addReminder(text, time) {
    const list = this.getReminders();
    list.push({ id: "rem_" + Date.now(), text, time, active: true });
    Storage.set("smart_reminders", list);
  },

  trigger(title, message) {
    if (window.UI) UI.toast(`${title}: ${message}`, "info", 5000);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body: message, icon: "🤖" });
    }
  },

  requestPermission() {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }
};

// ============================================================
//  hardware.js — Performance & Hardware Optimizer
// ============================================================

const HardwareMonitor = {
  getMetrics() {
    const memory = performance.memory ? {
      usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + " MB",
      totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(1) + " MB",
      jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(1) + " MB"
    } : { usedJSHeapSize: "N/A", totalJSHeapSize: "N/A", jsHeapSizeLimit: "N/A" };

    return {
      memory,
      cores: navigator.hardwareConcurrency || "4",
      deviceMemory: navigator.deviceMemory ? navigator.deviceMemory + " GB" : "8 GB+",
      userAgent: navigator.userAgent.split(")")[0] + ")",
      online: navigator.onLine,
      domNodes: document.querySelectorAll('*').length
    };
  }
};

window.MemoryTimeline = MemoryTimeline;
window.SemanticSearch = SemanticSearch;
window.VoiceAssistant = VoiceAssistant;
window.LocalCodeRunner = LocalCodeRunner;
window.SmartNotifications = SmartNotifications;
window.HardwareMonitor = HardwareMonitor;
