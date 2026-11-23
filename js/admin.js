// ============================================================
//  admin.js — Admin Panel Logic
// ============================================================

const Admin = {
  currentPage: "dashboard",
  sessionKey: "aj_admin_session",

  // ── Auth ──────────────────────────────────────────────────
  checkAuth() {
    return sessionStorage.getItem(this.sessionKey) === "1";
  },

  login() {
    const pass = document.getElementById("adminPass")?.value || "";
    const stored = Storage.getAdminPassword();
    if (btoa(pass) === stored) {
      sessionStorage.setItem(this.sessionKey, "1");
      Storage.addAuditLog("admin_login", { status: "success" });
      document.getElementById("loginScreen").style.display = "none";
      document.getElementById("adminApp").style.display = "flex";
      this.init();
    } else {
      const errEl = document.getElementById("loginError");
      if (errEl) { errEl.textContent = "❌ Galat password!"; errEl.style.display = "block"; }
      Storage.addAuditLog("admin_login", { status: "failed" });
    }
  },

  logout() {
    sessionStorage.removeItem(this.sessionKey);
    window.location.reload();
  },

  changePassword() {
    const newPass = prompt("Naya admin password dein (min 6 characters):");
    if (!newPass || newPass.length < 6) { adminToast("Password kam se kam 6 characters ka hona chahiye!", "error"); return; }
    Storage.setAdminPassword(newPass);
    Storage.addAuditLog("password_changed", {});
    adminToast("Password change ho gaya! ✅", "success");
  },

  // ── Init ──────────────────────────────────────────────────
  init() {
    this.navigateTo("dashboard");
    this.applyTheme();
  },

  applyTheme() {
    const settings = Storage.getSettings();
    document.documentElement.setAttribute("data-theme", settings.theme || "dark");
    const btn = document.getElementById("adminThemeBtn");
    if (btn) btn.textContent = settings.theme === "light" ? "🌙" : "☀️";
  },

  toggleTheme() {
    const current = Storage.getSettings().theme || "dark";
    Storage.updateSettings({ theme: current === "dark" ? "light" : "dark" });
    this.applyTheme();
  },

  // ── Navigation ────────────────────────────────────────────
  navigateTo(page) {
    this.currentPage = page;
    this.closeSidebar();
    document.querySelectorAll(".admin-page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

    const pageEl = document.getElementById("page-" + page);
    if (pageEl) pageEl.classList.add("active");
    const navEl = document.querySelector(`[data-page="${page}"]`);
    if (navEl) navEl.classList.add("active");

    const topbarTitle = document.getElementById("topbarTitle");
    const titles = {
      dashboard: "📊 Dashboard",
      users: "👥 User Management",
      chats: "💬 Chat Management",
      features: "🔧 Feature Management",
      ai: "🤖 AI & Model Settings",
      kb: "📚 Knowledge Base",
      analytics: "📈 Analytics & Reports",
      appearance: "🎨 Appearance & Branding",
      security: "🔒 Security & Permissions",
      settings: "⚙️ General Settings",
      logs: "📋 Logs & System Health",
      agentcontrol: "🤖 Agent Control Center",
      modelcenter: "⚡ Model Center",
      skillmanager: "🧩 Skill Manager",
      memorymanager: "🧠 Memory Manager",
      sandboxmgr: "🛡️ Sandbox Manager",
      promptversions: "📜 Prompt Versioning",
      doctester: "🔬 AI Document Tester",
      localdb: "🗄️ Local Database & Storage"
    };
    if (topbarTitle) topbarTitle.textContent = titles[page] || page;

    this.renderPage(page);
  },

  // ── Mobile Sidebar Toggle ──────────────────────────────────
  toggleSidebar() {
    const sidebar = document.getElementById("adminSidebar");
    const overlay = document.getElementById("adminSidebarOverlay");
    if (sidebar) {
      if (window.innerWidth <= 900) {
        const isOpen = sidebar.classList.toggle("open");
        if (overlay) overlay.classList.toggle("show", isOpen);
      } else {
        sidebar.classList.toggle("collapsed");
      }
    }
  },

  closeSidebar() {
    const sidebar = document.getElementById("adminSidebar");
    const overlay = document.getElementById("adminSidebarOverlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("show");
  },

  // ── Page Renderers ────────────────────────────────────────
  renderPage(page) {
    switch (page) {
      case "dashboard": this.renderDashboard(); break;
      case "users": this.renderUsers(); break;
      case "chats": this.renderChats(); break;
      case "features": this.renderFeatures(); break;
      case "ai": this.renderAI(); break;
      case "kb": this.renderKB(); break;
      case "analytics": this.renderAnalytics(); break;
      case "appearance": this.renderAppearance(); break;
      case "security": this.renderSecurity(); break;
      case "settings": this.renderSettings(); break;
      case "logs": this.renderLogs(); break;
      case "agentcontrol": this.renderAgentControl(); break;
      case "modelcenter": this.renderModelCenter(); break;
      case "skillmanager": this.renderSkillManager(); break;
      case "memorymanager": this.renderMemoryManager(); break;
      case "sandboxmgr": this.renderSandboxMgr(); break;
      case "promptversions": this.renderPromptVersions(); break;
      case "doctester": this.renderDocTester(); break;
      case "localdb": this.renderLocalDb(); break;
    }
  },

  // ── Dashboard ─────────────────────────────────────────────
  renderDashboard() {
    const analytics = Storage.getAnalytics();
    const convs = Storage.getConversations();
    const users = Storage.getUsers();
    const features = Storage.getFeatures();

    const enabledFeatures = Object.values(features).filter(f => f.enabled).length;

    document.getElementById("statTotalMessages").textContent = analytics.totalMessages || 0;
    document.getElementById("statTotalConvs").textContent = analytics.totalConversations || 0;
    document.getElementById("statTotalUsers").textContent = users.length;
    document.getElementById("statEnabledFeatures").textContent = enabledFeatures;

    // Recent conversations
    const recentConvs = convs.slice(0, 5);
    const tbody = document.getElementById("recentConvsTable");
    if (tbody) {
      tbody.innerHTML = recentConvs.length === 0
        ? '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px;">Koi conversation nahi hai</td></tr>'
        : recentConvs.map(c => `
          <tr>
            <td>${c.title}</td>
            <td>${c.messageCount || 0}</td>
            <td>${c.pinned ? '<span class="badge badge-primary">Pinned</span>' : ''}</td>
            <td>${formatDate(c.updatedAt)}</td>
          </tr>
        `).join("");
    }

    // Storage usage
    const storageUsed = JSON.stringify(localStorage).length;
    const storageKB = (storageUsed / 1024).toFixed(1);
    const el = document.getElementById("storageUsed");
    if (el) el.textContent = storageKB + " KB";

    // Feature usage bars
    const featBars = document.getElementById("featureUsageBars");
    if (featBars) {
      const usage = analytics.featureUsage || {};
      const sorted = Object.entries(usage).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const max = sorted[0]?.[1] || 1;
      featBars.innerHTML = sorted.length === 0
        ? '<p class="text-muted text-sm">Koi data nahi</p>'
        : sorted.map(([name, count]) => `
          <div class="bar-row">
            <div class="bar-label">${name}</div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${(count/max*100)}%">${count}</div>
            </div>
          </div>
        `).join("");
    }
  },

  // ── Users ─────────────────────────────────────────────────
  renderUsers(filter = "") {
    let users = Storage.getUsers();
    if (filter) users = users.filter(u =>
      u.name.toLowerCase().includes(filter) ||
      u.email.toLowerCase().includes(filter) ||
      u.role.toLowerCase().includes(filter)
    );

    const tbody = document.getElementById("usersTable");
    if (!tbody) return;

    tbody.innerHTML = users.length === 0
      ? '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px;">Koi user nahi mila</td></tr>'
      : users.map(u => `
        <tr>
          <td><div style="font-weight:600">${u.name}</div><div style="font-size:11px;color:var(--text3)">${u.email}</div></td>
          <td><span class="badge badge-${u.role === 'admin' ? 'primary' : 'muted'}">${u.role}</span></td>
          <td><span class="badge badge-${u.status === 'active' ? 'success' : 'error'}">${u.status}</span></td>
          <td>${u.messageCount || 0}</td>
          <td>${formatDate(u.createdAt)}</td>
          <td>${formatDate(u.lastActive)}</td>
          <td>
            <div class="flex gap-2">
              <button class="btn btn-xs btn-secondary" onclick="Admin.editUser('${u.id}')">✏️</button>
              <button class="btn btn-xs btn-${u.status === 'active' ? 'warning' : 'success'}" onclick="Admin.toggleUserStatus('${u.id}')">
                ${u.status === 'active' ? '🚫 Suspend' : '✅ Unblock'}
              </button>
              ${u.role !== 'admin' ? `<button class="btn btn-xs btn-danger" onclick="Admin.deleteUser('${u.id}')">🗑️</button>` : ''}
            </div>
          </td>
        </tr>
      `).join("");
  },

  showAddUserModal() {
    document.getElementById("addUserModal")?.classList.add("active");
  },

  saveNewUser() {
    const name = document.getElementById("newUserName")?.value?.trim();
    const email = document.getElementById("newUserEmail")?.value?.trim();
    const role = document.getElementById("newUserRole")?.value || "user";
    if (!name || !email) { adminToast("Name aur email required hain!", "error"); return; }

    const users = Storage.getUsers();
    users.push({
      id: "user_" + Date.now(),
      name, email, role,
      status: "active",
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      usageLimit: -1,
      messageCount: 0
    });
    Storage.saveUsers(users);
    Storage.addAuditLog("user_created", { name, email, role });
    document.getElementById("addUserModal")?.classList.remove("active");
    this.renderUsers();
    adminToast("User create ho gaya! ✅", "success");
  },

  toggleUserStatus(id) {
    const users = Storage.getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx < 0) return;
    users[idx].status = users[idx].status === "active" ? "suspended" : "active";
    Storage.saveUsers(users);
    Storage.addAuditLog("user_status_changed", { id, status: users[idx].status });
    this.renderUsers();
    adminToast(`User ${users[idx].status}! ✅`, "success");
  },

  editUser(id) {
    const users = Storage.getUsers();
    const user = users.find(u => u.id === id);
    if (!user) return;
    const newName = prompt("User ka naam:", user.name);
    if (newName) {
      user.name = newName.trim();
      const newRole = prompt("Role (admin/user/moderator):", user.role);
      if (newRole) user.role = newRole.trim();
      Storage.saveUsers(users);
      Storage.addAuditLog("user_edited", { id });
      this.renderUsers();
      adminToast("User updated! ✅", "success");
    }
  },

  deleteUser(id) {
    if (!confirm("Kya aap is user ko delete karna chahte hain?")) return;
    const users = Storage.getUsers().filter(u => u.id !== id);
    Storage.saveUsers(users);
    Storage.addAuditLog("user_deleted", { id });
    this.renderUsers();
    adminToast("User deleted! 🗑️", "success");
  },

  // ── Chats ─────────────────────────────────────────────────
  renderChats() {
    const convs = Storage.getConversations();
    const tbody = document.getElementById("chatsTable");
    if (!tbody) return;
    tbody.innerHTML = convs.length === 0
      ? '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px;">Koi chat nahi hai</td></tr>'
      : convs.map(c => `
        <tr>
          <td>${c.title}</td>
          <td>${c.messageCount || 0}</td>
          <td>
            ${c.pinned ? '<span class="badge badge-primary">📌 Pinned</span> ' : ''}
            ${c.archived ? '<span class="badge badge-muted">📦 Archived</span>' : '<span class="badge badge-success">Active</span>'}
          </td>
          <td>${formatDate(c.updatedAt)}</td>
          <td>
            <button class="btn btn-xs btn-danger" onclick="Admin.deleteChat('${c.id}')">🗑️ Delete</button>
          </td>
        </tr>
      `).join("");

    document.getElementById("totalChatsCount").textContent = convs.length;
    document.getElementById("archivedChatsCount").textContent = convs.filter(c => c.archived).length;
    document.getElementById("pinnedChatsCount").textContent = convs.filter(c => c.pinned).length;
  },

  deleteChat(id) {
    if (!confirm("Is chat ko delete karein?")) return;
    Storage.deleteConversation(id);
    Storage.addAuditLog("chat_deleted", { id });
    this.renderChats();
    adminToast("Chat deleted!", "success");
  },

  clearAllChats() {
    if (!confirm("⚠️ SAARI conversations delete ho jaayengi! Sure hain?")) return;
    Storage.saveConversations([]);
    Storage.addAuditLog("all_chats_cleared", {});
    this.renderChats();
    adminToast("Saari chats delete ho gayi!", "warning");
  },

  // ── Features ──────────────────────────────────────────────
  renderFeatures() {
    const features = Storage.getFeatures();
    const container = document.getElementById("featuresContainer");
    if (!container) return;

    const featureList = [
      { key: "textChat", icon: "💬", name: "Text Chat", desc: "Users chat kar sakein" },
      { key: "chatHistory", icon: "📜", name: "Chat History", desc: "Chat history save ho" },
      { key: "fileUpload", icon: "📎", name: "File Upload", desc: "Files upload karna" },
      { key: "pdfReader", icon: "📄", name: "PDF Reader", desc: "PDF files read karna" },
      { key: "imageUnderstanding", icon: "🖼️", name: "Image Understanding", desc: "Images analyze karna" },
      { key: "localAIModel", icon: "🤖", name: "Local AI Model", desc: "Local AI model use karna" },
      { key: "voiceInput", icon: "🎤", name: "Voice Input", desc: "Voice se input lena" },
      { key: "textToSpeech", icon: "🔊", name: "Text to Speech", desc: "Text ko bol kar sunana" },
      { key: "codeAssistant", icon: "💻", name: "Code Assistant", desc: "Coding help karna" },
      { key: "calculatorTools", icon: "🧮", name: "Calculator & Tools", desc: "Calculator aur tools" },
      { key: "imageGeneration", icon: "🎨", name: "Image Generation", desc: "AI se images banana" },
      { key: "webSearch", icon: "🌐", name: "Web Search", desc: "Web par search karna" }
    ];

    container.innerHTML = featureList.map(f => {
      const feat = features[f.key] || { enabled: false };
      return `
        <div class="feature-row">
          <div class="feature-icon">${f.icon}</div>
          <div class="feature-info">
            <div class="feature-name">${f.name}</div>
            <div class="feature-desc">${f.desc}</div>
            <div class="feature-status ${feat.enabled ? 'on' : 'off'}">
              ${feat.enabled ? '✅ Enabled' : '❌ Disabled'}
            </div>
          </div>
          <label class="toggle" title="${feat.enabled ? 'Disable karein' : 'Enable karein'}">
            <input type="checkbox" ${feat.enabled ? "checked" : ""}
              onchange="Admin.toggleFeature('${f.key}', this.checked)" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      `;
    }).join("");
  },

  toggleFeature(key, enabled) {
    const features = Storage.getFeatures();
    if (!features[key]) features[key] = { enabled: false, roles: ["all"], limit: -1 };
    features[key].enabled = enabled;
    Storage.saveFeatures(features);
    Storage.addAuditLog("feature_toggled", { key, enabled });
    adminToast(`${key} ${enabled ? 'enabled' : 'disabled'}! ✅`, "success");
    // Update status label
    const rows = document.querySelectorAll(".feature-row");
    rows.forEach(row => {
      const toggle = row.querySelector(`input[onchange*="${key}"]`);
      if (toggle) {
        const statusEl = row.querySelector(".feature-status");
        if (statusEl) {
          statusEl.textContent = enabled ? "✅ Enabled" : "❌ Disabled";
          statusEl.className = `feature-status ${enabled ? "on" : "off"}`;
        }
      }
    });
  },

  // ── AI Settings ───────────────────────────────────────────
  renderAI() {
    const aiSettings = Storage.get("ai_settings", {
      defaultModel: "rule-based",
      systemPrompt: "Aap AJ AI hain, ek helpful offline AI assistant. Hindi aur English dono mein jawab dein.",
      maxTokens: 512,
      temperature: 0.7,
      contextSize: 10
    });

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal("aiModel", aiSettings.defaultModel);
    setVal("aiSystemPrompt", aiSettings.systemPrompt);
    setVal("aiMaxTokens", aiSettings.maxTokens);
    setVal("aiTemperature", aiSettings.temperature);
    setVal("aiContextSize", aiSettings.contextSize);
  },

  saveAISettings() {
    const settings = {
      defaultModel: document.getElementById("aiModel")?.value || "rule-based",
      systemPrompt: document.getElementById("aiSystemPrompt")?.value || "",
      maxTokens: parseInt(document.getElementById("aiMaxTokens")?.value || 512),
      temperature: parseFloat(document.getElementById("aiTemperature")?.value || 0.7),
      contextSize: parseInt(document.getElementById("aiContextSize")?.value || 10)
    };
    Storage.set("ai_settings", settings);
    Storage.addAuditLog("ai_settings_saved", {});
    adminToast("AI settings save ho gayi! ✅", "success");
  },

  // ── Knowledge Base ────────────────────────────────────────
  renderKB(filter = "") {
    // Combine built-in + custom
    const customEntries = Storage.getKBEntries();
    let allEntries = [
      ...KnowledgeBase.faqs.map(f => ({ ...f, isBuiltin: true })),
      ...customEntries.map(e => ({ ...e, isBuiltin: false }))
    ];

    if (filter) {
      allEntries = allEntries.filter(e =>
        e.question.toLowerCase().includes(filter) ||
        e.answer.toLowerCase().includes(filter) ||
        (e.category || "").toLowerCase().includes(filter)
      );
    }

    document.getElementById("kbTotalEntries").textContent = allEntries.length;
    document.getElementById("kbCustomEntries").textContent = customEntries.length;

    const tbody = document.getElementById("kbTable");
    if (!tbody) return;
    tbody.innerHTML = allEntries.length === 0
      ? '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px;">Koi entry nahi mili</td></tr>'
      : allEntries.map(e => `
        <tr>
          <td><span class="badge badge-${e.isBuiltin ? 'muted' : 'primary'}">${e.isBuiltin ? 'Built-in' : 'Custom'}</span></td>
          <td>${e.category || "—"}</td>
          <td title="${e.question}">${e.question.length > 50 ? e.question.substring(0,50)+"..." : e.question}</td>
          <td title="${e.answer}">${e.answer.length > 60 ? e.answer.substring(0,60)+"..." : e.answer}</td>
          <td>
            ${!e.isBuiltin ? `
              <button class="btn btn-xs btn-secondary" onclick="Admin.editKBEntry('${e.id}')">✏️</button>
              <button class="btn btn-xs btn-danger" onclick="Admin.deleteKBEntry('${e.id}')">🗑️</button>
            ` : '<span class="text-muted text-xs">Read-only</span>'}
          </td>
        </tr>
      `).join("");
  },

  showAddKBModal() {
    document.getElementById("addKBModal")?.classList.add("active");
  },

  saveKBEntry() {
    const category = document.getElementById("kbCategory")?.value?.trim() || "General";
    const question = document.getElementById("kbQuestion")?.value?.trim();
    const keywords = document.getElementById("kbKeywords")?.value?.trim();
    const answer = document.getElementById("kbAnswer")?.value?.trim();

    if (!question || !answer) { adminToast("Question aur answer required hain!", "error"); return; }

    const entries = Storage.getKBEntries();
    entries.push({
      id: "kb_" + Date.now(),
      category, question, keywords, answer,
      createdAt: new Date().toISOString()
    });
    Storage.saveKBEntries(entries);
    Storage.addAuditLog("kb_entry_added", { question });
    document.getElementById("addKBModal")?.classList.remove("active");
    this.renderKB();
    adminToast("KB entry add ho gayi! ✅", "success");
  },

  editKBEntry(id) {
    const entries = Storage.getKBEntries();
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const newAnswer = prompt("Answer edit karein:", entry.answer);
    if (newAnswer) {
      entry.answer = newAnswer.trim();
      Storage.saveKBEntries(entries);
      this.renderKB();
      adminToast("Entry updated! ✅", "success");
    }
  },

  deleteKBEntry(id) {
    if (!confirm("KB entry delete karein?")) return;
    const entries = Storage.getKBEntries().filter(e => e.id !== id);
    Storage.saveKBEntries(entries);
    Storage.addAuditLog("kb_entry_deleted", { id });
    this.renderKB();
    adminToast("Entry deleted! 🗑️", "success");
  },

  exportKB() {
    const all = [...KnowledgeBase.faqs, ...Storage.getKBEntries()];
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "knowledge_base.json";
    a.click();
    adminToast("KB exported! 📦", "success");
  },

  // ── Analytics ─────────────────────────────────────────────
  renderAnalytics() {
    const analytics = Storage.getAnalytics();
    const daily = analytics.dailyStats || {};
    const days = Object.keys(daily).sort().slice(-7);

    document.getElementById("analyticsTotalMsgs").textContent = analytics.totalMessages || 0;
    document.getElementById("analyticsTotalConvs").textContent = analytics.totalConversations || 0;
    document.getElementById("analyticsErrors").textContent = (analytics.errors || []).length;

    // Daily chart
    const chart = document.getElementById("dailyChart");
    if (chart && days.length > 0) {
      const max = Math.max(...days.map(d => daily[d].messages || 0)) || 1;
      chart.innerHTML = days.map(d => `
        <div class="bar-row">
          <div class="bar-label">${d.substring(5)}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${((daily[d].messages||0)/max*100)}%">${daily[d].messages||0}</div>
          </div>
        </div>
      `).join("");
    } else if (chart) {
      chart.innerHTML = '<p class="text-muted text-sm">Abhi tak koi usage data nahi</p>';
    }

    // Feature usage
    const featChart = document.getElementById("featUsageChart");
    if (featChart) {
      const usage = analytics.featureUsage || {};
      const sorted = Object.entries(usage).sort((a, b) => b[1] - a[1]);
      const max = sorted[0]?.[1] || 1;
      featChart.innerHTML = sorted.length === 0
        ? '<p class="text-muted text-sm">Koi feature usage nahi</p>'
        : sorted.map(([name, count]) => `
          <div class="bar-row">
            <div class="bar-label">${name}</div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${count/max*100}%">${count}</div>
            </div>
          </div>
        `).join("");
    }
  },

  exportCSV() {
    const analytics = Storage.getAnalytics();
    const daily = analytics.dailyStats || {};
    let csv = "Date,Messages,Conversations\n";
    Object.entries(daily).sort().forEach(([date, data]) => {
      csv += `${date},${data.messages || 0},${data.conversations || 0}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "analytics.csv";
    a.click();
    adminToast("CSV exported! 📊", "success");
  },

  // ── Appearance ────────────────────────────────────────────
  renderAppearance() {
    const settings = Storage.getSettings();
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal("appBrandName", settings.appName);
    setVal("appWelcomeMsg", settings.welcomeMessage);
    setVal("appPrimaryColor", settings.primaryColor);
    setVal("appTheme", settings.theme);
    setVal("appLogo", settings.logoUrl || "");
  },

  saveAppearance() {
    const updates = {
      appName: document.getElementById("appBrandName")?.value?.trim() || "AJ AI",
      welcomeMessage: document.getElementById("appWelcomeMsg")?.value?.trim(),
      primaryColor: document.getElementById("appPrimaryColor")?.value || "#6366f1",
      theme: document.getElementById("appTheme")?.value || "dark",
      logoUrl: document.getElementById("appLogo")?.value?.trim() || ""
    };
    Storage.updateSettings(updates);
    Storage.addAuditLog("appearance_saved", {});
    adminToast("Appearance settings save ho gayi! ✅", "success");
  },

  // ── Security ──────────────────────────────────────────────
  renderSecurity() {
    const logs = Storage.getAuditLog();
    const container = document.getElementById("auditLogContainer");
    if (!container) return;

    container.innerHTML = logs.length === 0
      ? '<div class="empty-state"><div class="empty-icon">🔒</div><p>Koi audit log nahi</p></div>'
      : logs.slice(0, 50).map(log => `
        <div class="log-entry">
          <div style="min-width:140px;">
            <div class="log-time">${log.time ? new Date(log.time).toLocaleString("hi-IN") : "—"}</div>
          </div>
          <div>
            <div class="log-action">${log.action}</div>
            <div class="log-details">${JSON.stringify(log.details)}</div>
          </div>
        </div>
      `).join("");
  },

  clearAuditLog() {
    if (!confirm("Audit log clear karein?")) return;
    Storage.set("audit_log", []);
    this.renderSecurity();
    adminToast("Audit log cleared! 🗑️", "success");
  },

  exportAuditLog() {
    const logs = Storage.getAuditLog();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "audit_log.json";
    a.click();
  },

  // ── General Settings ──────────────────────────────────────
  renderSettings() {
    const settings = Storage.getSettings();
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal("gsetMaxUpload", settings.maxUploadMB);
    setVal("gsetRetention", settings.historyRetentionDays);
    setVal("gsetLanguage", settings.language);
    setVal("gsetDateFormat", settings.dateFormat);
    setVal("gsetTypingSpeed", settings.typingSpeed);
  },

  saveGeneralSettings() {
    const updates = {
      maxUploadMB: parseInt(document.getElementById("gsetMaxUpload")?.value || 10),
      historyRetentionDays: parseInt(document.getElementById("gsetRetention")?.value || 30),
      language: document.getElementById("gsetLanguage")?.value || "hi",
      dateFormat: document.getElementById("gsetDateFormat")?.value || "DD/MM/YYYY",
      typingSpeed: parseInt(document.getElementById("gsetTypingSpeed")?.value || 15)
    };
    Storage.updateSettings(updates);
    Storage.addAuditLog("general_settings_saved", {});
    adminToast("Settings save ho gayi! ✅", "success");
  },

  exportAllData() {
    const data = {
      settings: Storage.getSettings(),
      conversations: Storage.getConversations(),
      users: Storage.getUsers(),
      features: Storage.getFeatures(),
      kb: Storage.getKBEntries(),
      analytics: Storage.getAnalytics(),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "aj_ai_full_backup.json";
    a.click();
    adminToast("Full backup exported! 📦", "success");
  },

  resetAllData() {
    if (!confirm("⚠️⚠️ SAARA DATA DELETE HO JAAYEGA! Pehle backup zaroor lein. Sure hain?")) return;
    if (!confirm("Ek baar aur confirm karein: Kya aap BILKUL sure hain?")) return;
    Storage.clear();
    Storage.addAuditLog("full_reset", { by: "admin" });
    adminToast("Data reset ho gaya! App reload ho raha hai...", "warning");
    setTimeout(() => window.location.reload(), 1500);
  },

  // ── Logs ──────────────────────────────────────────────────
  renderLogs() {
    const analytics = Storage.getAnalytics();
    const errors = analytics.errors || [];

    const container = document.getElementById("errorLogsContainer");
    if (container) {
      container.innerHTML = errors.length === 0
        ? '<div class="empty-state"><div class="empty-icon">✅</div><p>Koi error nahi hua!</p></div>'
        : errors.slice(0, 50).map(err => `
          <div class="log-entry">
            <div style="min-width:140px;"><div class="log-time">${err.time ? new Date(err.time).toLocaleString("hi-IN") : "—"}</div></div>
            <div>
              <div class="log-action text-error">${err.message || "Unknown error"}</div>
              ${err.type ? `<div class="log-details">Type: ${err.type}</div>` : ''}
            </div>
          </div>
        `).join("");
    }

    // System health
    const storageUsed = JSON.stringify(localStorage).length;
    document.getElementById("healthStorage").textContent = (storageUsed / 1024).toFixed(1) + " KB";
    document.getElementById("healthConvs").textContent = Storage.getConversations().length;
    document.getElementById("healthUsers").textContent = Storage.getUsers().length;
    document.getElementById("healthErrors").textContent = errors.length;
    document.getElementById("healthBrowser").textContent = navigator.userAgent.includes("Chrome") ? "Chrome" : navigator.userAgent.includes("Firefox") ? "Firefox" : "Other";
    document.getElementById("healthOnline").textContent = navigator.onLine ? "✅ Online" : "❌ Offline";
  },

  clearErrorLogs() {
    const analytics = Storage.getAnalytics();
    analytics.errors = [];
    Storage.set("analytics", analytics);
    this.renderLogs();
    adminToast("Error logs cleared! ✅", "success");
  },

  // ── 2026 Advanced Admin Handlers ──────────────────────────
  renderAgentControl() {
    const tasks = Storage.get("agent_tasks", []);
    const tbody = document.getElementById("adminAgentTasksTable");
    if (!tbody) return;
    tbody.innerHTML = tasks.length === 0 ? '<tr><td colspan="6" class="text-center text-muted" style="padding:20px;">No Agent task records found.</td></tr>' :
      tasks.map(t => `
        <tr>
          <td><code>${t.id.substring(0, 15)}...</code></td>
          <td><b>${t.goal}</b></td>
          <td>${t.currentStepIndex || 0} / ${t.steps ? t.steps.length : 0}</td>
          <td><span class="badge badge-${t.status === 'completed' ? 'success' : t.status === 'waiting_approval' ? 'warning' : 'primary'}">${t.status}</span></td>
          <td>${formatDate(t.createdAt)}</td>
          <td>
            <button class="btn btn-xs btn-danger" onclick="Admin.deleteAgentTask('${t.id}')">🗑️</button>
          </td>
        </tr>
      `).join("");
  },

  deleteAgentTask(id) {
    let tasks = Storage.get("agent_tasks", []);
    tasks = tasks.filter(t => t.id !== id);
    Storage.set("agent_tasks", tasks);
    this.renderAgentControl();
    adminToast("Agent task log removed", "success");
  },

  renderModelCenter() {
    // Model center view
  },

  renderSkillManager() {
    const container = document.getElementById("adminSkillsContainer");
    if (!container) return;
    const skills = window.PluginManager ? PluginManager.getSkills() : [];
    container.innerHTML = skills.map(sk => `
      <div class="feature-row">
        <div class="feature-icon">🧩</div>
        <div class="feature-info">
          <div class="feature-name">${sk.name} <span class="badge badge-muted" style="font-size:9px;">${sk.category}</span></div>
          <div class="feature-desc">${sk.desc}</div>
        </div>
        <label class="toggle">
          <input type="checkbox" ${sk.enabled ? 'checked' : ''} onchange="PluginManager.toggleSkill('${sk.id}'); Admin.renderSkillManager();" />
          <span class="toggle-slider"></span>
        </label>
      </div>
    `).join("");
  },

  renderMemoryManager() {
    const tbody = document.getElementById("adminMemoriesTable");
    if (!tbody) return;
    const memories = window.MemoryTimeline ? MemoryTimeline.getMemories() : [];
    tbody.innerHTML = memories.length === 0 ? '<tr><td colspan="5" class="text-center text-muted" style="padding:20px;">No stored memories.</td></tr>' :
      memories.map(m => `
        <tr>
          <td><b>${m.key}</b></td>
          <td>${m.value}</td>
          <td><span class="badge badge-primary">${m.category}</span></td>
          <td>${Math.round(m.confidence * 100)}%</td>
          <td><button class="btn btn-xs btn-danger" onclick="MemoryTimeline.deleteMemory('${m.id}'); Admin.renderMemoryManager();">🗑️</button></td>
        </tr>
      `).join("");
  },

  renderSandboxMgr() {
    // Static configuration controls are rendered in HTML
  },

  renderPromptVersions() {
    const cont = document.getElementById("adminPromptVersionsContainer");
    if (!cont) return;
    const prompts = window.PromptLab ? PromptLab.getPrompts() : [];
  renderDocTester() {
    const cases = window.DocumentTester ? DocumentTester.getTestCases() : [];
    const tbody = document.getElementById("ragTestCasesTable");
    if (!tbody) return;

    let passed = 0;
    let overrides = 0;
    let totalScore = 0;

    tbody.innerHTML = cases.map(c => {
      if (c.status === "passed") passed++;
      if (c.overridden) overrides++;
      totalScore += (c.matchScore || 0);

      return `
        <tr>
          <td><b>${c.query}</b></td>
          <td><span class="badge badge-muted">${c.sourceDoc}</span></td>
          <td><span class="badge badge-${c.matchScore >= 85 ? 'success' : c.matchScore >= 60 ? 'warning' : 'error'}">${c.matchScore}%</span></td>
          <td style="font-size:11px; color:var(--text2); max-width:260px;">${c.snippet}</td>
          <td>${c.overridden ? `<span class="badge badge-warning" title="${c.overrideAnswer}">Override</span>` : '<span class="text-xs text-muted">Auto</span>'}</td>
          <td>
            <button class="btn btn-xs btn-secondary" onclick="Admin.promptOverrideRAG('${c.id}')">✏️</button>
          </td>
        </tr>
      `;
    }).join("");

    const avg = Math.round(totalScore / (cases.length || 1));
    const avgEl = document.getElementById("ragAvgScore");
    if (avgEl) avgEl.textContent = avg + "%";
    const passEl = document.getElementById("ragPassedCount");
    if (passEl) passEl.textContent = `${passed} / ${cases.length}`;
    const overEl = document.getElementById("ragOverrideCount");
    if (overEl) overEl.textContent = overrides;
  },

  runRAGBatchTest() {
    if (!window.DocumentTester) return;
    const res = DocumentTester.runBatchEvaluation();
    this.renderDocTester();
    adminToast(`Batch Evaluation Finished! Avg: ${res.averageScore}% (${res.passed} passed)`, "success");
  },

  testSingleRAGQuery() {
    const input = document.getElementById("ragTestInput");
    const container = document.getElementById("ragSingleResult");
    if (!input || !input.value.trim() || !container) return;

    const res = DocumentTester.testDocumentQuery(input.value.trim());
    container.style.display = "block";
    container.innerHTML = `
      <div style="padding:12px; background:var(--bg2); border-radius:6px; font-size:12px;">
        <div class="flex justify-between items-center mb-2">
          <b>Top Matching Candidates (${res.topMatches.length})</b>
          <span class="badge badge-${res.bestScore >= 85 ? 'success' : 'warning'}">Top Score: ${res.bestScore}%</span>
        </div>
        ${res.topMatches.length === 0 ? '<p class="text-muted">No relevant document chunks identified.</p>' :
          res.topMatches.map((m, idx) => `
            <div style="margin-bottom:6px; padding:8px; background:var(--bg); border-radius:4px;">
              <div class="flex justify-between items-center">
                <span style="font-weight:600; color:var(--primary);">${idx + 1}. ${m.title}</span>
                <span class="badge badge-primary">${m.score}%</span>
              </div>
              <div style="color:var(--text3); font-size:10px; margin-top:2px;">Source: ${m.source}</div>
              <div style="margin-top:4px; font-size:11px; color:var(--text);">${m.snippet}</div>
            </div>
          `).join("")}
      </div>
    `;
  },

  promptOverrideRAG(testId) {
    const text = prompt("Enter verified manual override answer for this test query:");
    if (text && window.DocumentTester) {
      DocumentTester.addOverride(testId, text.trim());
      this.renderDocTester();
      adminToast("Manual override applied to RAG test case!", "success");
    }
  },

  renderLocalDb() {
    const tbody = document.getElementById("localDbTable");
    if (!tbody || !window.LocalDatabase) return;
    const stats = LocalDatabase.getStats();
    tbody.innerHTML = stats.map(s => `
      <tr>
        <td><b>${s.collection}</b></td>
        <td>${s.records} entries</td>
        <td><span class="badge badge-muted">${s.sizeKB}</span></td>
        <td><span class="badge badge-success">Mounted & Indexed</span></td>
      </tr>
    `).join("");
  }
};

// ── Utility ───────────────────────────────────────────────────
function formatDate(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "Abhi";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr`;
  return d.toLocaleDateString("hi-IN");
}

function adminToast(message, type = "info") {
  const container = document.getElementById("adminToastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icons = { info: "ℹ️", success: "✅", error: "❌", warning: "⚠️" };
  toast.innerHTML = `${icons[type] || "ℹ️"} ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 300); }, 3000);
}

window.Admin = Admin;
window.adminToast = adminToast;
