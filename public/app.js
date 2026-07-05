const chatEl = document.getElementById("chat");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("chat-input");
const suggestionsEl = document.getElementById("suggestions");
const chatListEl = document.getElementById("chatList");
const newChatBtn = document.getElementById("newChatBtn");
const sidebarEl = document.getElementById("sidebar");
const openSidebarBtn = document.getElementById("openSidebar");
const closeSidebarBtn = document.getElementById("closeSidebar");

const STORAGE_KEY = "formguide_conversations";
let conversations = loadConversations();
let currentId = null;
let loading = false;

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

function makeTitle(text) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 34 ? clean.slice(0, 34) + "…" : clean;
}

function startNewChat() {
  currentId = "c" + Date.now();
  conversations.unshift({
    id: currentId,
    title: null,
    messages: [],
  });
  saveConversations();
  renderSidebar();
  renderActiveConversation();
}

function getCurrentConversation() {
  return conversations.find((c) => c.id === currentId);
}

function renderSidebar() {
  chatListEl.innerHTML = "";
  conversations.forEach((conv) => {
    const item = document.createElement("div");
    item.className = "chat-list-item" + (conv.id === currentId ? " active" : "");
    item.textContent = conv.title || "New chat";
    item.addEventListener("click", () => {
      currentId = conv.id;
      renderSidebar();
      renderActiveConversation();
      sidebarEl.classList.remove("open");
    });
    chatListEl.appendChild(item);
  });
}

function renderMessage(role, content) {
  const row = document.createElement("div");
  row.className = `msg-row ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (role === "assistant") {
    const stamp = document.createElement("div");
    stamp.className = "stamp";
    stamp.innerHTML = `<span class="stamp-circle">✓</span> Guidance`;
    bubble.appendChild(stamp);
  }

  const textNode = document.createElement("div");
  textNode.textContent = content;
  bubble.appendChild(textNode);

  row.appendChild(bubble);
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function renderActiveConversation() {
  chatEl.innerHTML = "";
  const conv = getCurrentConversation();

  if (!conv || conv.messages.length === 0) {
    suggestionsEl.style.display = "flex";
    renderMessage(
      "assistant",
      "Welcome. Tell me which form you need help with — NIN, WAEC result checker, international passport, JAMB, or anything else — and I'll walk you through it step by step."
    );
    return;
  }

  suggestionsEl.style.display = "none";
  conv.messages.forEach((m) => renderMessage(m.role, m.content));
}

function renderTyping() {
  const row = document.createElement("div");
  row.className = "msg-row assistant";
  row.id = "typing-row";
  const bubble = document.createElement("div");
  bubble.className = "bubble typing";
  bubble.textContent = "Typing…";
  row.appendChild(bubble);
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function removeTyping() {
  const row = document.getElementById("typing-row");
  if (row) row.remove();
}

async function sendMessage(text) {
  if (!text || loading) return;
  loading = true;
  inputEl.value = "";
  suggestionsEl.style.display = "none";

  let conv = getCurrentConversation();
  if (!conv) {
    startNewChat();
    conv = getCurrentConversation();
  }

  if (!conv.title) {
    conv.title = makeTitle(text);
  }

  conv.messages.push({ role: "user", content: text });
  saveConversations();
  renderSidebar();
  renderMessage("user", text);
  renderTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conv.messages }),
    });
    const data = await res.json();
    removeTyping();

    const reply = data.reply || "Sorry, something went wrong. Please try again.";
    conv.messages.push({ role: "assistant", content: reply });
    saveConversations();
    renderMessage("assistant", reply);
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

suggestionsEl.addEventListener("click", (e) => {
  if (e.target.classList.contains("chip")) {
    sendMessage(e.target.dataset.text);
  }
});

newChatBtn.addEventListener("click", () => {
  startNewChat();
  sidebarEl.classList.remove("open");
});

openSidebarBtn.addEventListener("click", () => {
  sidebarEl.classList.add("open");
});

closeSidebarBtn.addEventListener("click", () => {
  sidebarEl.classList.remove("open");
});

// Init
if (conversations.length === 0) {
  startNewChat();
} else {
  currentId = conversations[0].id;
  renderSidebar();
  renderActiveConversation();
}
