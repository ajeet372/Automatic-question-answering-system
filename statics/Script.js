document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("chatForm");
    const messageInput = document.getElementById("message");
    const sendBtn = document.getElementById("send");
    const micBtn = document.getElementById("micBtn");

    const messages = document.getElementById("messages");
    const welcome = document.getElementById("welcome");

    const historyList = document.getElementById("historyList");
    const searchInput = document.getElementById("searchInput");

    const clearHistoryBtn =
        document.getElementById("clearHistoryBtn");

    const newChatBtn =
        document.getElementById("newChatBtn");

    const themeBtn =
        document.getElementById("themeBtn");

    const mobileMenuBtn =
        document.getElementById("mobileMenuBtn");

    const sidebar =
        document.getElementById("sidebar");

    const sidebarClose =
        document.getElementById("sidebarClose");

    const sidebarOverlay =
        document.getElementById("sidebarOverlay");

    const toast =
        document.getElementById("toast");

    const toastText =
        document.getElementById("toastText");

    const toastIcon =
        document.getElementById("toastIcon");


    let sending = false;
    let historyData = [];

    let recognition = null;
    let listening = false;


    /* =====================================================
       INIT
    ===================================================== */

    loadTheme();
    loadHistory();
    setupVoice();

    messageInput.focus();


    /* =====================================================
       FORM SEND
    ===================================================== */

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        sendMessage();
    });


    /* =====================================================
       ENTER SEND
    ===================================================== */

    messageInput.addEventListener("keydown", function (e) {

        if (e.key === "Enter" && !e.shiftKey) {

            e.preventDefault();

            sendMessage();
        }
    });


    /* =====================================================
       AUTO RESIZE
    ===================================================== */

    messageInput.addEventListener(
        "input",
        resizeInput
    );


    function resizeInput() {

        messageInput.style.height = "auto";

        const height = Math.min(
            messageInput.scrollHeight,
            150
        );

        messageInput.style.height =
            height + "px";
    }


    /* =====================================================
       SEND MESSAGE
    ===================================================== */

    async function sendMessage() {

        if (sending) return;

        const question =
            messageInput.value.trim();

        if (!question) {

            showToast(
                "Pehle question enter karo.",
                "!"
            );

            messageInput.focus();

            return;
        }

        sending = true;

        sendBtn.disabled = true;

        welcome.classList.add("hidden");

        addMessage(
            question,
            "user"
        );

        messageInput.value = "";

        resizeInput();

        const typing =
            showTyping();


        try {

            const response =
                await fetch("/ask", {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body: JSON.stringify({
                        question: question
                    })
                });


            const contentType =
                response.headers.get(
                    "content-type"
                ) || "";


            let data;


            if (
                contentType.includes(
                    "application/json"
                )
            ) {

                data =
                    await response.json();

            } else {

                const text =
                    await response.text();

                throw new Error(
                    "Server ne JSON response nahi diya."
                );
            }


            removeTyping(typing);


            if (
                !response.ok ||
                data.success !== true
            ) {

                const error =
                    data.answer ||
                    data.error ||
                    "Server error aa gaya.";

                addMessage(
                    "⚠️ " + error,
                    "bot"
                );

                showToast(
                    error,
                    "!"
                );

                return;
            }


            addMessage(
                data.answer ||
                "Answer nahi mila.",
                "bot",
                data.time
            );


            await loadHistory();


        } catch (error) {

            removeTyping(typing);

            console.error(
                "SEND ERROR:",
                error
            );


            let message =
                "Backend se connection nahi ho raha.";


            if (
                error.message &&
                error.message.length < 200
            ) {

                message =
                    error.message;
            }


            addMessage(
                "⚠️ " + message,
                "bot"
            );


            showToast(
                message,
                "!"
            );


        } finally {

            sending = false;

            sendBtn.disabled = false;

            messageInput.focus();
        }
    }


    /* =====================================================
       ADD MESSAGE
    ===================================================== */

    function addMessage(
        text,
        type,
        time = null
    ) {

        const row =
            document.createElement("div");

        row.className =
            "message-row " + type;


        const avatar =
            document.createElement("div");

        avatar.className =
            "message-avatar";

        avatar.textContent =
            type === "user"
                ? "👤"
                : "✦";


        const wrapper =
            document.createElement("div");

        wrapper.className =
            "message-wrapper";


        const bubble =
            document.createElement("div");

        bubble.className =
            "message";


        /*
           Security:
           textContent use kar rahe hain.
           User ka HTML execute nahi hoga.
        */

        bubble.textContent =
            text;


        const meta =
            document.createElement("div");

        meta.className =
            "message-meta";


        meta.textContent =
            time ||
            new Date().toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );


        wrapper.appendChild(bubble);
        wrapper.appendChild(meta);

        row.appendChild(avatar);
        row.appendChild(wrapper);

        messages.appendChild(row);

        scrollBottom();
    }


    /* =====================================================
       TYPING
    ===================================================== */

    function showTyping() {

        const id =
            "typing-" + Date.now();


        const row =
            document.createElement("div");

        row.className =
            "message-row bot";

        row.id = id;


        const avatar =
            document.createElement("div");

        avatar.className =
            "message-avatar";

        avatar.textContent = "✦";


        const wrapper =
            document.createElement("div");

        wrapper.className =
            "message-wrapper";


        const typing =
            document.createElement("div");

        typing.className =
            "message typing";


        typing.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;


        wrapper.appendChild(typing);

        row.appendChild(avatar);
        row.appendChild(wrapper);

        messages.appendChild(row);

        scrollBottom();


        return id;
    }


    function removeTyping(id) {

        const element =
            document.getElementById(id);

        if (element) {
            element.remove();
        }
    }


    /* =====================================================
       SCROLL
    ===================================================== */

    function scrollBottom() {

        const chatArea =
            document.getElementById(
                "chatArea"
            );

        requestAnimationFrame(() => {

            chatArea.scrollTop =
                chatArea.scrollHeight;

        });
    }


    /* =====================================================
       HISTORY
    ===================================================== */

    async function loadHistory() {

        try {

            const response =
                await fetch("/history", {
                    cache: "no-store"
                });


            if (!response.ok) {

                throw new Error(
                    "History load failed."
                );
            }


            const data =
                await response.json();


            if (!Array.isArray(data)) {

                throw new Error(
                    "Invalid history."
                );
            }


            historyData = data;

            renderHistory(
                historyData
            );


        } catch (error) {

            console.error(
                "HISTORY ERROR:",
                error
            );

            historyList.innerHTML = `
                <div class="empty-history">
                    ⚠️ History load nahi hui
                </div>
            `;
        }
    }


    function renderHistory(items) {

        historyList.innerHTML = "";


        if (!items.length) {

            historyList.innerHTML = `
                <div class="empty-history">
                    No chats yet
                </div>
            `;

            return;
        }


        items.forEach(item => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "history-item";


            const question =
                document.createElement("div");

            question.className =
                "history-question";

            question.textContent =
                item.question ||
                "Untitled chat";


            const time =
                document.createElement("div");

            time.className =
                "history-time";

            time.textContent =
                formatTime(item.time);


            button.appendChild(question);
            button.appendChild(time);


            button.addEventListener(
                "click",
                () => {

                    showHistory(
                        item
                    );

                    closeSidebar();
                }
            );


            historyList.appendChild(
                button
            );
        });
    }


    function showHistory(item) {

        welcome.classList.add(
            "hidden"
        );

        messages.innerHTML = "";

        addMessage(
            item.question,
            "user"
        );

        addMessage(
            item.answer,
            "bot"
        );

        scrollBottom();
    }


    function formatTime(value) {

        if (!value) return "";

        try {

            const date =
                new Date(
                    value.replace(
                        " ",
                        "T"
                    ) + "Z"
                );

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return value;
            }

            return date.toLocaleString(
                [],
                {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

        } catch {

            return value;
        }
    }


    /* =====================================================
       SEARCH
    ===================================================== */

    searchInput.addEventListener(
        "input",
        function () {

            const value =
                this.value
                    .trim()
                    .toLowerCase();


            if (!value) {

                renderHistory(
                    historyData
                );

                return;
            }


            const filtered =
                historyData.filter(
                    item =>
                        (
                            item.question ||
                            ""
                        )
                        .toLowerCase()
                        .includes(value)
                );


            renderHistory(
                filtered
            );
        }
    );


    /* =====================================================
       CLEAR HISTORY
    ===================================================== */

    clearHistoryBtn.addEventListener(
        "click",
        async function () {

            if (!historyData.length) {

                showToast(
                    "History already empty hai.",
                    "!"
                );

                return;
            }


            const confirmDelete =
                confirm(
                    "Saari chat history delete karni hai?"
                );


            if (!confirmDelete) {
                return;
            }


            clearHistoryBtn.disabled = true;


            try {

                const response =
                    await fetch(
                        "/clear-history",
                        {
                            method: "POST",

                            headers: {
                                "Accept":
                                    "application/json"
                            }
                        }
                    );


                const data =
                    await response.json();


                if (
                    !response.ok ||
                    data.success !== true
                ) {

                    throw new Error(
                        data.answer ||
                        "History clear nahi hui."
                    );
                }


                historyData = [];

                renderHistory([]);

                messages.innerHTML = "";

                welcome.classList.remove(
                    "hidden"
                );


                showToast(
                    "History clear ho gayi.",
                    "✓"
                );


            } catch (error) {

                console.error(error);

                showToast(
                    error.message ||
                    "History clear nahi hui.",
                    "!"
                );

            } finally {

                clearHistoryBtn.disabled =
                    false;
            }
        }
    );


    /* =====================================================
       NEW CHAT
    ===================================================== */

    newChatBtn.addEventListener(
        "click",
        function () {

            messages.innerHTML = "";

            welcome.classList.remove(
                "hidden"
            );

            messageInput.value = "";

            resizeInput();

            messageInput.focus();

            closeSidebar();
        }
    );


    /* =====================================================
       SUGGESTIONS
    ===================================================== */

    document
        .querySelectorAll(".suggestion")
        .forEach(button => {

            button.addEventListener(
                "click",
                function () {

                    messageInput.value =
                        this.dataset.question;

                    resizeInput();

                    sendMessage();
                }
            );
        });


    /* =====================================================
       THEME
    ===================================================== */

    themeBtn.addEventListener(
        "click",
        toggleTheme
    );


    function loadTheme() {

        const theme =
            localStorage.getItem(
                "aj-ai-theme"
            );


        if (theme === "light") {

            document.body.classList.add(
                "light"
            );

            themeBtn.textContent =
                "🌙";

        } else {

            document.body.classList.remove(
                "light"
            );

            themeBtn.textContent =
                "☀️";
        }
    }


    function toggleTheme() {

        document.body.classList.toggle(
            "light"
        );


        const light =
            document.body.classList.contains(
                "light"
            );


        localStorage.setItem(
            "aj-ai-theme",
            light ? "light" : "dark"
        );


        themeBtn.textContent =
            light ? "🌙" : "☀️";
    }


    /* =====================================================
       MOBILE SIDEBAR
    ===================================================== */

    mobileMenuBtn.addEventListener(
        "click",
        openSidebar
    );


    sidebarClose.addEventListener(
        "click",
        closeSidebar
    );


    sidebarOverlay.addEventListener(
        "click",
        closeSidebar
    );


    function openSidebar() {

        sidebar.classList.add(
            "open"
        );

        sidebarOverlay.classList.add(
            "show"
        );
    }


    function closeSidebar() {

        sidebar.classList.remove(
            "open"
        );

        sidebarOverlay.classList.remove(
            "show"
        );
    }


    /* =====================================================
       VOICE
    ===================================================== */

    function setupVoice() {

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;


        if (!SpeechRecognition) {

            micBtn.title =
                "Voice input supported nahi hai";

            micBtn.addEventListener(
                "click",
                () => {

                    showToast(
                        "Is browser mein voice input supported nahi hai.",
                        "!"
                    );
                }
            );

            return;
        }


        recognition =
            new SpeechRecognition();


        recognition.continuous = false;

        recognition.interimResults = true;

        recognition.lang = "hi-IN";


        recognition.onstart = () => {

            listening = true;

            micBtn.classList.add(
                "listening"
            );

            micBtn.textContent =
                "⏹️";

            showToast(
                "Bolna start karo...",
                "🎙️"
            );
        };


        recognition.onresult =
            event => {

                let transcript = "";


                for (
                    let i = event.resultIndex;
                    i < event.results.length;
                    i++
                ) {

                    transcript +=
                        event.results[i][0]
                            .transcript;
                }


                messageInput.value =
                    transcript;

                resizeInput();
            };


        recognition.onerror =
            event => {

                console.error(
                    "VOICE ERROR",
                    event.error
                );


                if (
                    event.error ===
                    "not-allowed"
                ) {

                    showToast(
                        "Microphone permission allow karo.",
                        "!"
                    );

                } else if (
                    event.error ===
                    "no-speech"
                ) {

                    showToast(
                        "Kuch suna nahi. Dobara try karo.",
                        "!"
                    );

                } else {

                    showToast(
                        "Voice input mein problem hui.",
                        "!"
                    );
                }
            };


        recognition.onend = () => {

            listening = false;

            micBtn.classList.remove(
                "listening"
            );

            micBtn.textContent =
                "🎙️";
        };


        micBtn.addEventListener(
            "click",
            () => {

                try {

                    if (listening) {

                        recognition.stop();

                    } else {

                        recognition.start();
                    }

                } catch (error) {

                    console.error(error);
                }
            }
        );
    }


    /* =====================================================
       TOAST
    ===================================================== */

    let toastTimer;


    function showToast(
        message,
        icon = "✓"
    ) {

        toastText.textContent =
            message;

        toastIcon.textContent =
            icon;

        toast.classList.add(
            "show"
        );


        clearTimeout(
            toastTimer
        );


        toastTimer =
            setTimeout(
                () => {

                    toast.classList.remove(
                        "show"
                    );

                },
                3000
            );
    }

});