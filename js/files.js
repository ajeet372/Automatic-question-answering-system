// ============================================================
//  files.js — File reading, PDF text extraction, text tools
// ============================================================

const FileTools = {

  // ── Read text file ────────────────────────────────────────
  readTextFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) { reject("No file selected"); return; }
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, "UTF-8");
    });
  },

  // ── Read PDF using PDF.js ─────────────────────────────────
  async readPDF(file) {
    if (!window.pdfjsLib) {
      return "❌ PDF.js library load nahi hua. Internet connection check karein ya file ko text format mein save karein.";
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    let pageTexts = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(" ");
      pageTexts.push(`--- Page ${i} ---\n${pageText}`);
      text += pageText + "\n";
    }

    return {
      fullText: text,
      pages: pageTexts,
      pageCount: pdf.numPages,
      wordCount: AI.wordCount(text)
    };
  },

  // ── Handle file upload in tools panel ────────────────────
  async handleFileUpload(event, type = "text") {
    const file = event.target.files[0];
    if (!file) return;

    const settings = Storage.getSettings();
    const maxSize = (settings.maxUploadMB || 10) * 1024 * 1024;

    if (file.size > maxSize) {
      UI.toast(`File size limit ${settings.maxUploadMB}MB hai!`, "error");
      return;
    }

    const output = document.getElementById("fileOutput");
    const stats = document.getElementById("fileStats");
    if (!output) return;

    output.textContent = "Loading...";
    Storage.trackEvent("feature", { name: "fileUpload" });

    try {
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const result = await this.readPDF(file);
        if (typeof result === "string") {
          output.textContent = result;
        } else {
          output.textContent = result.fullText;
          if (stats) {
            stats.innerHTML = `
              📄 Pages: <b>${result.pageCount}</b> |
              📝 Words: <b>${result.wordCount.words}</b> |
              🔤 Characters: <b>${result.wordCount.characters}</b>
            `;
          }
        }
        UI.toast("PDF read ho gaya! 📄", "success");
      } else {
        const text = await this.readTextFile(file);
        output.textContent = text;
        const wc = AI.wordCount(text);
        if (stats) {
          stats.innerHTML = `
            📝 Words: <b>${wc.words}</b> |
            🔤 Characters: <b>${wc.characters}</b> |
            📋 Size: <b>${UI.formatFileSize(file.size)}</b>
          `;
        }
        UI.toast("File read ho gaya! 📄", "success");
      }
    } catch (err) {
      output.textContent = "❌ File read karne mein error: " + err.message;
      Storage.trackEvent("error", { message: err.message, type: "file_read" });
      UI.toast("File read karne mein error aaya!", "error");
    }
  },

  // ── Download text as file ─────────────────────────────────
  downloadText(content, filename = "output.txt") {
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  // ── Copy file output ──────────────────────────────────────
  copyFileOutput() {
    const output = document.getElementById("fileOutput");
    if (output) UI.copyToClipboard(output.textContent);
  },

  // ── Chat file upload ──────────────────────────────────────
  async handleChatFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const settings = Storage.getSettings();
    const maxSize = (settings.maxUploadMB || 10) * 1024 * 1024;

    if (file.size > maxSize) {
      UI.toast(`File too large! Max: ${settings.maxUploadMB}MB`, "error");
      return;
    }

    UI.toast(`Reading ${file.name}...`, "info", 2000);

    let content = "";
    try {
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const result = await this.readPDF(file);
        if (typeof result === "string") content = result;
        else content = result.fullText;
      } else {
        content = await this.readTextFile(file);
      }

      // Truncate if too long
      if (content.length > 5000) {
        content = content.substring(0, 5000) + "\n\n[... Aur content hai, truncated]";
      }

      const prompt = `Mujhe is file ke baare mein bata: **${file.name}**\n\nContent:\n\`\`\`\n${content}\n\`\`\``;
      Chat.sendMessage(prompt);

    } catch (err) {
      UI.toast("File read error: " + err.message, "error");
    }

    event.target.value = "";
  }
};

window.FileTools = FileTools;
