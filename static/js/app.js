/**
 * AJ AI - Modern Interactive Chatbot Application
 * Handles chat sessions, API requests, voice input/output, markdown rendering, themes, and full mobile responsiveness.
 */

(function () {
    "use strict";

    // --- State Variables ---
    let chats = [];
    let currentChatId = null;
    let isGenerating = false;
    let currentSpeech = null;
    let speechRecognition = null;
    let isListening = false;

    // DOM Elements Cache (populated in init)
    let elements = {};

    function queryElements() {
        elements = {
            messagesContainer: document.getElementById("messagesContainer"),
            messagesInner: document.getElementById("messagesInner"),
            welcomeHero: document.getElementById("welcomeHero"),
            messageInput: document.getElementById("messageInput"),
            sendBtn: document.getElementById("sendBtn"),
            voiceBtn: document.getElementById("voiceBtn"),
            historyList: document.getElementById("historyList"),
            historyEmpty: document.getElementById("historyEmpty"),
            searchInput: document.getElementById("searchInput"),
            sidebar: document.getElementById("sidebar"),
            sidebarOverlay: document.getElementById("sidebarOverlay"),
            menuToggleBtn: document.getElementById("menuToggleBtn"),
            closeSidebarBtn: document.getElementById("closeSidebarBtn"),
            themeToggleBtn: document.getElementById("themeToggleBtn"),
            sideThemeBtn: document.getElementById("sideThemeBtn"),
            themeIcon: document.getElementById("themeIcon"),
            topicsCountBadge: document.getElementById("topicsCountBadge"),
            toastNotice: document.getElementById("toastNotice"),
            suggestionsGrid: document.getElementById("suggestionsGrid"),
            newChatBtn: document.getElementById("newChatBtn"),
            headerNewChatBtn: document.getElementById("headerNewChatBtn"),
            clearHistoryBtn: document.getElementById("clearHistoryBtn")
        };
    }

    // --- Markdown Formatting Helper ---
    function formatMarkdown(text) {
        if (!text) return "";

        // Escape raw HTML first
        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Code blocks: ```language\ncode\n```
        html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function (_, lang, code) {
            return `<pre><code>${code.trim()}</code></pre>`;
        });

        // Inline code: `code`
        html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

        // Bold: **text**
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

        // Italic: *text*
        html = html.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

        // Bullet lists: - text or • text
        html = html.replace(/(?:^|\n)(?:[-•*]\s+)(.+)/g, "<li>$1</li>");
        html = html.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");

        // Line breaks
        html = html.replace(/\n\n/g, "</p><p>");
        html = html.replace(/\n/g, "<br>");

        return `<p>${html}</p>`;
    }

    function formatTime(dateObj = new Date()) {
        const d = new Date(dateObj);
        let hours = d.getHours();
        const minutes = d.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        return `${hours}:${minutes} ${ampm}`;
    }

    function showToast(msg) {
        if (!elements.toastNotice) return;
        elements.toastNotice.textContent = msg;
        elements.toastNotice.classList.add("show");
        setTimeout(() => {
            elements.toastNotice.classList.remove("show");
        }, 2200);
    }

    // --- Theme Management ---
    function initTheme() {
        const savedTheme = localStorage.getItem("aj_ai_theme") || "dark";
        applyTheme(savedTheme);
    }

    function applyTheme(theme) {
        if (theme === "light") {
            document.body.classList.add("light-theme");
            if (elements.themeIcon) elements.themeIcon.textContent = "🌙";
        } else {
            document.body.classList.remove("light-theme");
            if (elements.themeIcon) elements.themeIcon.textContent = "☀️";
        }
        localStorage.setItem("aj_ai_theme", theme);
    }

    function toggleTheme() {
        const isLight = document.body.classList.contains("light-theme");
        applyTheme(isLight ? "dark" : "light");
    }

    // --- Chat Session Management ---
    function loadSavedChats() {
        try {
            const stored = localStorage.getItem("aj_ai_chats");
            chats = stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error("Failed to load stored chats", e);
            chats = [];
        }
    }

    function saveChatsToStorage() {
        try {
            localStorage.setItem("aj_ai_chats", JSON.stringify(chats));
        } catch (e) {
            console.error("Failed to save chats", e);
        }
    }

    function startNewChat() {
        currentChatId = Date.now();
        if (elements.messagesInner) {
            elements.messagesInner.innerHTML = "";
            if (elements.welcomeHero) {
                elements.messagesInner.appendChild(elements.welcomeHero);
                elements.welcomeHero.style.display = "block";
            }
        }

        if (elements.messageInput) {
            elements.messageInput.value = "";
            autoResizeInput();
            updateSendButton();
        }

        renderHistoryList();
        closeSidebar();
        if (elements.messageInput && window.innerWidth > 768) {
            elements.messageInput.focus();
        }
    }

    function switchChat(chatId) {
        const found = chats.find(c => c.id === chatId);
        if (!found) return;

        currentChatId = chatId;
        if (elements.messagesInner) {
            elements.messagesInner.innerHTML = "";
            if (elements.welcomeHero) {
                elements.welcomeHero.style.display = "none";
            }

            found.messages.forEach(msg => {
                renderMessage(msg.role, msg.text, msg.suggestions || [], msg.time, false);
            });
        }

        renderHistoryList();
        closeSidebar();
        scrollToBottom();
    }

    function deleteChat(chatId, event) {
        if (event) event.stopPropagation();
        chats = chats.filter(c => c.id !== chatId);
        saveChatsToStorage();

        if (currentChatId === chatId) {
            startNewChat();
        } else {
            renderHistoryList();
        }
        showToast("Chat deleted");
    }

    function clearAllChats() {
        if (!chats.length) {
            showToast("Chat history is already empty");
            return;
        }
        if (confirm("Are you sure you want to clear all chat history?")) {
            chats = [];
            saveChatsToStorage();
            startNewChat();
            showToast("All chat history cleared");
        }
    }

    function renderHistoryList(filterText = "") {
        if (!elements.historyList) return;

        const term = filterText.toLowerCase().trim();
        const filtered = chats.filter(c => c.title.toLowerCase().includes(term));

        elements.historyList.innerHTML = "";

        if (!filtered.length) {
            if (elements.historyEmpty) {
                elements.historyEmpty.textContent = term ? "No chats found" : "No chat history yet";
                elements.historyEmpty.style.display = "block";
                elements.historyList.appendChild(elements.historyEmpty);
            }
            return;
        }

        if (elements.historyEmpty) {
            elements.historyEmpty.style.display = "none";
        }

        filtered.forEach(chat => {
            const item = document.createElement("div");
            item.className = "history-item" + (chat.id === currentChatId ? " active" : "");
            
            item.innerHTML = `
                <span class="chat-icon">💬</span>
                <span class="chat-title" title="${escapeHtml(chat.title)}">${escapeHtml(chat.title)}</span>
                <button class="delete-chat-btn" title="Delete chat">✕</button>
            `;

            item.addEventListener("click", () => switchChat(chat.id));
            
            const delBtn = item.querySelector(".delete-chat-btn");
            if (delBtn) {
                delBtn.addEventListener("click", (e) => deleteChat(chat.id, e));
            }

            elements.historyList.appendChild(item);
        });
    }

    function escapeHtml(str) {
        return (str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    // --- Message Rendering ---
    function renderMessage(role, text, suggestions = [], time = null, shouldScroll = true) {
        if (elements.welcomeHero && elements.welcomeHero.style.display !== "none") {
            elements.welcomeHero.style.display = "none";
        }

        const msgTime = time || formatTime();
        const row = document.createElement("div");
        row.className = `message-row ${role}`;

        const isUser = role === "user";
        const avatarText = isUser ? "👤" : "✦";
        const senderName = isUser ? "You" : "aj ai";

        let suggestionsHtml = "";
        if (!isUser && suggestions && suggestions.length > 0) {
            suggestionsHtml = `
                <div class="bot-suggestions">
                    ${suggestions.map(s => `
                        <button class="suggestion-pill" data-query="${escapeHtml(s)}">
                            <span>💡</span> ${escapeHtml(s)}
                        </button>
                    `).join("")}
                </div>
            `;
        }

        const actionsHtml = !isUser ? `
            <div class="message-actions">
                <button class="action-btn copy-btn" title="Copy text">
                    📋 <span>Copy</span>
                </button>
                <button class="action-btn speak-btn" title="Listen">
                    🔊 <span>Listen</span>
                </button>
            </div>
        ` : "";

        row.innerHTML = `
            <div class="message-avatar">${avatarText}</div>
            <div class="message-content-wrapper">
                <div class="message-header">
                    <span>${senderName}</span>
                    <span>•</span>
                    <span>${msgTime}</span>
                </div>
                <div class="message-bubble">
                    ${isUser ? `<p>${escapeHtml(text)}</p>` : formatMarkdown(text)}
                </div>
                ${suggestionsHtml}
                ${actionsHtml}
            </div>
        `;

        // Event listeners for suggestion pills
        row.querySelectorAll(".suggestion-pill").forEach(btn => {
            btn.addEventListener("click", () => {
                const query = btn.getAttribute("data-query");
                if (query) sendUserMessage(query);
            });
        });

        // Event listener for Copy
        const copyBtn = row.querySelector(".copy-btn");
        if (copyBtn) {
            copyBtn.addEventListener("click", () => {
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.innerHTML = "✓ <span>Copied!</span>";
                    showToast("Answer copied to clipboard!");
                    setTimeout(() => {
                        copyBtn.innerHTML = "📋 <span>Copy</span>";
                    }, 2000);
                });
            });
        }

        // Event listener for Speech
        const speakBtn = row.querySelector(".speak-btn");
        if (speakBtn) {
            speakBtn.addEventListener("click", () => {
                toggleSpeech(text, speakBtn);
            });
        }

        if (elements.messagesInner) {
            elements.messagesInner.appendChild(row);
        }

        if (shouldScroll) {
            scrollToBottom();
        }
    }

    // --- Typing Indicator ---
    function showTypingIndicator() {
        const row = document.createElement("div");
        row.id = "typingIndicator";
        row.className = "message-row bot typing-row";
        row.innerHTML = `
            <div class="message-avatar">✦</div>
            <div class="message-content-wrapper">
                <div class="message-header">
                    <span>aj ai</span>
                    <span>•</span>
                    <span>Thinking...</span>
                </div>
                <div class="typing-bubble">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        if (elements.messagesInner) {
            elements.messagesInner.appendChild(row);
        }
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const ind = document.getElementById("typingIndicator");
        if (ind) ind.remove();
    }

    function scrollToBottom() {
        if (!elements.messagesContainer) return;
        requestAnimationFrame(() => {
            elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        });
    }

    // --- Text to Speech (TTS) ---
    function toggleSpeech(text, btn) {
        if (!("speechSynthesis" in window)) {
            showToast("Speech synthesis is not supported in this browser.");
            return;
        }

        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            if (btn) {
                btn.classList.remove("active");
                btn.innerHTML = "🔊 <span>Listen</span>";
            }
            if (currentSpeech === text) {
                currentSpeech = null;
                return;
            }
        }

        const cleanText = text.replace(/[*#`_~[\]()-]/g, "");
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
            currentSpeech = text;
            if (btn) {
                btn.classList.add("active");
                btn.innerHTML = "⏹️ <span>Stop</span>";
            }
        };

        utterance.onend = () => {
            currentSpeech = null;
            if (btn) {
                btn.classList.remove("active");
                btn.innerHTML = "🔊 <span>Listen</span>";
            }
        };

        utterance.onerror = () => {
            currentSpeech = null;
            if (btn) {
                btn.classList.remove("active");
                btn.innerHTML = "🔊 <span>Listen</span>";
            }
        };

        window.speechSynthesis.speak(utterance);
    }

    // --- Speech Recognition (Voice Input) ---
    function initSpeechRecognition() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            if (elements.voiceBtn) {
                elements.voiceBtn.style.display = "none";
            }
            return;
        }

        try {
            speechRecognition = new SpeechRec();
            speechRecognition.continuous = false;
            speechRecognition.interimResults = false;
            speechRecognition.lang = "en-US";

            speechRecognition.onstart = () => {
                isListening = true;
                if (elements.voiceBtn) elements.voiceBtn.classList.add("listening");
                if (elements.messageInput) elements.messageInput.placeholder = "Listening... speak now";
            };

            speechRecognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                if (transcript && elements.messageInput) {
                    elements.messageInput.value = transcript;
                    autoResizeInput();
                    updateSendButton();
                    sendUserMessage(transcript);
                }
            };

            speechRecognition.onerror = (event) => {
                console.warn("Speech recognition error:", event.error);
                stopVoiceInput();
            };

            speechRecognition.onend = () => {
                stopVoiceInput();
            };
        } catch (e) {
            console.warn("Speech recognition init failed", e);
        }
    }

    function toggleVoiceInput() {
        if (!speechRecognition) {
            showToast("Voice recognition is not supported in this browser.");
            return;
        }

        if (isListening) {
            speechRecognition.stop();
            stopVoiceInput();
        } else {
            try {
                speechRecognition.start();
            } catch (err) {
                console.error("Could not start speech recognition", err);
            }
        }
    }

    function stopVoiceInput() {
        isListening = false;
        if (elements.voiceBtn) {
            elements.voiceBtn.classList.remove("listening");
        }
        if (elements.messageInput) {
            elements.messageInput.placeholder = "Message aj ai... (e.g. What is Python?)";
        }
    }

    // --- Send Message Flow ---
    async function sendUserMessage(questionText = null) {
        const text = (questionText !== null ? questionText : (elements.messageInput ? elements.messageInput.value : "")).trim();
        if (!text || isGenerating) return;

        isGenerating = true;
        updateSendButton();

        if (questionText === null && elements.messageInput) {
            elements.messageInput.value = "";
            autoResizeInput();
        }

        const msgTime = formatTime();

        if (!currentChatId) {
            currentChatId = Date.now();
        }

        let chat = chats.find(c => c.id === currentChatId);
        if (!chat) {
            chat = {
                id: currentChatId,
                title: text.length > 32 ? text.substring(0, 32) + "..." : text,
                messages: [],
                createdAt: new Date().toISOString()
            };
            chats.unshift(chat);
        }

        renderMessage("user", text, [], msgTime);
        chat.messages.push({
            role: "user",
            text: text,
            time: msgTime
        });
        saveChatsToStorage();
        renderHistoryList();

        showTypingIndicator();

        try {
            const response = await fetch("/ask", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ question: text })
            });

            if (!response.ok) {
                throw new Error(`Server status: ${response.status}`);
            }

            const data = await response.json();
            removeTypingIndicator();

            const botAnswer = data.answer || "I'm sorry, I could not process your request.";
            const suggestions = data.suggestions || [];
            const botTime = formatTime();

            renderMessage("bot", botAnswer, suggestions, botTime);
            chat.messages.push({
                role: "bot",
                text: botAnswer,
                suggestions: suggestions,
                time: botTime
            });
            saveChatsToStorage();

        } catch (error) {
            console.error("Chat error:", error);
            removeTypingIndicator();
            const errorMsg = "⚠️ Server connection error. Please make sure the Flask server is running and try again.";
            renderMessage("bot", errorMsg, ["What is Python?", "What is Artificial Intelligence?"]);
        } finally {
            isGenerating = false;
            updateSendButton();
            if (elements.messageInput && window.innerWidth > 768) {
                elements.messageInput.focus();
            }
        }
    }

    // --- Input Auto-Resize & Controls ---
    function autoResizeInput() {
        if (!elements.messageInput) return;
        const input = elements.messageInput;
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 140) + "px";
    }

    function updateSendButton() {
        if (!elements.sendBtn || !elements.messageInput) return;
        const hasText = elements.messageInput.value.trim().length > 0;
        elements.sendBtn.disabled = !hasText || isGenerating;
    }

    // --- Sidebar Controls (Universal Mobile & Desktop) ---
    function openSidebar() {
        if (!elements.sidebar) return;
        elements.sidebar.classList.add("open");
        if (elements.sidebarOverlay) elements.sidebarOverlay.classList.add("active");
        document.body.classList.add("sidebar-open");
    }

    function closeSidebar() {
        if (!elements.sidebar) return;
        elements.sidebar.classList.remove("open");
        if (elements.sidebarOverlay) elements.sidebarOverlay.classList.remove("active");
        document.body.classList.remove("sidebar-open");
    }

    function toggleSidebar() {
        if (!elements.sidebar) return;
        if (window.innerWidth <= 860) {
            if (elements.sidebar.classList.contains("open")) {
                closeSidebar();
            } else {
                openSidebar();
            }
        } else {
            elements.sidebar.classList.toggle("closed");
        }
    }

    // --- Dynamic Topics from Server ---
    async function loadDynamicTopics() {
        try {
            const res = await fetch("/api/suggestions");
            if (res.ok) {
                const data = await res.json();
                if (data.total_topics && elements.topicsCountBadge) {
                    elements.topicsCountBadge.textContent = `${data.total_topics}+ Topics`;
                }

                if (data.suggestions && elements.suggestionsGrid) {
                    elements.suggestionsGrid.innerHTML = data.suggestions.map(s => `
                        <div class="suggestion-card" data-query="${escapeHtml(s.text)}">
                            <div class="card-icon">${s.icon || "💡"}</div>
                            <div class="card-content">
                                <h3>${escapeHtml(s.text)}</h3>
                                <p>Click to ask instantly</p>
                            </div>
                        </div>
                    `).join("");

                    elements.suggestionsGrid.querySelectorAll(".suggestion-card").forEach(card => {
                        card.addEventListener("click", () => {
                            const query = card.getAttribute("data-query");
                            if (query) sendUserMessage(query);
                        });
                    });
                }
            }
        } catch (e) {
            console.warn("Could not load dynamic topics", e);
        }
    }

    // --- Mobile Virtual Keyboard Handler ---
    function setupMobileKeyboard() {
        if (!elements.messageInput) return;

        function updateLayoutForKeyboard() {
            if (window.visualViewport) {
                const vh = window.visualViewport.height;
                document.documentElement.style.setProperty("--visual-vh", `${vh}px`);
            }
            scrollToBottom();
        }

        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", updateLayoutForKeyboard);
            window.visualViewport.addEventListener("scroll", updateLayoutForKeyboard);
        }

        elements.messageInput.addEventListener("focus", () => {
            setTimeout(() => {
                updateLayoutForKeyboard();
                scrollToBottom();
            }, 300);
        });
    }

    // --- Initialize Application ---
    function init() {
        // Query elements once DOM is fully available
        queryElements();

        initTheme();
        loadSavedChats();
        initSpeechRecognition();
        setupMobileKeyboard();

        // Send Button & Textarea listeners
        if (elements.sendBtn) {
            elements.sendBtn.addEventListener("click", () => sendUserMessage());
        }

        if (elements.messageInput) {
            elements.messageInput.addEventListener("input", () => {
                autoResizeInput();
                updateSendButton();
            });

            elements.messageInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendUserMessage();
                }
            });
        }

        if (elements.voiceBtn) {
            elements.voiceBtn.addEventListener("click", toggleVoiceInput);
        }

        // New Chat Buttons
        if (elements.newChatBtn) elements.newChatBtn.addEventListener("click", startNewChat);
        if (elements.headerNewChatBtn) elements.headerNewChatBtn.addEventListener("click", startNewChat);

        // Clear History
        if (elements.clearHistoryBtn) elements.clearHistoryBtn.addEventListener("click", clearAllChats);

        // Sidebar Toggles
        if (elements.menuToggleBtn) elements.menuToggleBtn.addEventListener("click", toggleSidebar);
        if (elements.closeSidebarBtn) elements.closeSidebarBtn.addEventListener("click", closeSidebar);
        if (elements.sidebarOverlay) elements.sidebarOverlay.addEventListener("click", closeSidebar);

        // Mobile Swipe to Close Sidebar
        if (elements.sidebar) {
            let touchStartX = 0;
            let touchEndX = 0;
            elements.sidebar.addEventListener("touchstart", (e) => {
                touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });

            elements.sidebar.addEventListener("touchend", (e) => {
                touchEndX = e.changedTouches[0].screenX;
                if (touchStartX - touchEndX > 50) {
                    closeSidebar();
                }
            }, { passive: true });
        }

        // Theme Switchers
        if (elements.themeToggleBtn) elements.themeToggleBtn.addEventListener("click", toggleTheme);
        if (elements.sideThemeBtn) elements.sideThemeBtn.addEventListener("click", toggleTheme);

        // Search in history
        if (elements.searchInput) {
            elements.searchInput.addEventListener("input", (e) => {
                renderHistoryList(e.target.value);
            });
        }

        // Global shortcuts (Ctrl+K for New Chat)
        document.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                startNewChat();
            }
        });

        // Load dynamic data from server
        loadDynamicTopics();

        // Initial setup
        startNewChat();
    }

    // Run when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
