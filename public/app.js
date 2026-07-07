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
const LANG_KEY = "formguide_language";
let conversations = loadConversations();
let currentId = null;
let loading = false;
let languagePref = localStorage.getItem(LANG_KEY) || "auto";

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
      body: JSON.stringify({ messages: conv.messages, language: languagePref }),
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
    if (card.dataset.openInterview === "true") {
      openInterviewModal();
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
  openInterviewModal();
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

const cvPreviewEl = document.getElementById("cvPreview");
const polishCvBtn = document.getElementById("polishCvBtn");
let lastCvText = "";

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

  const cv = `${fullName}
${email ? "Email: " + email : ""}${phone ? "  |  Phone: " + phone : ""}

EDUCATION
${education || "Not provided"}

WORK EXPERIENCE
${experience || "Not provided"}

SKILLS
${skills || "Not provided"}`;

  lastCvText = cv;
  cvPreviewEl.innerText = cv;
  cvPreviewEl.style.display = "block";
  downloadCvBtn.style.display = "block";
  polishCvBtn.style.display = "block";
});

const downloadCvBtn = document.getElementById("downloadCvBtn");

downloadCvBtn.addEventListener("click", () => {
  if (!lastCvText) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const marginLeft = 50;
  const marginTop = 60;
  const maxWidth = 495;
  const lineHeight = 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const lines = doc.splitTextToSize(lastCvText, maxWidth);

  let y = marginTop;
  const pageHeight = doc.internal.pageSize.getHeight();

  lines.forEach((line) => {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = marginTop;
    }
    doc.text(line, marginLeft, y);
    y += lineHeight;
  });

  const fileName = document.getElementById("fullName").value.trim() || "CV";
  doc.save(`${fileName.replace(/\s+/g, "_")}_CV.pdf`);
});

polishCvBtn.addEventListener("click", () => {
  if (!lastCvText) return;
  closeCvModal();
  sendMessage(
    `Please improve and professionally format this CV, keeping all the real information the same:\n\n${lastCvText}`
  );
});

// Interview Coach modal
const interviewModal = document.getElementById("interviewModal");

function openInterviewModal() {
  interviewModal.style.display = "flex";
}
function closeInterviewModal() {
  interviewModal.style.display = "none";
}

interviewModal.addEventListener("click", (e) => {
  if (e.target === interviewModal) closeInterviewModal();
});

document.getElementById("startInterviewBtn").addEventListener("click", () => {
  const jobRole = document.getElementById("jobRole").value.trim() || "this role";
  const level = document.getElementById("experienceLevel").value;

  closeInterviewModal();
  sendMessage(
    `Let's do a mock interview. I'm applying for a ${jobRole} position at ${level} experience level. Please act as the interviewer: ask me one interview question at a time, wait for my answer, then give brief constructive feedback before asking the next question. Start now with your first question.`
  );
});

newChatBtn.addEventListener("click", () => {
  startNewChat();
  sidebarEl.classList.remove("open");
});

openSidebarBtn.addEventListener("click", () => sidebarEl.classList.add("open"));
closeSidebarBtn.addEventListener("click", () => sidebarEl.classList.remove("open"));

// Settings modal
const settingsModal = document.getElementById("settingsModal");
const settingsBtn = document.getElementById("settingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

function openSettingsModal() {
  document.querySelectorAll('input[name="language"]').forEach((radio) => {
    radio.checked = radio.value === languagePref;
  });
  settingsModal.style.display = "flex";
}
function closeSettingsModal() {
  settingsModal.style.display = "none";
}

settingsBtn.addEventListener("click", () => {
  openSettingsModal();
  sidebarEl.classList.remove("open");
});
closeSettingsBtn.addEventListener("click", closeSettingsModal);
settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) closeSettingsModal();
});

document.querySelectorAll('input[name="language"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    languagePref = e.target.value;
    localStorage.setItem(LANG_KEY, languagePref);
  });
});

clearHistoryBtn.addEventListener("click", () => {
  const confirmed = confirm(
    "This will delete all your saved conversations. This cannot be undone. Continue?"
  );
  if (!confirmed) return;
  conversations = [];
  saveConversations();
  closeSettingsModal();
  startNewChat();
});

// ---------- Auth ----------
const TOKEN_KEY = "formguide_token";
const USER_KEY = "formguide_user";

