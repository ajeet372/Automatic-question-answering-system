// ============================================================
//  ui.js — UI helpers: theme, animations, toast, modals
// ============================================================

const UI = {

  // ── Theme ─────────────────────────────────────────────────
  applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.className = theme === "dark" ? "dark" : "";
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
    Storage.updateSettings({ theme });
  },

  toggleTheme() {
    const current = Storage.getSettings().theme || "dark";
    this.applyTheme(current === "dark" ? "light" : "dark");
  },

  // ── Toast notifications ───────────────────────────────────
  toast(message, type = "info", duration = 3000) {
    const container = document.getElementById("toastContainer") || this.createToastContainer();
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icons = { info: "ℹ️", success: "✅", error: "❌", warning: "⚠️" };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || "ℹ️"}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  createToastContainer() {
    const div = document.createElement("div");
    div.id = "toastContainer";
    div.className = "toast-container";
    document.body.appendChild(div);
    return div;
  },

  // ── Typing animation ──────────────────────────────────────
  async typeText(element, text, speed = 20) {
    element.textContent = "";
    for (let i = 0; i < text.length; i++) {
      element.textContent += text[i];
      if (i % 3 === 0) await this.sleep(speed);
    }
  },

  async typeMarkdown(element, markdown, speed = 15) {
    // For short text, type it; for long, render immediately
    if (markdown.length < 300) {
      let typed = "";
      element.innerHTML = "";
      for (let i = 0; i < markdown.length; i++) {
        typed += markdown[i];
        element.innerHTML = this.renderMarkdown(typed);
        if (i % 5 === 0) await this.sleep(speed);
      }
    } else {
      element.innerHTML = this.renderMarkdown(markdown);
    }
    // Apply syntax highlighting
    element.querySelectorAll("pre code").forEach(block => {
      if (window.hljs) hljs.highlightElement(block);
    });
  },

  renderMarkdown(text) {
    if (window.marked) {
      try {
        return marked.parse(text, { breaks: true, gfm: true });
      } catch (e) {}
    }
    // Fallback basic rendering
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");
  },

  // ── Modal ─────────────────────────────────────────────────
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }
  },

  closeAllModals() {
    document.querySelectorAll(".modal.active").forEach(m => {
      m.classList.remove("active");
    });
    document.body.style.overflow = "";
  },

  // ── Confirm dialog ────────────────────────────────────────
  confirm(message) {
    return new Promise(resolve => {
      const modal = document.createElement("div");
      modal.className = "modal active confirm-modal";
      modal.innerHTML = `
        <div class="modal-content confirm-content">
          <p>${message}</p>
          <div class="confirm-btns">
            <button class="btn btn-danger" id="confirmYes">Haan, Delete Karo</button>
            <button class="btn btn-ghost" id="confirmNo">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector("#confirmYes").onclick = () => { modal.remove(); resolve(true); };
      modal.querySelector("#confirmNo").onclick = () => { modal.remove(); resolve(false); };
      modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(false); } };
    });
  },

  // ── Format helpers ────────────────────────────────────────
  formatDate(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return "Abhi";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min pehle`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ghante pehle`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} din pehle`;
    return d.toLocaleDateString("hi-IN");
  },

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // ── Copy to clipboard ─────────────────────────────────────
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.toast("Copied to clipboard! 📋", "success", 2000);
      return true;
    } catch (e) {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      ta.remove();
      this.toast("Copied! 📋", "success", 2000);
      return true;
    }
  },

  // ── Sidebar toggle ────────────────────────────────────────
  toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (sidebar) {
      if (window.innerWidth <= 768) {
        const isOpen = sidebar.classList.toggle("open");
        if (overlay) overlay.classList.toggle("show", isOpen);
      } else {
        sidebar.classList.toggle("collapsed");
      }
    }
  },

  closeSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("show");
  },

  // ── Scroll to bottom ──────────────────────────────────────
  scrollToBottom(elementId = "chatMessages") {
    const el = document.getElementById(elementId);
    if (el) el.scrollTop = el.scrollHeight;
  },

  // ── Auto-resize textarea ──────────────────────────────────
  autoResize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
  }
};

window.UI = UI;
