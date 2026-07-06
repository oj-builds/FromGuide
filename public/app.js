const chatEl = document.getElementById("chat");
const welcomeScreenEl = document.getElementById("welcomeScreen");
const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("chat-input");
const chatListEl = document.getElementById("chatList");
const newChatBtn = document.getElementById("newChatBtn");
const sidebarEl = document.getElementById("sidebar");
const openSidebarBtn = document.getElementById("openSidebar");
const closeSidebarBtn = document.getElementById("closeSidebar");
const cvModal = document.getElementById("cvModal");

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
  conversations.unshift({ id: currentId, title: null, messages: [] });
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
  inputEl.value = "";

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

// Feature cards on the welcome screen
document.querySelectorAll(".feature-card").forEach((card) => {
  card.addEventListener("click", () => {
    if (card.dataset.openCv === "true") {
      openCvModal();
      return;
    }
    if (card.dataset.focusOnly === "true") {
      inputEl.focus();
      return;
    }
    sendMessage(card.dataset.text);
  });
});

// Sidebar quick-tool shortcuts
document.getElementById("sidebarCvBtn").addEventListener("click", () => {
  openCvModal();
  sidebarEl.classList.remove("open");
});
document.getElementById("sidebarInterviewBtn").addEventListener("click", () => {
  sendMessage("Let's practice an interview.");
  sidebarEl.classList.remove("open");
});
document.getElementById("sidebarGovBtn").addEventListener("click", () => {
  sendMessage("Help me apply for NIN.");
  sidebarEl.classList.remove("open");
});

// CV Builder modal
function openCvModal() {
  cvModal.style.display = "flex";
}
function closeCvModal() {
  cvModal.style.display = "none";
}

cvModal.addEventListener("click", (e) => {
  if (e.target === cvModal) closeCvModal();
});

document.getElementById("generateCV").addEventListener("click", () => {
  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const education = document.getElementById("education").value.trim();
  const experience = document.getElementById("experience").value.trim();
  const skills = document.getElementById("skills").value.trim();

  if (!fullName) {
    alert("Please enter at least your full name.");
    return;
  }

  const prompt = `Please create a professional CV using this information:
Full Name: ${fullName}
Email: ${email || "Not provided"}
Phone: ${phone || "Not provided"}
Education: ${education || "Not provided"}
Work Experience: ${experience || "Not provided"}
Skills: ${skills || "Not provided"}

Format it clearly as a ready-to-use CV.`;

  closeCvModal();
  sendMessage(prompt);
});

newChatBtn.addEventListener("click", () => {
  startNewChat();
  sidebarEl.classList.remove("open");
});

openSidebarBtn.addEventListener("click", () => sidebarEl.classList.add("open"));
closeSidebarBtn.addEventListener("click", () => sidebarEl.classList.remove("open"));

// Init
if (conversations.length === 0) {
  startNewChat();
} else {
  currentId = conversations[0].id;
  renderSidebar();
  renderActiveConversation();
}
