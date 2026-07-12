/* =========================================================
   chat.js — conversation storage, rendering, send flow
   Depends on: utils.js, app.js (DOM refs + state)
   ========================================================= */

conversations = loadConversations();

function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveConversations() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (e) {
    console.error("Could not save conversation history:", e);
  }
}

function getCurrentConversation() {
  return conversations.find((c) => c.id === currentId);
}

function startNewChat() {
  currentId = "c" + Date.now();
  currentChatId = null;
  conversations.unshift({ id: currentId, title: null, messages: [] });
  saveConversations();
  renderSidebar();
  renderActiveConversation();
}

function deleteConversation(id) {
  conversations = conversations.filter((c) => c.id !== id);
  saveConversations();

  if (id === currentId) {
    if (conversations.length > 0) {
      currentId = conversations[0].id;
    } else {
      startNewChat();
      return;
    }
  }
  renderSidebar();
  renderActiveConversation();
}

function renderSidebar() {
  chatListEl.innerHTML = "";
  conversations.forEach((conv) => {
    const item = document.createElement("div");
    item.className = "chat-list-item" + (conv.id === currentId ? " active" : "");

    const label = document.createElement("span");
    label.className = "chat-list-label";
    label.textContent = conv.title || "New chat";
    label.addEventListener("click", () => {
      currentId = conv.id;
      renderSidebar();
      renderActiveConversation();
      sidebarEl.classList.remove("open");
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "chat-delete-btn";
    deleteBtn.innerHTML = "✕";
    deleteBtn.title = "Delete conversation";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteConversation(conv.id);
    });

    item.appendChild(label);
    item.appendChild(deleteBtn);
    chatListEl.appendChild(item);
  });
}

function renderMessage(role, content) {
  const row = document.createElement("div");
  row.className = `msg-row ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const stamp = document.createElement("div");
  stamp.className = "stamp";
  stamp.innerHTML =
    role === "assistant"
      ? `<span class="stamp-circle">🤖</span> FormGuide AI`
      : `<span class="stamp-circle">👤</span> You`;
  bubble.appendChild(stamp);

  const textNode = document.createElement("div");
  textNode.textContent = content;
  bubble.appendChild(textNode);

  row.appendChild(bubble);
  messagesEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function renderActiveConversation() {
  messagesEl.innerHTML = "";
  const conv = getCurrentConversation();

  if (!conv || conv.messages.length === 0) {
    welcomeScreenEl.style.display = "block";
    return;
  }

  welcomeScreenEl.style.display = "none";
  conv.messages.forEach((m) => renderMessage(m.role, m.content));
}

function renderTyping() {
  const row = document.createElement("div");
  row.className = "msg-row assistant";
  row.id = "typing-row";
  const bubble = document.createElement("div");
  bubble.className = "bubble typing";
  bubble.innerHTML = `🤖 FormGuide AI is thinking<span class="dots"><span>.</span><span>.</span><span>.</span></span>`;
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function removeTyping() {
  const row = document.getElementById("typing-row");
  if (row) row.remove();
}

async function sendMessage(text) {
  if (!text || loading) return;

  loading = true;

  if (!currentChatId && getToken()) {
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const chat = await res.json();
      currentChatId = chat._id;
    } catch (err) {
      console.error("Could not create server chat:", err);
    }
  }

  let conv = getCurrentConversation();
  if (!conv) {
    startNewChat();
    conv = getCurrentConversation();
  }

  if (!conv.title) conv.title = makeTitle(text);

  welcomeScreenEl.style.display = "none";

  conv.messages.push({ role: "user", content: text });
  saveConversations();
  renderSidebar();
  renderMessage("user", text);
  renderTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ messages: conv.messages, language: languagePref }),
    });
    const data = await res.json();
    removeTyping();

    const reply = data.reply || "Sorry, something went wrong. Please try again.";
    conv.messages.push({ role: "assistant", content: reply });
    saveConversations();
    renderMessage("assistant", reply);

    if (getToken() && currentChatId) {
      try {
        await fetch(`/api/chats/${currentChatId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            title: conv.title,
            messages: conv.messages,
          }),
        });
      } catch (err) {
        console.error("Could not save chat:", err);
      }
    }
  } catch (err) {
    removeTyping();
    renderMessage("assistant", "Could not reach the server. Please try again.");
  } finally {
    loading = false;
  }
}

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage(inputEl.value.trim());
});

document.querySelectorAll(".feature-card").forEach((card) => {
  card.addEventListener("click", () => {
    if (card.dataset.openCv === "true") {
      openCvModal(); // defined in cv.js
      return;
    }
    if (card.dataset.openInterview === "true") {
      openInterviewModal(); // defined in interview.js
      return;
    }
    if (card.dataset.focusOnly === "true") {
      inputEl.focus();
      return;
    }
    sendMessage(card.dataset.text);
  });
});

document.getElementById("sidebarCvBtn").addEventListener("click", () => {
  openCvModal();
  sidebarEl.classList.remove("open");
});
document.getElementById("sidebarInterviewBtn").addEventListener("click", () => {
  openInterviewModal();
  sidebarEl.classList.remove("open");
});
document.getElementById("sidebarGovBtn").addEventListener("click", () => {
  sendMessage("Help me apply for NIN.");
  sidebarEl.classList.remove("open");
});

newChatBtn.addEventListener("click", () => {
  startNewChat();
  sidebarEl.classList.remove("open");
});

openSidebarBtn.addEventListener("click", () => sidebarEl.classList.add("open"));
closeSidebarBtn.addEventListener("click", () => sidebarEl.classList.remove("open"));
