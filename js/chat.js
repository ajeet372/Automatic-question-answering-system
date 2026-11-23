// ============================================================
//  chat.js — Chat engine: conversations, messages, rendering
// ============================================================

const Chat = {
  currentConvId: null,
  isTyping: false,

  // ── Initialization ────────────────────────────────────────
  init() {
    this.renderConversationList();
    const convs = Storage.getConversations();
    if (convs.length > 0) {
      this.loadConversation(convs[0].id);
    } else {
      this.newConversation();
    }
  },

  // ── Create new conversation ───────────────────────────────
  newConversation() {
    const id = UI.generateId();
    const conv = {
      id,
      title: "Naya Chat",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: false,
      archived: false,
      messageCount: 0
    };
    Storage.saveConversation(conv);
    Storage.trackEvent("conversation");
    this.loadConversation(id);
    this.renderConversationList();
    return id;
  },

  // ── Load a conversation ───────────────────────────────────
  loadConversation(id) {
    this.currentConvId = id;
    const messages = Storage.getMessages(id);
    this.renderMessages(messages);

    // Highlight active
    document.querySelectorAll(".conv-item").forEach(el => {
      el.classList.toggle("active", el.dataset.id === id);
    });

    // Show welcome / suggested prompts if empty
    const chatArea = document.getElementById("chatMessages");
    if (messages.length === 0 && chatArea) {
      this.renderSuggestedPrompts();
    }

    // Update title in header
    const conv = Storage.getConversation(id);
    const headerTitle = document.getElementById("chatTitle");
    if (headerTitle && conv) headerTitle.textContent = conv.title;
  },

  // ── Send a message ────────────────────────────────────────
  async sendMessage(text) {
    if (!text.trim() || this.isTyping) return;
    if (!this.currentConvId) this.newConversation();

    // Remove suggested prompts
    document.getElementById("suggestedPromptsContainer")?.remove();

    // Add user message
    const userMsg = {
      id: UI.generateId(),
      role: "user",
      content: text.trim(),
      timestamp: new Date().toISOString()
    };
    Storage.addMessage(this.currentConvId, userMsg);
    this.appendMessage(userMsg);
    Storage.trackEvent("message");

    // Auto-title conversation
    this.autoTitle(text);

    // Clear input
    const input = document.getElementById("chatInput");
    if (input) { input.value = ""; UI.autoResize(input); }

    // Show typing indicator
    this.isTyping = true;
    const typingEl = this.showTypingIndicator();

    try {
      // Get AI response
      const history = Storage.getMessages(this.currentConvId);
      const response = await AI.respond(text, history);

      // Remove typing indicator
      typingEl?.remove();
      this.isTyping = false;

      // Handle tool actions
      if (response.type === "tool" && response.action) {
        this.handleToolAction(response);
      }

      // Add AI message
      const aiMsg = {
        id: UI.generateId(),
        role: "assistant",
        content: response.content,
        timestamp: new Date().toISOString()
      };
      Storage.addMessage(this.currentConvId, aiMsg);
      this.appendMessage(aiMsg, true);
      Storage.trackEvent("message");

      // Update conversation
      const conv = Storage.getConversation(this.currentConvId);
      if (conv) {
        conv.updatedAt = new Date().toISOString();
        conv.messageCount = (conv.messageCount || 0) + 2;
        Storage.saveConversation(conv);
      }
      this.renderConversationList();

    } catch (err) {
      typingEl?.remove();
      this.isTyping = false;
      Storage.trackEvent("error", { message: err.message });
      UI.toast("Response mein error aaya. Try again karein.", "error");
    }
  },

  // ── Handle tool actions ───────────────────────────────────
  handleToolAction(response) {
    if (response.action === "openTool") {
      window.ToolsPanel?.open(response.tool);
    } else if (response.action === "setTheme") {
      UI.applyTheme(response.theme);
    } else if (response.action === "newChat") {
      this.newConversation();
    }
  },

  // ── Render all messages ───────────────────────────────────
  renderMessages(messages) {
    const container = document.getElementById("chatMessages");
    if (!container) return;
    container.innerHTML = "";
    messages.forEach(msg => this.appendMessage(msg, false));
    UI.scrollToBottom("chatMessages");
  },

  // ── Append single message ─────────────────────────────────
  appendMessage(msg, animate = false) {
    const container = document.getElementById("chatMessages");
    if (!container) return;

    const div = document.createElement("div");
    div.className = `message ${msg.role === "user" ? "message-user" : "message-ai"}`;
    div.dataset.id = msg.id;

    const avatar = msg.role === "user" ? "👤" : "🤖";
    const time = UI.formatDate(msg.timestamp);

    div.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-body">
        <div class="message-content" id="msg-${msg.id}"></div>
        <div class="message-footer">
          <span class="message-time">${time}</span>
          <div class="message-actions">
            <button class="msg-btn" onclick="Chat.copyMessage('${msg.id}')" title="Copy">📋</button>
            ${msg.role === "user" ? `<button class="msg-btn" onclick="Chat.editMessage('${msg.id}')" title="Edit">✏️</button>` : ""}
            <button class="msg-btn" onclick="Chat.deleteMessage('${msg.id}')" title="Delete">🗑️</button>
          </div>
        </div>
      </div>
    `;

    container.appendChild(div);

    const contentEl = div.querySelector(`#msg-${msg.id}`);
    if (animate && msg.role === "assistant") {
      UI.typeMarkdown(contentEl, msg.content, Storage.getSettings().typingSpeed || 15);
    } else {
      contentEl.innerHTML = UI.renderMarkdown(msg.content);
      contentEl.querySelectorAll("pre code").forEach(block => {
        if (window.hljs) hljs.highlightElement(block);
      });
    }

    UI.scrollToBottom("chatMessages");
  },

  // ── Typing indicator ──────────────────────────────────────
  showTypingIndicator() {
    const container = document.getElementById("chatMessages");
    if (!container) return null;
    const div = document.createElement("div");
    div.className = "message message-ai typing-indicator";
    div.id = "typingIndicator";
    div.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-body">
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    container.appendChild(div);
    UI.scrollToBottom("chatMessages");
    return div;
  },

  // ── Suggested prompts ─────────────────────────────────────
  renderSuggestedPrompts() {
    const container = document.getElementById("chatMessages");
    if (!container) return;

    const settings = Storage.getSettings();
    const wrapper = document.createElement("div");
    wrapper.id = "suggestedPromptsContainer";
    wrapper.className = "suggested-prompts-wrapper";

    const prompts = KnowledgeBase.suggestedPrompts;
    wrapper.innerHTML = `
      <div class="welcome-msg">
        <div class="welcome-icon">🤖</div>
        <h2>${settings.appName || "AJ AI"}</h2>
        <p>${settings.welcomeMessage || "Namaste! Aap kya jaanna chahte hain?"}</p>
      </div>
      <div class="suggested-prompts">
        ${prompts.map(p => `
          <button class="prompt-chip" onclick="Chat.sendMessage('${p.text}')">
            <span class="prompt-icon">${p.icon}</span>
            <span>${p.text}</span>
          </button>
        `).join("")}
      </div>
    `;
    container.appendChild(wrapper);
  },

  // ── Message actions ───────────────────────────────────────
  async copyMessage(msgId) {
    const messages = Storage.getMessages(this.currentConvId);
    const msg = messages.find(m => m.id === msgId);
    if (msg) await UI.copyToClipboard(msg.content);
  },

  async editMessage(msgId) {
    const messages = Storage.getMessages(this.currentConvId);
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const newText = prompt("Message edit karein:", msg.content);
    if (newText && newText !== msg.content) {
      Storage.updateMessage(this.currentConvId, msgId, { content: newText, edited: true });
      const contentEl = document.querySelector(`#msg-${msgId}`);
      if (contentEl) {
        contentEl.innerHTML = UI.renderMarkdown(newText);
      }
      UI.toast("Message updated! ✏️", "success");
    }
  },

  async deleteMessage(msgId) {
    const confirmed = await UI.confirm("Kya aap is message ko delete karna chahte hain?");
    if (confirmed) {
      Storage.deleteMessage(this.currentConvId, msgId);
      const msgEl = document.querySelector(`[data-id="${msgId}"]`);
      if (msgEl) {
        msgEl.style.opacity = "0";
        setTimeout(() => msgEl.remove(), 300);
      }
      UI.toast("Message deleted! 🗑️", "success");
    }
  },

  // ── Conversation management ───────────────────────────────
  autoTitle(firstMessage) {
    const conv = Storage.getConversation(this.currentConvId);
    if (!conv || conv.title !== "Naya Chat") return;
    const title = firstMessage.length > 40
      ? firstMessage.substring(0, 40) + "..."
      : firstMessage;
    conv.title = title;
    conv.updatedAt = new Date().toISOString();
    Storage.saveConversation(conv);
    const headerTitle = document.getElementById("chatTitle");
    if (headerTitle) headerTitle.textContent = title;
  },

  renameConversation(id) {
    const conv = Storage.getConversation(id);
    if (!conv) return;
    const newTitle = prompt("Naya naam dein:", conv.title);
    if (newTitle && newTitle.trim()) {
      conv.title = newTitle.trim();
      Storage.saveConversation(conv);
      this.renderConversationList();
      if (id === this.currentConvId) {
        const headerTitle = document.getElementById("chatTitle");
        if (headerTitle) headerTitle.textContent = conv.title;
      }
      UI.toast("Chat renamed! ✏️", "success");
    }
  },

  pinConversation(id) {
    const conv = Storage.getConversation(id);
    if (!conv) return;
    conv.pinned = !conv.pinned;
    Storage.saveConversation(conv);
    this.renderConversationList();
    UI.toast(conv.pinned ? "Chat pinned! 📌" : "Chat unpinned!", "success");
  },

  archiveConversation(id) {
    const conv = Storage.getConversation(id);
    if (!conv) return;
    conv.archived = !conv.archived;
    Storage.saveConversation(conv);
    this.renderConversationList();
    UI.toast(conv.archived ? "Chat archived! 📦" : "Chat unarchived!", "success");
  },

  async deleteConversation(id) {
    const confirmed = await UI.confirm("Kya aap is conversation ko permanently delete karna chahte hain?");
    if (confirmed) {
      Storage.deleteConversation(id);
      if (this.currentConvId === id) {
        const convs = Storage.getConversations().filter(c => !c.archived);
        if (convs.length > 0) this.loadConversation(convs[0].id);
        else this.newConversation();
      }
      this.renderConversationList();
      UI.toast("Chat deleted! 🗑️", "success");
    }
  },

  // ── Render sidebar conversation list ─────────────────────
  renderConversationList(filter = "") {
    const list = document.getElementById("convList");
    if (!list) return;

    let convs = Storage.getConversations();

    // Search filter
    if (filter) {
      convs = convs.filter(c =>
        c.title.toLowerCase().includes(filter.toLowerCase())
      );
    }

    // Sort: pinned first, then by date
    const pinned = convs.filter(c => c.pinned && !c.archived);
    const regular = convs.filter(c => !c.pinned && !c.archived);
    const archived = convs.filter(c => c.archived);

    list.innerHTML = "";

    if (pinned.length > 0) {
      list.innerHTML += `<div class="conv-section-label">📌 Pinned</div>`;
      pinned.forEach(c => list.appendChild(this.createConvItem(c)));
    }

    if (regular.length > 0) {
      if (pinned.length > 0) list.innerHTML += `<div class="conv-section-label">💬 Chats</div>`;
      regular.forEach(c => list.appendChild(this.createConvItem(c)));
    }

    if (archived.length > 0) {
      list.innerHTML += `<div class="conv-section-label">📦 Archived</div>`;
      archived.forEach(c => list.appendChild(this.createConvItem(c)));
    }

    if (convs.length === 0) {
      list.innerHTML = `<div class="conv-empty">Koi chat nahi mila</div>`;
    }
  },

  createConvItem(conv) {
    const div = document.createElement("div");
    div.className = `conv-item ${conv.id === this.currentConvId ? "active" : ""} ${conv.archived ? "archived" : ""}`;
    div.dataset.id = conv.id;

    div.innerHTML = `
      <div class="conv-item-info" onclick="Chat.loadConversation('${conv.id}')">
        <span class="conv-title">${conv.pinned ? "📌 " : ""}${conv.title}</span>
        <span class="conv-time">${UI.formatDate(conv.updatedAt)}</span>
      </div>
      <div class="conv-actions">
        <button onclick="Chat.showConvMenu('${conv.id}', event)" class="conv-menu-btn">⋯</button>
      </div>
    `;
    return div;
  },

  showConvMenu(id, event) {
    event.stopPropagation();
    // Remove existing menus
    document.querySelectorAll(".conv-context-menu").forEach(m => m.remove());

    const conv = Storage.getConversation(id);
    const menu = document.createElement("div");
    menu.className = "conv-context-menu";
    menu.innerHTML = `
      <button onclick="Chat.renameConversation('${id}')">✏️ Rename</button>
      <button onclick="Chat.pinConversation('${id}')">${conv?.pinned ? "📌 Unpin" : "📌 Pin"}</button>
      <button onclick="Chat.archiveConversation('${id}')">${conv?.archived ? "📤 Unarchive" : "📦 Archive"}</button>
      <button onclick="Chat.exportConversation('${id}')">📥 Export</button>
      <button onclick="Chat.deleteConversation('${id}')" class="danger">🗑️ Delete</button>
    `;

    document.body.appendChild(menu);
    const rect = event.target.getBoundingClientRect();
    menu.style.top = rect.bottom + "px";
    menu.style.left = rect.left + "px";

    // Close on outside click
    setTimeout(() => {
      document.addEventListener("click", () => menu.remove(), { once: true });
    }, 10);
  },

  exportConversation(id) {
    const conv = Storage.getConversation(id);
    const messages = Storage.getMessages(id);
    let text = `# ${conv?.title || "Chat"}\n`;
    text += `Export Date: ${new Date().toLocaleDateString("hi-IN")}\n\n`;
    messages.forEach(m => {
      text += `**${m.role === "user" ? "Aap" : "AI"}** (${UI.formatDate(m.timestamp)}):\n${m.content}\n\n`;
    });

    const blob = new Blob([text], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${conv?.title || "chat"}.md`;
    a.click();
    UI.toast("Chat exported! 📥", "success");
  },

  // ── Search ────────────────────────────────────────────────
  searchConversations(query) {
    this.renderConversationList(query);
  },

  // ── Clear current chat ────────────────────────────────────
  async clearCurrentChat() {
    const confirmed = await UI.confirm("Kya aap is chat ke saare messages delete karna chahte hain?");
    if (confirmed) {
      Storage.saveMessages(this.currentConvId, []);
      this.renderMessages([]);
      this.renderSuggestedPrompts();
      UI.toast("Chat cleared! 🧹", "success");
    }
  }
};

window.Chat = Chat;
