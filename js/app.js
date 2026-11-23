// ============================================================
//  app.js — Main application initialization & settings modal
// ============================================================

const App = {

  init() {
    // Apply saved theme
    const settings = Storage.getSettings();
    UI.applyTheme(settings.theme || "dark");

    // Apply branding
    this.applyBranding();

    // Init chat
    Chat.init();

    // Event listeners
    this.bindEvents();

    // Tools panel init
    ToolsPanel.updateUnitOptions();
    ToolsPanel.renderNotes();

    console.log("AJ AI initialized ✅");
  },

  applyBranding() {
    const settings = Storage.getSettings();
    // App name
    document.querySelectorAll(".app-name-text").forEach(el => {
      el.textContent = settings.appName || "AJ AI";
    });
    document.title = settings.appName || "AJ AI";
    // Primary color
    if (settings.primaryColor) {
      document.documentElement.style.setProperty("--primary", settings.primaryColor);
    }
  },

  bindEvents() {
    // Send message on Enter (Shift+Enter = newline)
    const input = document.getElementById("chatInput");
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
      input.addEventListener("input", () => UI.autoResize(input));
    }

    // Search conversations
    const searchInput = document.getElementById("convSearch");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        Chat.searchConversations(e.target.value);
      });
    }

    // Close modals on backdrop click
    document.querySelectorAll(".modal").forEach(modal => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) UI.closeModal(modal.id);
      });
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "k") { e.preventDefault(); document.getElementById("convSearch")?.focus(); }
      if (e.ctrlKey && e.key === "n") { e.preventDefault(); Chat.newConversation(); }
      if (e.key === "Escape") { UI.closeAllModals(); ToolsPanel.close(); }
    });
  },

  sendMessage() {
    const input = document.getElementById("chatInput");
    if (input && input.value.trim()) {
      Chat.sendMessage(input.value);
    }
  },

  // ── Settings Modal ────────────────────────────────────────
  openSettings() {
    this.populateSettings();
    UI.openModal("settingsModal");
  },

  populateSettings() {
    const settings = Storage.getSettings();
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    setVal("setAppName", settings.appName);
    setVal("setWelcomeMsg", settings.welcomeMessage);
    setVal("setPrimaryColor", settings.primaryColor);
    setVal("setMaxUpload", settings.maxUploadMB);
    setVal("setTypingSpeed", settings.typingSpeed);
    setVal("setRetentionDays", settings.historyRetentionDays);
    setVal("setDateFormat", settings.dateFormat);
    setVal("setLanguage", settings.language);
    setVal("setThemeSelect", settings.theme);
  },

  saveSettings() {
    const getVal = (id) => document.getElementById(id)?.value;
    const updates = {
      appName: getVal("setAppName") || "AJ AI",
      welcomeMessage: getVal("setWelcomeMsg") || "Namaste!",
      primaryColor: getVal("setPrimaryColor") || "#6366f1",
      maxUploadMB: parseInt(getVal("setMaxUpload") || 10),
      typingSpeed: parseInt(getVal("setTypingSpeed") || 15),
      historyRetentionDays: parseInt(getVal("setRetentionDays") || 30),
      dateFormat: getVal("setDateFormat") || "DD/MM/YYYY",
      language: getVal("setLanguage") || "hi",
      theme: getVal("setThemeSelect") || "dark"
    };

    Storage.updateSettings(updates);
    UI.applyTheme(updates.theme);
    this.applyBranding();
    document.documentElement.style.setProperty("--primary", updates.primaryColor);
    Storage.addAuditLog("settings_updated", { by: "user" });
    UI.closeModal("settingsModal");
    UI.toast("Settings save ho gayi! ✅", "success");
  },

  switchSettingsTab(tab) {
    document.querySelectorAll(".modal-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    document.querySelectorAll(".modal-tab-content").forEach(c => c.classList.toggle("active", c.dataset.tab === tab));
  },

  // ── Export all data ───────────────────────────────────────
  exportAllData() {
    const data = {
      settings: Storage.getSettings(),
      conversations: Storage.getConversations(),
      notes: Storage.get("notes", []),
      features: Storage.getFeatures(),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "aj_ai_backup.json";
    a.click();
    UI.toast("Data exported! 📦", "success");
  },

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.settings) Storage.updateSettings(data.settings);
        if (data.conversations) Storage.saveConversations(data.conversations);
        if (data.notes) Storage.set("notes", data.notes);
        if (data.features) Storage.saveFeatures(data.features);
        UI.applyTheme(data.settings?.theme || "dark");
        this.applyBranding();
        Chat.init();
        UI.toast("Data imported successfully! 🎉", "success");
      } catch (err) {
        UI.toast("Import failed: Invalid file", "error");
      }
    };
    reader.readAsText(file);
  },

  resetAllData() {
    UI.confirm("⚠️ Saara data delete ho jaayega. Kya aap sure hain?").then(confirmed => {
      if (confirmed) {
        Storage.clear();
        window.location.reload();
      }
    });
  }
};

// ── Initialize on DOM ready ───────────────────────────────────
document.addEventListener("DOMContentLoaded", () => App.init());

window.App = App;
