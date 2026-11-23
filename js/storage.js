// ============================================================
//  storage.js — localStorage wrapper with namespacing
// ============================================================

const Storage = {
  PREFIX: "aj_ai_",

  set(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error("Storage set error:", e);
    }
  },

  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(this.PREFIX + key);
      return item !== null ? JSON.parse(item) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },

  remove(key) {
    localStorage.removeItem(this.PREFIX + key);
  },

  clear(prefix = "") {
    const keys = Object.keys(localStorage).filter(k =>
      k.startsWith(this.PREFIX + prefix)
    );
    keys.forEach(k => localStorage.removeItem(k));
  },

  // ── Conversations ─────────────────────────────────────────
  getConversations() {
    return this.get("conversations", []);
  },

  saveConversations(convs) {
    this.set("conversations", convs);
  },

  getConversation(id) {
    const convs = this.getConversations();
    return convs.find(c => c.id === id) || null;
  },

  saveConversation(conv) {
    const convs = this.getConversations();
    const idx = convs.findIndex(c => c.id === conv.id);
    if (idx >= 0) convs[idx] = conv;
    else convs.unshift(conv);
    this.saveConversations(convs);
  },

  deleteConversation(id) {
    const convs = this.getConversations().filter(c => c.id !== id);
    this.saveConversations(convs);
    // Also remove messages
    this.remove("messages_" + id);
  },

  // ── Messages ──────────────────────────────────────────────
  getMessages(convId) {
    return this.get("messages_" + convId, []);
  },

  saveMessages(convId, messages) {
    this.set("messages_" + convId, messages);
  },

  addMessage(convId, message) {
    const messages = this.getMessages(convId);
    messages.push(message);
    this.saveMessages(convId, messages);
    return messages;
  },

  updateMessage(convId, msgId, updates) {
    const messages = this.getMessages(convId);
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx >= 0) {
      messages[idx] = { ...messages[idx], ...updates };
      this.saveMessages(convId, messages);
    }
    return messages;
  },

  deleteMessage(convId, msgId) {
    const messages = this.getMessages(convId).filter(m => m.id !== msgId);
    this.saveMessages(convId, messages);
    return messages;
  },

  // ── Settings ──────────────────────────────────────────────
  getSettings() {
    return this.get("settings", {
      appName: "AJ AI",
      theme: "dark",
      language: "hi",
      welcomeMessage: "Namaste! Main AJ AI hoon. Aap kya jaanna chahte hain? 😊",
      maxUploadMB: 10,
      historyRetentionDays: 30,
      primaryColor: "#6366f1",
      logoUrl: "",
      dateFormat: "DD/MM/YYYY",
      typingSpeed: 30
    });
  },

  updateSettings(updates) {
    const settings = this.getSettings();
    const newSettings = { ...settings, ...updates };
    this.set("settings", newSettings);
    return newSettings;
  },

  // ── Analytics ─────────────────────────────────────────────
  getAnalytics() {
    return this.get("analytics", {
      totalMessages: 0,
      totalConversations: 0,
      featureUsage: {},
      dailyStats: {},
      errors: []
    });
  },

  trackEvent(event, data = {}) {
    const analytics = this.getAnalytics();
    const today = new Date().toISOString().split("T")[0];
    if (!analytics.dailyStats[today]) {
      analytics.dailyStats[today] = { messages: 0, conversations: 0, features: {} };
    }
    if (event === "message") {
      analytics.totalMessages++;
      analytics.dailyStats[today].messages++;
    }
    if (event === "conversation") {
      analytics.totalConversations++;
      analytics.dailyStats[today].conversations++;
    }
    if (event === "feature") {
      analytics.featureUsage[data.name] = (analytics.featureUsage[data.name] || 0) + 1;
      analytics.dailyStats[today].features[data.name] = (analytics.dailyStats[today].features[data.name] || 0) + 1;
    }
    if (event === "error") {
      analytics.errors.push({ time: new Date().toISOString(), ...data });
      if (analytics.errors.length > 100) analytics.errors.shift();
    }
    this.set("analytics", analytics);
  },

  // ── Admin ─────────────────────────────────────────────────
  getUsers() {
    return this.get("users", [
      {
        id: "admin_1",
        name: "Admin",
        email: "admin@ajai.local",
        role: "admin",
        status: "active",
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        usageLimit: -1,
        messageCount: 0
      }
    ]);
  },

  saveUsers(users) {
    this.set("users", users);
  },

  getAdminPassword() {
    return this.get("admin_pass", btoa("admin123"));
  },

  setAdminPassword(pass) {
    this.set("admin_pass", btoa(pass));
  },

  // ── Features ──────────────────────────────────────────────
  getFeatures() {
    return this.get("features", {
      textChat: { enabled: true, roles: ["all"], limit: -1 },
      chatHistory: { enabled: true, roles: ["all"], limit: -1 },
      fileUpload: { enabled: true, roles: ["all"], limit: 10 },
      pdfReader: { enabled: true, roles: ["all"], limit: -1 },
      imageUnderstanding: { enabled: false, roles: ["admin"], limit: -1 },
      localAIModel: { enabled: true, roles: ["all"], limit: -1 },
      voiceInput: { enabled: false, roles: ["all"], limit: -1 },
      textToSpeech: { enabled: false, roles: ["all"], limit: -1 },
      codeAssistant: { enabled: true, roles: ["all"], limit: -1 },
      calculatorTools: { enabled: true, roles: ["all"], limit: -1 },
      imageGeneration: { enabled: false, roles: ["admin"], limit: -1 },
      webSearch: { enabled: false, roles: ["admin"], limit: -1 }
    });
  },

  saveFeatures(features) {
    this.set("features", features);
  },

  // ── Knowledge Base ────────────────────────────────────────
  getKBEntries() {
    return this.get("kb_entries", []);
  },

  saveKBEntries(entries) {
    this.set("kb_entries", entries);
  },

  // ── Audit Log ─────────────────────────────────────────────
  addAuditLog(action, details = {}) {
    const logs = this.get("audit_log", []);
    logs.unshift({
      id: Date.now().toString(),
      time: new Date().toISOString(),
      action,
      details
    });
    if (logs.length > 500) logs.pop();
    this.set("audit_log", logs);
  },

  getAuditLog() {
    return this.get("audit_log", []);
  }
};

window.Storage = Storage;
