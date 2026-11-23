/**
 * AJ AI - Modern Interactive Chatbot Front-End Engine
 * Supports Multi-Theme Wallpapers, Haryanvi/Hindi Voice, Virtual Keyboard, and Cross-Platform Layout.
 */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // DOM Elements Cache
    const form = document.getElementById("chatForm");
    const messageInput = document.getElementById("message");
    const sendBtn = document.getElementById("send");
    const micBtn = document.getElementById("micBtn");

    const messages = document.getElementById("messages");
    const welcome = document.getElementById("welcome");
    const chatArea = document.getElementById("chatArea");

    const historyList = document.getElementById("historyList");
    const searchInput = document.getElementById("searchInput");

    const clearHistoryBtn = document.getElementById("clearHistoryBtn");
    const newChatBtn = document.getElementById("newChatBtn");
    const autoSpeechBtn = document.getElementById("autoSpeechBtn");
    const langToggleBtn = document.getElementById("langToggleBtn");
    const langFlag = document.getElementById("langFlag");
    const langText = document.getElementById("langText");

    const desktopToggleBtn = document.getElementById("desktopToggleBtn");
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const sidebar = document.getElementById("sidebar");
    const sidebarClose = document.getElementById("sidebarClose");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    // Theme Modal Elements
    const themeModal = document.getElementById("themeModal");
    const themePickerBtn = document.getElementById("themePickerBtn");
    const themeModalOpenBtn = document.getElementById("themeModalOpenBtn");
    const themeModalCloseBtn = document.getElementById("themeModalCloseBtn");

    // Voice Modal Elements
    const voiceModal = document.getElementById("voiceModal");
    const voiceLiveText = document.getElementById("voiceLiveText");
    const voiceCancelBtn = document.getElementById("voiceCancelBtn");
    const voiceDoneBtn = document.getElementById("voiceDoneBtn");

    // Toast
    const toast = document.getElementById("toast");
    const toastText = document.getElementById("toastText");
    const toastIcon = document.getElementById("toastIcon");

    // State Variables
    let sending = false;
    let historyData = [];
    let recognition = null;
    let listening = false;
    let autoSpeakEnabled = false;
    let voiceLang = "hi-IN"; // Hindi & Haryanvi voice
    let interimTranscript = "";
    let finalTranscript = "";
    let contextActive = false;  // true when a file/text context is loaded

    /* =====================================================
       INITIALIZATION & MOBILE KEYBOARD SYNC
    ===================================================== */
    initThemes();
    initMobileKeyboard();
    loadHistory();
    setupVoice();
    setupTouchAndDesktopGestures();

    if (messageInput && window.innerWidth > 768) {
        messageInput.focus();
    }

    function initMobileKeyboard() {
        if (window.visualViewport) {
            const handleViewportChange = () => {
                const vh = window.visualViewport.height;
                document.documentElement.style.setProperty("--visual-vh", `${vh}px`);
                scrollBottom();
            };
            window.visualViewport.addEventListener("resize", handleViewportChange);
            window.visualViewport.addEventListener("scroll", handleViewportChange);
        }

        if (messageInput) {
            messageInput.addEventListener("focus", () => {
                setTimeout(() => {
                    scrollBottom();
                }, 300);
            });
        }
    }

    /* =====================================================
       WALLPAPER & THEME SYSTEM (6 THEMES)
    ===================================================== */
    function initThemes() {
        const savedTheme = localStorage.getItem("aj_ai_theme_pack") || "cyber";
        applyTheme(savedTheme);

        if (themePickerBtn) themePickerBtn.addEventListener("click", openThemeModal);
        if (themeModalOpenBtn) themeModalOpenBtn.addEventListener("click", openThemeModal);
        if (themeModalCloseBtn) themeModalCloseBtn.addEventListener("click", closeThemeModal);

        document.querySelectorAll(".theme-option").forEach(btn => {
            btn.addEventListener("click", function() {
                const themeName = this.getAttribute("data-set-theme");
                if (themeName) {
                    applyTheme(themeName);
                    closeThemeModal();
                    showToast(`Theme applied: ${themeName.toUpperCase()}`, "🎨");
                }
            });
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        if (theme === "light") {
            document.body.classList.add("light");
        } else {
            document.body.classList.remove("light");
        }
        localStorage.setItem("aj_ai_theme_pack", theme);

        document.querySelectorAll(".theme-option").forEach(btn => {
            if (btn.getAttribute("data-set-theme") === theme) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    }

    function openThemeModal() {
        if (themeModal) themeModal.classList.add("active");
    }

    function closeThemeModal() {
        if (themeModal) themeModal.classList.remove("active");
    }

    /* =====================================================
       AUTO-RESIZING TEXTAREA & SEND HANDLERS
    ===================================================== */
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            sendMessage();
        });
    }

    if (messageInput) {
        messageInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        messageInput.addEventListener("input", resizeInput);
    }

    function resizeInput() {
        if (!messageInput) return;
        messageInput.style.height = "auto";
        const height = Math.min(messageInput.scrollHeight, 140);
        messageInput.style.height = height + "px";
    }

    /* =====================================================
       MARKDOWN RENDERING HELPER (HI-TECH EDITION)
    ===================================================== */
    function renderMarkdown(text) {
        if (!text) return "";

        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Code blocks: ```language\ncode\n```
        html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
            const langLabel = lang ? lang.toUpperCase() : "CODE";
            return `<div class="code-block-container" style="background:rgba(5,8,18,0.85); border:1px solid rgba(99,102,241,0.25); border-radius:10px; margin:10px 0; overflow:hidden;">
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(99,102,241,0.12); padding:6px 12px; font-size:11px; font-weight:700; color:#818cf8; border-bottom:1px solid rgba(99,102,241,0.2);">
                    <span>⚡ ${langLabel}</span>
                    <button type="button" class="copy-code-btn" style="background:transparent; border:none; color:#cbd5e1; cursor:pointer; font-size:11px;" onclick="navigator.clipboard.writeText(this.closest('.code-block-container').querySelector('code').innerText); this.innerText='✓ Copied'; setTimeout(()=>this.innerText='📋 Copy', 2000);">📋 Copy</button>
                </div>
                <pre style="padding:12px; margin:0; overflow-x:auto;"><code style="font-family:'Consolas',monospace; font-size:13px; color:#f1f5f9;">${code.trim()}</code></pre>
            </div>`;
        });

        // Headers
        html = html.replace(/^### (.*$)/gim, '<h4 style="font-size:15px; font-weight:700; color:#818cf8; margin:12px 0 6px 0;">$1</h4>');
        html = html.replace(/^## (.*$)/gim, '<h3 style="font-size:16px; font-weight:700; color:#38bdf8; margin:14px 0 8px 0;">$1</h3>');
        html = html.replace(/^# (.*$)/gim, '<h2 style="font-size:18px; font-weight:800; color:#f1f5f9; margin:16px 0 8px 0;">$1</h2>');

        // Source Citation / Knowledge Base Source lines
        html = html.replace(/📄\s*\*\*(?:Knowledge Base Source|Source Document|Source):\*\*\s*`?([^`\n]+)`?/gi, '<div class="source-citation-badge">📄 Source: $1</div>');

        // Inline code: `code`
        html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(99,102,241,0.15); color:#a5b4fc; padding:2px 6px; border-radius:4px; font-size:13px;">$1</code>');

        // Bold: **text**
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

        // Italic: *text*
        html = html.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

        // Bullet lists
        html = html.replace(/(?:^|\n)(?:[-•*]\s+)(.+)/g, "<li style=\"margin-bottom:4px;\">$1</li>");
        html = html.replace(/(<li.*<\/li>)/gs, '<ul style="margin:8px 0 8px 20px; padding:0;">$1</ul>');

        // Horizontal rules
        html = html.replace(/^---$/gim, '<hr style="border:none; border-top:1px solid rgba(255,255,255,0.1); margin:12px 0;">');

        // Paragraphs & Line Breaks
        html = html.replace(/\n\n/g, "</p><p>");
        html = html.replace(/\n/g, "<br>");

        return `<p>${html}</p>`;
    }

    /* =====================================================
       SEND MESSAGE FLOW
    ===================================================== */
    async function sendMessage(overrideText = null) {
        if (sending || !messageInput) return;

        const question = (overrideText !== null ? overrideText : messageInput.value).trim();

        if (!question) {
            showToast("Pehle question enter karo ladle.", "!");
            messageInput.focus();
            return;
        }

        sending = true;
        if (sendBtn) sendBtn.disabled = true;

        if (welcome) welcome.classList.add("hidden");

        addMessage(question, "user");

        if (overrideText === null) {
            messageInput.value = "";
            resizeInput();
        }

        const typingId = showTyping();

        try {
            // Use context-aware endpoint if a file/paragraph is loaded
            const endpoint = contextActive ? "/ask-context" : "/ask";

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ question: question })
            });

            const data = await response.json();
            removeTyping(typingId);

            if (!response.ok || data.success !== true) {
                const errorMsg = data.answer || data.error || "Server error aa gaya.";
                addMessage("⚠️ " + errorMsg, "bot");
                showToast(errorMsg, "!");
                return;
            }

            const botAnswer = data.answer || "Answer nahi mila.";

            // Add context indicator to bot message if answered from uploaded file
            if (data.used_context) {
                addMessage("📄 *File context se jawab:*\n\n" + botAnswer, "bot", data.time);
            } else {
                addMessage(botAnswer, "bot", data.time);
            }

            await loadHistory();

            if (autoSpeakEnabled) {
                speakText(botAnswer);
            }

        } catch (error) {
            removeTyping(typingId);
            console.error("SEND ERROR:", error);
            addMessage("⚠️ Backend connection error. Make sure server is active.", "bot");
            showToast("Server connection error.", "!");

        } finally {
            sending = false;
            if (sendBtn) sendBtn.disabled = false;
            if (messageInput && window.innerWidth > 768) {
                messageInput.focus();
            }
        }
    }


    /* =====================================================
       MESSAGE RENDERING (WITH "AJ" LOGO AVATAR)
    ===================================================== */
    function addMessage(text, type, time = null) {
        if (!messages) return;

        const row = document.createElement("div");
        row.className = "message-row " + type;

        const avatar = document.createElement("div");
        avatar.className = "avatar";
        avatar.textContent = type === "user" ? "👤" : "AJ";

        const wrapper = document.createElement("div");
        wrapper.className = "message-wrapper";

        const bubble = document.createElement("div");
        bubble.className = "message";

        if (type === "user") {
            bubble.textContent = text;
        } else {
            bubble.innerHTML = renderMarkdown(text);
        }

        const meta = document.createElement("div");
        meta.className = "message-meta";
        meta.textContent = time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        wrapper.appendChild(bubble);

        if (type === "bot") {
            const actions = document.createElement("div");
            actions.className = "message-actions";

            const copyBtn = document.createElement("button");
            copyBtn.type = "button";
            copyBtn.className = "action-btn";
            copyBtn.innerHTML = "📋 Copy";
            copyBtn.addEventListener("click", () => {
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.innerHTML = "✓ Copied!";
                    showToast("Answer copied!", "✓");
                    setTimeout(() => { copyBtn.innerHTML = "📋 Copy"; }, 2000);
                });
            });

            const speakBtn = document.createElement("button");
            speakBtn.type = "button";
            speakBtn.className = "action-btn";
            speakBtn.innerHTML = "🔊 Listen";
            speakBtn.addEventListener("click", () => {
                toggleSpeech(text, speakBtn);
            });

            actions.appendChild(copyBtn);
            actions.appendChild(speakBtn);
            wrapper.appendChild(actions);
        }

        wrapper.appendChild(meta);
        row.appendChild(avatar);
        row.appendChild(wrapper);

        messages.appendChild(row);
        scrollBottom();
    }

    /* =====================================================
       TEXT TO SPEECH (TTS)
    ===================================================== */
    function speakText(text) {
        if (!("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();

        const cleanText = text.replace(/[*#`_~[\]()-]/g, "");
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.lang = voiceLang;

        window.speechSynthesis.speak(utterance);
    }

    function toggleSpeech(text, btn) {
        if (!("speechSynthesis" in window)) {
            showToast("Speech synthesis supported nahi hai.", "!");
            return;
        }

        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            btn.innerHTML = "🔊 Listen";
            return;
        }

        const cleanText = text.replace(/[*#`_~[\]()-]/g, "");
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.lang = voiceLang;

        utterance.onstart = () => {
            btn.innerHTML = "⏹️ Stop";
        };

        utterance.onend = () => {
            btn.innerHTML = "🔊 Listen";
        };

        utterance.onerror = () => {
            btn.innerHTML = "🔊 Listen";
        };

        window.speechSynthesis.speak(utterance);
    }

    if (autoSpeechBtn) {
        autoSpeechBtn.addEventListener("click", () => {
            autoSpeakEnabled = !autoSpeakEnabled;
            autoSpeechBtn.textContent = autoSpeakEnabled ? "🔊" : "🔇";
            autoSpeechBtn.title = autoSpeakEnabled ? "Auto Read Answers: ON" : "Auto Read Answers: OFF";
            showToast(autoSpeakEnabled ? "Auto voice reading ON" : "Auto voice reading OFF", autoSpeakEnabled ? "🔊" : "🔇");
        });
    }

    /* =====================================================
       TYPING INDICATOR & SCROLL
    ===================================================== */
    function showTyping() {
        const id = "typing-" + Date.now();
        const row = document.createElement("div");
        row.className = "message-row bot";
        row.id = id;

        const avatar = document.createElement("div");
        avatar.className = "avatar";
        avatar.textContent = "AJ";

        const wrapper = document.createElement("div");
        wrapper.className = "message-wrapper";

        const typing = document.createElement("div");
        typing.className = "message typing";
        typing.innerHTML = `<span></span><span></span><span></span>`;

        wrapper.appendChild(typing);
        row.appendChild(avatar);
        row.appendChild(wrapper);

        messages.appendChild(row);
        scrollBottom();
        return id;
    }

    function removeTyping(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollBottom() {
        if (!chatArea) return;
        requestAnimationFrame(() => {
            chatArea.scrollTop = chatArea.scrollHeight;
        });
    }

    /* =====================================================
       HISTORY MANAGEMENT
    ===================================================== */
    async function loadHistory() {
        if (!historyList) return;

        try {
            const response = await fetch("/history", { cache: "no-store" });
            if (!response.ok) throw new Error("History load failed.");

            const data = await response.json();
            const items = (data && data.history) ? data.history : [];

            historyData = items;
            renderHistory(historyData);

        } catch (error) {
            console.error("HISTORY ERROR:", error);
            historyList.innerHTML = `<div class="empty-history">⚠️ History load nahi hui</div>`;
        }
    }

    function renderHistory(items) {
        if (!historyList) return;
        historyList.innerHTML = "";

        if (!items || !items.length) {
            historyList.innerHTML = `<div class="empty-history">No chats yet</div>`;
            return;
        }

        items.forEach(item => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "history-item";

            const question = document.createElement("div");
            question.className = "history-question";
            question.textContent = item.user_question || item.question || "Untitled chat";

            const time = document.createElement("div");
            time.className = "history-time";
            time.textContent = formatTime(item.created_at || item.time);

            button.appendChild(question);
            button.appendChild(time);

            button.addEventListener("click", () => {
                showHistory(item);
                closeSidebar();
            });

            historyList.appendChild(button);
        });
    }

    function showHistory(item) {
        if (welcome) welcome.classList.add("hidden");
        if (messages) messages.innerHTML = "";

        addMessage(item.question, "user");
        addMessage(item.answer, "bot", item.time);
        scrollBottom();
    }

    function formatTime(value) {
        if (!value) return "";
        try {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return value;
            return date.toLocaleString([], {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
            });
        } catch {
            return value;
        }
    }

    if (searchInput) {
        searchInput.addEventListener("input", function () {
            const val = this.value.trim().toLowerCase();
            if (!val) {
                renderHistory(historyData);
                return;
            }
            const filtered = historyData.filter(item =>
                (item.question || "").toLowerCase().includes(val)
            );
            renderHistory(filtered);
        });
    }

    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener("click", async () => {
            if (!historyData.length) {
                showToast("History already empty hai.", "!");
                return;
            }

            if (!confirm("Saari chat history delete karni hai ladle?")) return;

            clearHistoryBtn.disabled = true;

            try {
                const response = await fetch("/clear-history", {
                    method: "POST",
                    headers: { "Accept": "application/json" }
                });

                const data = await response.json();

                if (!response.ok || data.success !== true) {
                    throw new Error(data.message || "History clear nahi hui.");
                }

                historyData = [];
                renderHistory([]);
                if (messages) messages.innerHTML = "";
                if (welcome) welcome.classList.remove("hidden");

                showToast("Chat history clear ho gayi.", "✓");

            } catch (error) {
                console.error(error);
                showToast(error.message || "History clear nahi hui.", "!");
            } finally {
                clearHistoryBtn.disabled = false;
            }
        });
    }

    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => {
            if (messages) messages.innerHTML = "";
            if (welcome) welcome.classList.remove("hidden");
            if (messageInput) {
                messageInput.value = "";
                resizeInput();
                messageInput.focus();
            }
            closeSidebar();
        });
    }

    document.querySelectorAll(".suggestion").forEach(button => {
        button.addEventListener("click", function () {
            const q = this.getAttribute("data-question");
            if (q) {
                sendMessage(q);
            }
        });
    });

    /* =====================================================
       VOICE INPUT (SPEECH RECOGNITION & MODAL WAVEFORM)
    ===================================================== */
    function setupVoice() {
        if (!micBtn) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            micBtn.title = "Voice input is not supported in this browser.";
            micBtn.addEventListener("click", () => {
                showToast("Voice recognition not supported in this browser.", "!");
            });
            return;
        }

        try {
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = voiceLang;

            recognition.onstart = () => {
                listening = true;
                micBtn.classList.add("listening");
                if (voiceModal) voiceModal.classList.add("active");
                if (voiceLiveText) voiceLiveText.textContent = "Listening... Bolna shuru karein";
                finalTranscript = "";
                interimTranscript = "";
                if (navigator.vibrate) navigator.vibrate([30]);
            };

            recognition.onresult = (event) => {
                interimTranscript = "";
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const trans = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += trans + " ";
                    } else {
                        interimTranscript += trans;
                    }
                }
                const display = (finalTranscript + interimTranscript).trim();
                if (voiceLiveText && display) {
                    voiceLiveText.textContent = `"${display}"`;
                }
                if (messageInput) {
                    messageInput.value = display;
                    resizeInput();
                }
            };

            recognition.onerror = (event) => {
                console.error("VOICE ERROR:", event.error);
                stopVoiceModal();
                if (event.error === "not-allowed") {
                    showToast("Microphone permission allow karein.", "!");
                } else if (event.error === "no-speech") {
                    showToast("Kuch suna nahi gaya. Dobara boliye.", "!");
                }
            };

            recognition.onend = () => {
                listening = false;
                micBtn.classList.remove("listening");
            };

            micBtn.addEventListener("click", toggleVoiceModal);

            if (voiceCancelBtn) {
                voiceCancelBtn.addEventListener("click", () => {
                    stopVoiceModal();
                    if (messageInput) {
                        messageInput.value = "";
                        resizeInput();
                    }
                });
            }

            if (voiceDoneBtn) {
                voiceDoneBtn.addEventListener("click", () => {
                    const textToSend = (finalTranscript + interimTranscript).trim() || (messageInput ? messageInput.value.trim() : "");
                    stopVoiceModal();
                    if (textToSend) {
                        sendMessage(textToSend);
                    }
                });
            }

        } catch (e) {
            console.warn("Speech recognition init error", e);
        }
    }

    function toggleVoiceModal() {
        if (!recognition) return;
        if (listening) {
            stopVoiceModal();
        } else {
            try {
                recognition.lang = voiceLang;
                recognition.start();
            } catch (err) {
                console.error("Mic start error:", err);
            }
        }
    }

    function stopVoiceModal() {
        listening = false;
        if (recognition) {
            try { recognition.stop(); } catch (e) {}
        }
        if (micBtn) micBtn.classList.remove("listening");
        if (voiceModal) voiceModal.classList.remove("active");
    }

    // Language Toggle (Hindi / Haryanvi / English)
    if (langToggleBtn) {
        langToggleBtn.addEventListener("click", () => {
            if (voiceLang === "hi-IN") {
                voiceLang = "en-IN";
                if (langFlag) langFlag.textContent = "🌐";
                if (langText) langText.textContent = "EN";
                showToast("Voice language: English", "🌐");
            } else {
                voiceLang = "hi-IN";
                if (langFlag) langFlag.textContent = "🇮🇳";
                if (langText) langText.textContent = "HI";
                showToast("Voice language: Hindi / हरियाणवी", "🇮🇳");
            }
            if (recognition) {
                recognition.lang = voiceLang;
            }
        });
    }

    /* =====================================================
       TOUCH & DESKTOP GESTURES
    ===================================================== */
    function setupTouchAndDesktopGestures() {
        // Desktop Toggle
        if (desktopToggleBtn) {
            desktopToggleBtn.addEventListener("click", () => {
                if (sidebar) sidebar.classList.toggle("desktop-collapsed");
            });
        }

        // Mobile Menu
        if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", openSidebar);
        if (sidebarClose) sidebarClose.addEventListener("click", closeSidebar);
        if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);

        // Touch Swipe
        if (sidebar) {
            let startX = 0;
            sidebar.addEventListener("touchstart", (e) => {
                startX = e.touches[0].clientX;
            }, { passive: true });

            sidebar.addEventListener("touchend", (e) => {
                const diffX = startX - e.changedTouches[0].clientX;
                if (diffX > 60) {
                    closeSidebar();
                }
            }, { passive: true });
        }
    }

    function openSidebar() {
        if (sidebar) sidebar.classList.add("open");
        if (sidebarOverlay) sidebarOverlay.classList.add("show");
    }

    function closeSidebar() {
        if (sidebar) sidebar.classList.remove("open");
        if (sidebarOverlay) sidebarOverlay.classList.remove("show");
    }

    /* =====================================================
       TOAST NOTIFICATION
    ===================================================== */
    let toastTimer;
    function showToast(msg, icon = "✓") {
        if (!toast || !toastText || !toastIcon) return;

        toastText.textContent = msg;
        toastIcon.textContent = icon;
        toast.classList.add("show");

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 2800);
    }

    /* =====================================================
       FILE CONTEXT MODULE — Upload & Context-Aware Q&A
    ===================================================== */
    // (contextActive declared at top of state variables)

    const attachBtn          = document.getElementById("attachBtn");
    const contextModal       = document.getElementById("contextModal");
    const contextModalClose  = document.getElementById("contextModalCloseBtn");
    const contextBanner      = document.getElementById("contextBanner");
    const contextBannerText  = document.getElementById("contextBannerText");
    const contextClearBtn    = document.getElementById("contextClearBtn");

    // Tabs
    const contextTabs        = document.querySelectorAll(".context-tab");
    const tabFile            = document.getElementById("tabFile");
    const tabText            = document.getElementById("tabText");

    // File tab elements
    const fileDropZone       = document.getElementById("fileDropZone");
    const fileInput          = document.getElementById("fileInput");
    const fileSelectedInfo   = document.getElementById("fileSelectedInfo");
    const fileSelectedName   = document.getElementById("fileSelectedName");
    const fileRemoveBtn      = document.getElementById("fileRemoveBtn");
    const fileUploadBtn      = document.getElementById("fileUploadBtn");

    // Text tab elements
    const paragraphInput     = document.getElementById("paragraphInput");
    const paragraphSubmitBtn = document.getElementById("paragraphSubmitBtn");
    const paraCharCount      = document.getElementById("paraCharCount");

    // Preview
    const contextPreview     = document.getElementById("contextPreview");
    const contextPreviewTitle= document.getElementById("contextPreviewTitle");
    const contextPreviewText = document.getElementById("contextPreviewText");
    const contextUseBtn      = document.getElementById("contextUseBtn");

    // ── Open / Close modal ────────────────────────────────────────────────────
    if (attachBtn) {
        attachBtn.addEventListener("click", () => {
            if (contextModal) contextModal.classList.add("open");
        });
    }
    function closeContextModal() {
        if (contextModal) contextModal.classList.remove("open");
    }
    if (contextModalClose) contextModalClose.addEventListener("click", closeContextModal);
    if (contextModal) {
        contextModal.addEventListener("click", (e) => {
            if (e.target === contextModal) closeContextModal();
        });
    }

    // ── Tabs ──────────────────────────────────────────────────────────────────
    contextTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            contextTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            const which = tab.dataset.tab;
            if (tabFile) tabFile.style.display = which === "file" ? "block" : "none";
            if (tabText) tabText.style.display = which === "text" ? "block" : "none";
        });
    });

    // ── File Drop Zone ────────────────────────────────────────────────────────
    let selectedFile = null;

    function setSelectedFile(file) {
        selectedFile = file;
        if (fileSelectedInfo) fileSelectedInfo.style.display = "flex";
        if (fileSelectedName) fileSelectedName.textContent = "📄 " + file.name;
        if (fileDropZone)   fileDropZone.style.display = "none";
        if (fileUploadBtn)  fileUploadBtn.disabled = false;
    }
    function clearSelectedFile() {
        selectedFile = null;
        if (fileSelectedInfo) fileSelectedInfo.style.display = "none";
        if (fileDropZone)   fileDropZone.style.display = "block";
        if (fileUploadBtn)  fileUploadBtn.disabled = true;
        if (fileInput)      fileInput.value = "";
    }

    if (fileDropZone) {
        fileDropZone.addEventListener("click", () => fileInput && fileInput.click());
        fileDropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            fileDropZone.classList.add("dragover");
        });
        fileDropZone.addEventListener("dragleave", () => fileDropZone.classList.remove("dragover"));
        fileDropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            fileDropZone.classList.remove("dragover");
            const file = e.dataTransfer.files[0];
            if (file) setSelectedFile(file);
        });
    }
    if (fileInput) {
        fileInput.addEventListener("change", () => {
            if (fileInput.files[0]) setSelectedFile(fileInput.files[0]);
        });
    }
    if (fileRemoveBtn) fileRemoveBtn.addEventListener("click", clearSelectedFile);

    // ── File Upload ───────────────────────────────────────────────────────────
    if (fileUploadBtn) {
        fileUploadBtn.addEventListener("click", async () => {
            if (!selectedFile) return;
            fileUploadBtn.disabled = true;
            fileUploadBtn.textContent = "⏳ Uploading...";

            const formData = new FormData();
            formData.append("file", selectedFile);

            try {
                const res  = await fetch("/upload-context", { method: "POST", body: formData });
                const data = await res.json();

                if (data.success) {
                    showContextPreview(data.message, data.preview, data.filename, data.char_count);
                    setContextBanner(data.filename, data.char_count);
                    showToast("✅ File uploaded & context set!", "📎");
                } else {
                    showToast("❌ " + (data.error || "Upload failed"), "!");
                }
            } catch (err) {
                showToast("❌ Upload error: " + err.message, "!");
            } finally {
                fileUploadBtn.disabled = false;
                fileUploadBtn.textContent = "⬆️ Upload & Set Context";
            }
        });
    }

    // ── Paragraph Submit ──────────────────────────────────────────────────────
    if (paragraphInput) {
        paragraphInput.addEventListener("input", () => {
            const len = paragraphInput.value.length;
            if (paraCharCount) paraCharCount.textContent = len;
            if (paragraphSubmitBtn) paragraphSubmitBtn.disabled = len < 10;
        });
    }
    if (paragraphSubmitBtn) {
        paragraphSubmitBtn.addEventListener("click", async () => {
            const text = paragraphInput ? paragraphInput.value.trim() : "";
            if (!text || text.length < 10) return;

            paragraphSubmitBtn.disabled = true;
            paragraphSubmitBtn.textContent = "⏳ Setting...";

            const formData = new FormData();
            formData.append("paragraph", text);

            try {
                const res  = await fetch("/upload-context", { method: "POST", body: formData });
                const data = await res.json();

                if (data.success) {
                    showContextPreview(data.message, data.preview, "Text Input", data.char_count);
                    setContextBanner("Text Input", data.char_count);
                    showToast("✅ Text context ready!", "📝");
                } else {
                    showToast("❌ " + (data.error || "Failed"), "!");
                }
            } catch (err) {
                showToast("❌ Error: " + err.message, "!");
            } finally {
                paragraphSubmitBtn.disabled = false;
                paragraphSubmitBtn.textContent = "✅ Set as Context";
            }
        });
    }

    // ── Show preview after upload ─────────────────────────────────────────────
    function showContextPreview(message, preview, filename, charCount) {
        contextActive = true;
        if (contextPreview) contextPreview.style.display = "block";
        if (contextPreviewTitle) contextPreviewTitle.textContent = `✅ "${filename}" ready! (${charCount} chars)`;
        if (contextPreviewText) contextPreviewText.textContent = preview || "";
        if (attachBtn) attachBtn.classList.add("context-active");
    }

    function setContextBanner(filename, charCount) {
        if (contextBanner) contextBanner.style.display = "flex";
        if (contextBannerText) {
            contextBannerText.textContent = `📄 "${filename}" loaded — Context mode ON (${charCount} chars)`;
        }
    }

    // ── "Ab Questions Poochho" button ─────────────────────────────────────────
    if (contextUseBtn) {
        contextUseBtn.addEventListener("click", () => {
            closeContextModal();
            if (messageInput) {
                messageInput.placeholder = "File ke baare mein question poochho...";
                messageInput.focus();
            }
            showToast("💬 Ab questions poochho! Context mode active hai.", "📎");
        });
    }

    // ── Clear Context ─────────────────────────────────────────────────────────
    if (contextClearBtn) {
        contextClearBtn.addEventListener("click", async () => {
            try {
                await fetch("/clear-context", { method: "POST" });
            } catch (_) { /* ignore */ }
            contextActive = false;
            if (contextBanner) contextBanner.style.display = "none";
            if (contextPreview) contextPreview.style.display = "none";
            if (attachBtn) attachBtn.classList.remove("context-active");
            if (messageInput) messageInput.placeholder = "Message AJ AI... (Hindi / Haryanvi / English)";
            clearSelectedFile();
            if (paragraphInput) paragraphInput.value = "";
            if (paraCharCount) paraCharCount.textContent = "0";
            showToast("🗑️ Context clear ho gaya! Normal chat mode.", "✓");
        });
    }

    // ── Check context status on page load ────────────────────────────────────
    (async () => {
        try {
            const res  = await fetch("/context-status");
            const data = await res.json();
            if (data.has_context) {
                contextActive = true;
                setContextBanner("Loaded File", data.char_count);
                if (attachBtn) attachBtn.classList.add("context-active");
            }
        } catch (_) { /* ignore */ }
    })();

    /* =====================================================
       HI-TECH DOC AI & KNOWLEDGE BASE INTEGRATION
    ===================================================== */
    // 1. Fetch & display real-time Knowledge Base status
    async function loadKbStats() {
        const badge = document.getElementById("topbarKbText");
        const pill = document.getElementById("topbarKbPill");
        if (!badge) return;
        try {
            const res = await fetch("/api/kb-stats");
            const data = await res.json();
            if (data.success) {
                if (data.total_docs > 0) {
                    badge.textContent = `Doc AI: ${data.total_docs} Docs Loaded`;
                    if (pill) pill.title = `${data.total_docs} documents (${data.total_chunks} chunks) in AI memory • Engine: ${data.engine}`;
                } else {
                    badge.textContent = `Doc AI Ready`;
                    if (pill) pill.title = "No documents uploaded yet. Click 📎 to upload!";
                }
            }
        } catch (e) {
            badge.textContent = "Doc AI Online";
        }
    }
    loadKbStats();

    // 2. Click on Topbar KB Pill opens quick document list or info
    const topbarKbPill = document.getElementById("topbarKbPill");
    if (topbarKbPill) {
        topbarKbPill.addEventListener("click", () => {
            const attach = document.getElementById("attachBtn");
            if (attach) attach.click();
        });
    }

    // 3. Prompt Action Chips Handlers
    document.querySelectorAll(".chip-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const prompt = btn.getAttribute("data-prompt");
            if (prompt) {
                sendMessage(prompt);
            }
        });
    });

    // 4. Futuristic Full-Screen Drag & Drop Ingestion
    const dragOverlay = document.getElementById("chatDragOverlay");
    let dragCounter = 0;

    window.addEventListener("dragenter", (e) => {
        e.preventDefault();
        dragCounter++;
        if (dragOverlay) dragOverlay.classList.add("active");
    });

    window.addEventListener("dragover", (e) => {
        e.preventDefault();
    });

    window.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0 && dragOverlay) {
            dragOverlay.classList.remove("active");
            dragCounter = 0;
        }
    });

    window.addEventListener("drop", async (e) => {
        e.preventDefault();
        dragCounter = 0;
        if (dragOverlay) dragOverlay.classList.remove("active");

        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            showToast(`⚡ AI is analyzing: ${file.name}...`, "📄");

            const formData = new FormData();
            formData.append("file", file);

            try {
                const res = await fetch("/upload-context", { method: "POST", body: formData });
                const data = await res.json();
                if (data.success) {
                    showContextPreview(data.message, data.preview, data.filename, data.char_count);
                    setContextBanner(data.filename, data.char_count);
                    if (welcome) welcome.classList.add("hidden");
                    addMessage(`📄 **${data.filename}** (${data.file_type.toUpperCase()}) successfully ingested into AI Knowledge Base!\n\n${data.preview ? `*Preview:* "${data.preview.slice(0, 150)}..."\n\n` : ''}Ab aap is document ke baare mein koi bhi sawal poochh sakte hain!`, "bot");
                    loadKbStats();
                    showToast(`✅ "${data.filename}" ready!`, "⚡");
                } else {
                    showToast(`❌ ${data.error || 'Upload failed'}`, "!");
                }
            } catch (err) {
                showToast(`❌ Error: ${err.message}`, "!");
            }
        }
    });

});