const authModal = document.getElementById("authModal");
const accountBtn = document.getElementById("accountBtn");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authError = document.getElementById("authError");
const authNameLabel = document.getElementById("authNameLabel");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authSwitchText = document.getElementById("authSwitchText");
const authSwitchLink = document.getElementById("authSwitchLink");
const continueGuestBtn = document.getElementById("continueGuestBtn");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const rememberMeCheckbox = document.getElementById("rememberMeCheckbox");
const googleAuthBtn = document.getElementById("googleAuthBtn");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");

let authMode = "login"; // "login" or "signup"

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setSession(token, user, remember) {
  const store = remember ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(USER_KEY, JSON.stringify(user));
  updateAccountButton();
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  updateAccountButton();
}

function updateAccountButton() {
  const user = getStoredUser();
  if (user) {
    accountBtn.innerHTML = `👤 ${user.name} <span class="chevron">⌄</span>`;
  } else {
    accountBtn.innerHTML = `👤 Guest User <span class="chevron">⌄</span>`;
  }
}

function openAuthModal(mode) {
  authMode = mode;
  authError.style.display = "none";
  authName.value = "";
  authEmail.value = "";
  authPassword.value = "";
  authPassword.type = "password";
  togglePasswordBtn.textContent = "👁️";

  if (mode === "signup") {
    authTitle.textContent = "Create your account 🚀";
    authSubtitle.textContent = "Join FormGuide AI in seconds";
    authName.style.display = "block";
    authNameLabel.style.display = "block";
    authSubmitBtn.textContent = "🚀 Sign Up";
    authSwitchText.textContent = "Already have an account?";
    authSwitchLink.textContent = "Log in";
  } else {
    authTitle.textContent = "Welcome back! 👋";
    authSubtitle.textContent = "Log in to your FormGuide AI account";
    authName.style.display = "none";
    authNameLabel.style.display = "none";
    authSubmitBtn.textContent = "🔒 Log In";
    authSwitchText.textContent = "Don't have an account?";
    authSwitchLink.textContent = "Create Account";
  }

  authModal.style.display = "flex";
}

function closeAuthModal() {
  authModal.style.display = "none";
}

accountBtn.addEventListener("click", () => {
  const user = getStoredUser();
  if (user) {
    const confirmed = confirm(`Logged in as ${user.name} (${user.email}). Log out?`);
    if (confirmed) clearSession();
  } else {
    openAuthModal("login");
  }
  sidebarEl.classList.remove("open");
});

authSwitchLink.addEventListener("click", (e) => {
  e.preventDefault();
  openAuthModal(authMode === "login" ? "signup" : "login");
});

continueGuestBtn.addEventListener("click", closeAuthModal);

togglePasswordBtn.addEventListener("click", () => {
  const isHidden = authPassword.type === "password";
  authPassword.type = isHidden ? "text" : "password";
  togglePasswordBtn.textContent = isHidden ? "🙈" : "👁️";
});

googleAuthBtn.addEventListener("click", () => {
  alert(
    "Google sign-in isn't set up yet — it needs a separate Google Cloud project with OAuth credentials. This button is a placeholder for now."
  );
});

forgotPasswordLink.addEventListener("click", (e) => {
  e.preventDefault();
  alert(
    "Password reset emails aren't set up yet — this needs an email-sending service (like SendGrid) connected to the app first."
  );
});

authSubmitBtn.addEventListener("click", async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  const name = authName.value.trim();
  const remember = rememberMeCheckbox.checked;

  authError.style.display = "none";

  if (!email || !password || (authMode === "signup" && !name)) {
    authError.textContent = "Please fill in all fields.";
    authError.style.display = "block";
    return;
  }

  const endpoint = authMode === "signup" ? "/api/signup" : "/api/login";
  const body = authMode === "signup" ? { name, email, password } : { email, password };

  authSubmitBtn.disabled = true;
  const originalText = authSubmitBtn.textContent;
  authSubmitBtn.textContent = "Please wait…";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      authError.textContent = data.error || "Something went wrong.";
      authError.style.display = "block";
      return;
    }

    setSession(data.token, data.user, remember);
    closeAuthModal();
  } catch (err) {
    authError.textContent = "Could not reach the server. Please try again.";
    authError.style.display = "block";
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = originalText;
  }
});

updateAccountButton();

// Init
if (conversations.length === 0) {
  startNewChat();
} else {
  currentId = conversations[0].id;
  renderSidebar();
  renderActiveConversation();
}
