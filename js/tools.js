// ============================================================
//  tools.js — Calculator, converters, file tools, etc.
// ============================================================

const ToolsPanel = {
  isOpen: false,
  currentTool: "calculator",

  open(toolName = "calculator") {
    this.currentTool = toolName;
    const panel = document.getElementById("toolsPanel");
    if (panel) {
      panel.classList.add("open");
      this.isOpen = true;
      this.switchTool(toolName);
    }
  },

  close() {
    const panel = document.getElementById("toolsPanel");
    if (panel) {
      panel.classList.remove("open");
      this.isOpen = false;
    }
  },

  toggle(toolName) {
    if (this.isOpen && this.currentTool === toolName) {
      this.close();
    } else {
      this.open(toolName);
    }
  },

  switchTool(name) {
    this.currentTool = name;
    document.querySelectorAll(".tool-tab").forEach(t =>
      t.classList.toggle("active", t.dataset.tool === name)
    );
    document.querySelectorAll(".tool-content").forEach(c =>
      c.classList.toggle("active", c.dataset.tool === name)
    );
    Storage.trackEvent("feature", { name });
  },

  // ── Calculator ────────────────────────────────────────────
  calcDisplay: "",
  calcMemory: 0,

  calcPress(value) {
    const display = document.getElementById("calcDisplay");
    if (!display) return;

    if (value === "C") {
      this.calcDisplay = "";
    } else if (value === "CE") {
      this.calcDisplay = this.calcDisplay.slice(0, -1);
    } else if (value === "=") {
      try {
        const expr = this.calcDisplay.replace(/×/g, "*").replace(/÷/g, "/").replace(/π/g, Math.PI).replace(/e/g, Math.E);
        const result = Function('"use strict"; return (' + expr + ')')();
        this.calcDisplay = String(Math.round(result * 1e10) / 1e10);
      } catch {
        this.calcDisplay = "Error";
        setTimeout(() => { this.calcDisplay = ""; this.calcPress(""); }, 1000);
      }
    } else if (value === "√") {
      try {
        const result = Math.sqrt(parseFloat(this.calcDisplay));
        this.calcDisplay = String(Math.round(result * 1e10) / 1e10);
      } catch { this.calcDisplay = "Error"; }
    } else if (value === "x²") {
      try {
        const result = Math.pow(parseFloat(this.calcDisplay), 2);
        this.calcDisplay = String(result);
      } catch { this.calcDisplay = "Error"; }
    } else if (value === "sin") {
      const result = Math.sin(parseFloat(this.calcDisplay) * Math.PI / 180);
      this.calcDisplay = String(Math.round(result * 1e10) / 1e10);
    } else if (value === "cos") {
      const result = Math.cos(parseFloat(this.calcDisplay) * Math.PI / 180);
      this.calcDisplay = String(Math.round(result * 1e10) / 1e10);
    } else if (value === "tan") {
      const result = Math.tan(parseFloat(this.calcDisplay) * Math.PI / 180);
      this.calcDisplay = String(Math.round(result * 1e10) / 1e10);
    } else if (value === "log") {
      const result = Math.log10(parseFloat(this.calcDisplay));
      this.calcDisplay = String(Math.round(result * 1e10) / 1e10);
    } else if (value === "ln") {
      const result = Math.log(parseFloat(this.calcDisplay));
      this.calcDisplay = String(Math.round(result * 1e10) / 1e10);
    } else if (value === "MS") {
      this.calcMemory = parseFloat(this.calcDisplay) || 0;
      UI.toast("Memory saved! 💾", "success", 1500);
      return;
    } else if (value === "MR") {
      this.calcDisplay += String(this.calcMemory);
    } else if (value === "%") {
      this.calcDisplay = String(parseFloat(this.calcDisplay) / 100);
    } else if (value === "+/-") {
      if (this.calcDisplay.startsWith("-")) {
        this.calcDisplay = this.calcDisplay.slice(1);
      } else {
        this.calcDisplay = "-" + this.calcDisplay;
      }
    } else {
      this.calcDisplay += value;
    }
    if (display) display.textContent = this.calcDisplay || "0";
  },

  // ── Word Counter ──────────────────────────────────────────
  updateWordCount() {
    const text = document.getElementById("wordCountInput")?.value || "";
    const stats = AI.wordCount(text);
    document.getElementById("wcWords").textContent = stats.words;
    document.getElementById("wcChars").textContent = stats.characters;
    document.getElementById("wcCharsNoSpace").textContent = stats.charactersNoSpace;
    document.getElementById("wcSentences").textContent = stats.sentences;
    document.getElementById("wcParas").textContent = stats.paragraphs;
    document.getElementById("wcReadTime").textContent = stats.readingTime + " min";
  },

  // ── Text Case Converter ───────────────────────────────────
  convertCase(type) {
    const input = document.getElementById("caseInput");
    const output = document.getElementById("caseOutput");
    if (input && output) {
      output.value = AI.convertCase(input.value, type);
    }
  },

  // ── Password Generator ────────────────────────────────────
  generatePassword() {
    const length = parseInt(document.getElementById("passLength")?.value || 16);
    const upper = document.getElementById("passUpper")?.checked ?? true;
    const lower = document.getElementById("passLower")?.checked ?? true;
    const numbers = document.getElementById("passNumbers")?.checked ?? true;
    const symbols = document.getElementById("passSymbols")?.checked ?? true;

    const password = AI.generatePassword(length, { upper, lower, numbers, symbols });
    const output = document.getElementById("passOutput");
    if (output) output.value = password;

    // Update strength
    this.updatePasswordStrength(password);
  },

  updatePasswordStrength(pass) {
    const meter = document.getElementById("passStrength");
    if (!meter) return;
    let score = 0;
    if (pass.length >= 12) score++;
    if (pass.length >= 16) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^a-zA-Z0-9]/.test(pass)) score++;

    const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
    const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];
    meter.style.width = (score * 20) + "%";
    meter.style.background = colors[score - 1] || "#ef4444";
    const label = document.getElementById("passStrengthLabel");
    if (label) label.textContent = labels[score - 1] || "Very Weak";
  },

  // ── Unit Converter ────────────────────────────────────────
  convertUnit() {
    const value = document.getElementById("unitValue")?.value || 0;
    const category = document.getElementById("unitCategory")?.value || "length";
    const from = document.getElementById("unitFrom")?.value;
    const to = document.getElementById("unitTo")?.value;

    const result = AI.unitConvert(value, from, to, category);
    const output = document.getElementById("unitResult");
    if (output) output.textContent = `${value} ${from} = ${result} ${to}`;
  },

  updateUnitOptions() {
    const category = document.getElementById("unitCategory")?.value || "length";
    const units = {
      length: ["m", "km", "cm", "mm", "ft", "inch", "mile"],
      weight: ["kg", "g", "lb", "oz", "ton"],
      temperature: ["c", "f", "k"],
      speed: ["m/s", "km/h", "mph", "knot"],
      data: ["b", "kb", "mb", "gb", "tb"]
    };

    const fromEl = document.getElementById("unitFrom");
    const toEl = document.getElementById("unitTo");
    if (!fromEl || !toEl) return;

    const opts = units[category] || [];
    const makeOptions = (selected) => opts.map(u =>
      `<option value="${u}" ${u === selected ? "selected" : ""}>${u.toUpperCase()}</option>`
    ).join("");

    fromEl.innerHTML = makeOptions(opts[0]);
    toEl.innerHTML = makeOptions(opts[1] || opts[0]);
  },

  // ── JSON Formatter ────────────────────────────────────────
  formatJSON() {
    const input = document.getElementById("jsonInput")?.value || "";
    const output = document.getElementById("jsonOutput");
    if (output) output.textContent = AI.formatJSON(input);
    if (window.hljs && output) hljs.highlightElement(output);
  },

  // ── Date Calculator ───────────────────────────────────────
  calculateDate() {
    const date1 = document.getElementById("dateInput1")?.value;
    const date2 = document.getElementById("dateInput2")?.value;
    const output = document.getElementById("dateResult");
    if (!output) return;

    if (date1 && date2) {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      const diff = Math.abs(d2 - d1);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const weeks = Math.floor(days / 7);
      const months = Math.floor(days / 30);
      output.innerHTML = `
        📅 <strong>${days}</strong> din<br>
        📅 <strong>${weeks}</strong> hafte<br>
        📅 <strong>~${months}</strong> mahine
      `;
    } else if (date1) {
      // Days from today
      const d1 = new Date(date1);
      const today = new Date();
      const diff = Math.abs(today - d1);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      output.innerHTML = `Aaj se <strong>${days}</strong> din ${d1 > today ? "baad" : "pehle"}`;
    }
  },

  // ── Notes ─────────────────────────────────────────────────
  saveNote() {
    const content = document.getElementById("noteInput")?.value || "";
    const title = document.getElementById("noteTitle")?.value || "Note " + new Date().toLocaleDateString();
    const notes = Storage.get("notes", []);
    notes.unshift({ id: UI.generateId(), title, content, createdAt: new Date().toISOString() });
    Storage.set("notes", notes);
    this.renderNotes();
    UI.toast("Note saved! 📝", "success");
    if (document.getElementById("noteInput")) document.getElementById("noteInput").value = "";
    if (document.getElementById("noteTitle")) document.getElementById("noteTitle").value = "";
  },

  renderNotes() {
    const list = document.getElementById("notesList");
    if (!list) return;
    const notes = Storage.get("notes", []);
    list.innerHTML = notes.length === 0
      ? '<p class="empty-msg">Koi note nahi hai</p>'
      : notes.map(n => `
        <div class="note-item">
          <div class="note-header">
            <strong>${n.title}</strong>
            <span>${UI.formatDate(n.createdAt)}</span>
          </div>
          <p>${n.content.substring(0, 100)}${n.content.length > 100 ? "..." : ""}</p>
          <div class="note-actions">
            <button onclick="ToolsPanel.copyNote('${n.id}')">📋 Copy</button>
            <button onclick="ToolsPanel.deleteNote('${n.id}')">🗑️ Delete</button>
          </div>
        </div>
      `).join("");
  },

  copyNote(id) {
    const notes = Storage.get("notes", []);
    const note = notes.find(n => n.id === id);
    if (note) UI.copyToClipboard(note.content);
  },

  async deleteNote(id) {
    const confirmed = await UI.confirm("Note delete karein?");
    if (confirmed) {
      const notes = Storage.get("notes", []).filter(n => n.id !== id);
      Storage.set("notes", notes);
      this.renderNotes();
    }
  }
};

window.ToolsPanel = ToolsPanel;
