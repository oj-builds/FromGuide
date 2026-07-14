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
const searchInput = document.getElementById("chat-search");

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
  const search = searchInput.value.toLowerCase();
  conversations.sort((a, b) => {
    if (a.pinned === b.pinned) return 0;
    return a.pinned ? -1 : 1;
  });
  conversations
    .filter((conv) => {
      if (!search) return true;
      return (conv.title || "").toLowerCase().includes(search);
    })
    .forEach((conv) => {
      const item = document.createElement("div");
      item.className = "chat-list-item";
      if (conv.id === currentId) item.classList.add("active");

      const label = document.createElement("span");
      label.className = "chat-list-label";
      label.textContent = conv.title || "New chat";
      label.addEventListener("dblclick", async () => {
        const title = prompt("Rename chat", conv.title);

        if (!title) return;

        conv.title = title;

        saveConversations();

        renderSidebar();

        if (getToken()) {
          try {
            await fetch(`/api/chats/${conv.id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${getToken()}`,
              },
              body: JSON.stringify({
                title,
              }),
            });
          } catch (err) {
            console.error(err);
          }
        }
      });
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

      const pinBtn = document.createElement("button");
      pinBtn.className = "chat-pin-btn";
      pinBtn.innerHTML = conv.pinned ? "📌" : "📍";
      pinBtn.title = "Pin chat";

      pinBtn.addEventListener("click", async (e) => {
        e.stopPropagation();

        conv.pinned = !conv.pinned;

        renderSidebar();

        if (getToken()) {
          await fetch(`/api/chats/${conv.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({
              pinned: conv.pinned,
            }),
          });
        }
      });

      item.appendChild(label);
      item.appendChild(pinBtn);
      item.appendChild(deleteBtn);
      chatListEl.appendChild(item);
    });
}

async function deleteConversation(id) {
  console.log("Deleting chat:", id);

  if (getToken()) {
    try {
      await fetch(`/api/chats/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
    } catch (err) {
      console.error("Could not delete chat:", err);
    }
  }

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
    if (getToken() && currentId) {
      try {
        await fetch(`/api/chats/${currentId}`, {
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
        console.error("Failed to save chat:", err);
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

// ---------- Settings — full screen ----------
const settingsModal = document.getElementById("settingsModal");
const settingsBtn = document.getElementById("settingsBtn");
const settingsBackBtn = document.getElementById("settingsBackBtn");
const settingsHeaderTitle = document.getElementById("settingsHeaderTitle");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const THEME_KEY = "formguide_theme";
const ACCENT_KEY = "formguide_accent";
let settingsCurrentPanel = "main";

function showSettingsMain() {
  document.querySelectorAll("#settingsModal .settings-panel").forEach((p) => p.classList.remove("active"));
  document.getElementById("settingsMainMenu").classList.add("active");
  settingsHeaderTitle.textContent = "Settings";
  settingsCurrentPanel = "main";
}

function showSettingsPanel(name, title) {
  document.querySelectorAll("#settingsModal .settings-panel").forEach((p) => p.classList.remove("active"));
  const panel = document.querySelector(`#settingsModal .settings-panel[data-panel="${name}"]`);
  if (panel) panel.classList.add("active");
  settingsHeaderTitle.textContent = title;
  settingsCurrentPanel = name;

  if (name === "memory") renderMemoryList();
  if (name === "appearance") {
    applyThemeUI();
    applyAccentUI();
  }
  if (name === "language") {
    document.querySelectorAll('input[name="language"]').forEach((radio) => {
      radio.checked = radio.value === languagePref;
    });
  }
}

function openSettingsModal() {
  const user = getStoredUser();
  document.getElementById("settingsProfileName").textContent = user ? user.name : "Guest User";
  document.getElementById("settingsProfileEmail").textContent = user ? user.email : "Not signed in";
  document.getElementById("settingsAccountEmail").textContent = user ? user.email : "—";
  document.getElementById("settingsPhoneDisplay").textContent = user && user.phone ? user.phone : "Not set";

  const langLabels = { auto: "Auto-detect", english: "Always English", pidgin: "Always Pidgin" };
  const langSub = document.getElementById("settingsLangSub");
  if (langSub) langSub.textContent = langLabels[languagePref] || "Auto-detect";

  const avatarImg = document.getElementById("settingsAvatarImg");
  const avatarPlaceholder = document.getElementById("settingsAvatarPlaceholder");
  if (user && user.avatar) {
    avatarImg.src = user.avatar;
    avatarImg.style.display = "block";
    avatarPlaceholder.style.display = "none";
  } else {
    avatarImg.style.display = "none";
    avatarPlaceholder.style.display = "flex";
  }

  showSettingsMain();
  settingsModal.classList.add("open");
}
function closeSettingsModal() {
  settingsModal.classList.remove("open");
}

settingsBtn.addEventListener("click", () => {
  openSettingsModal();
  sidebarEl.classList.remove("open");
});

settingsBackBtn.addEventListener("click", () => {
  if (settingsCurrentPanel === "main") {
    closeSettingsModal();
  } else {
    showSettingsMain();
  }
});

document.querySelectorAll(".settings-menu-row[data-target]").forEach((row) => {
  row.addEventListener("click", () => {
    const target = row.dataset.target;
    if (target === "notifications") {
      closeSettingsModal();
      notificationsModal.classList.add("open");
      loadNotifications();
      return;
    }
    const title = row.querySelector(".settings-row-label").textContent;
    showSettingsPanel(target, title);
  });
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

function applyThemeUI() {
  const saved = localStorage.getItem(THEME_KEY) || "light";
  document.querySelectorAll(".theme-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === saved);
  });
}
function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  document.body.classList.remove("theme-dark", "theme-light");
  if (theme === "dark") {
    document.body.classList.add("theme-dark");
  } else if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.add(prefersDark ? "theme-dark" : "theme-light");
  }
  applyThemeUI();
}
document.querySelectorAll(".theme-option").forEach((btn) => {
  btn.addEventListener("click", () => setTheme(btn.dataset.theme));
});
setTheme(localStorage.getItem(THEME_KEY) || "light");

function applyAccentUI() {
  const saved = localStorage.getItem(ACCENT_KEY) || "default";
  document.querySelectorAll(".accent-dot").forEach((dot) => {
    dot.classList.toggle("selected", dot.dataset.accent === saved);
  });
}
function setAccent(accent) {
  localStorage.setItem(ACCENT_KEY, accent);
  document.body.classList.remove("accent-blue", "accent-green", "accent-red", "accent-orange");
  if (accent !== "default") document.body.classList.add(`accent-${accent}`);
  applyAccentUI();
}
document.querySelectorAll(".accent-dot").forEach((dot) => {
  dot.addEventListener("click", () => setAccent(dot.dataset.accent));
});
setAccent(localStorage.getItem(ACCENT_KEY) || "default");

document.getElementById("changePhoneBtn").addEventListener("click", async () => {
  const phone = prompt("Enter your phone number:");
  if (!phone) return;

  try {
    const res = await fetch("/api/user/phone", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Could not update phone number.");
      return;
    }
    document.getElementById("settingsPhoneDisplay").textContent = data.user.phone;
    const remember = !!localStorage.getItem(TOKEN_KEY);
    setSession(getToken(), data.user, remember);
  } catch (err) {
    alert("Could not reach the server. Please try again.");
  }
});

document.getElementById("changePasswordBtn").addEventListener("click", async () => {
  const currentPassword = prompt("Enter your current password:");
  if (!currentPassword) return;
  const newPassword = prompt("Enter your new password (min 6 characters):");
  if (!newPassword) return;

  try {
    const res = await fetch("/api/user/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Could not update password.");
      return;
    }
    alert("Password updated successfully.");
  } catch (err) {
    alert("Could not reach the server. Please try again.");
  }
});

const avatarUploadBtn = document.getElementById("avatarUploadBtn");
const avatarFileInput = document.getElementById("avatarFileInput");

avatarUploadBtn.addEventListener("click", () => {
  if (!getStoredUser()) {
    alert("Please log in first to set a profile picture.");
    return;
  }
  avatarFileInput.click();
});

avatarFileInput.addEventListener("change", async () => {
  const file = avatarFileInput.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    alert("Please choose an image smaller than 2MB.");
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result;
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ avatar: base64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Could not update profile picture.");
        return;
      }

      const remember = !!localStorage.getItem(TOKEN_KEY);
      setSession(getToken(), data.user, remember);

      document.getElementById("settingsAvatarImg").src = data.user.avatar;
      document.getElementById("settingsAvatarImg").style.display = "block";
      document.getElementById("settingsAvatarPlaceholder").style.display = "none";
    } catch (err) {
      alert("Could not reach the server. Please try again.");
    }
  };
  reader.readAsDataURL(file);
});

document.getElementById("deleteAccountBtn").addEventListener("click", () => {
  alert("Account deletion isn't wired up yet — this needs a backend endpoint first.");
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

let authMode = "login";

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

async function loadChatsFromServer() {
  if (!getToken()) return;

  try {
    const res = await fetch("/api/chats", {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    if (!res.ok) return;

    const chats = await res.json();

    conversations = chats.map((chat) => ({
      id: chat._id,
      title: chat.title,
      messages: chat.messages,
      pinned: chat.pinned,
    }));

    if (conversations.length > 0) {
      currentId = conversations[0].id;
    }

    renderSidebar();
    renderActiveConversation();
  } catch (err) {
    console.error("Could not load chats:", err);
  }
}

if (searchInput) {
  searchInput.addEventListener("input", () => {
    renderSidebar();
  });
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

let googleClientId = null;

fetch("/api/config")
  .then((res) => res.json())
  .then((data) => {
    googleClientId = data.googleClientId;
    if (googleClientId && window.google) {
      initGoogleButton();
    }
  })
  .catch(() => {});

function initGoogleButton() {
  google.accounts.id.initialize({
    client_id: googleClientId,
    callback: handleGoogleCredential,
  });
}

async function handleGoogleCredential(response) {
  try {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: response.credential }),
    });
    const data = await res.json();

    if (!res.ok) {
      authError.textContent = data.error || "Google sign-in failed.";
      authError.style.display = "block";
      return;
    }

    setSession(data.token, data.user, rememberMeCheckbox.checked);
    closeAuthModal();
  } catch (err) {
    authError.textContent = "Could not reach the server. Please try again.";
    authError.style.display = "block";
  }
}

googleAuthBtn.addEventListener("click", () => {
  if (!googleClientId) {
    alert(
      "Google sign-in isn't configured yet. Add GOOGLE_CLIENT_ID to your .env file to enable it."
    );
    return;
  }
  google.accounts.id.prompt();
});

forgotPasswordLink.addEventListener("click", async (e) => {
  e.preventDefault();
  const email = prompt("Enter the email address for your account:");
  if (!email) return;

  try {
    const res = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    alert(data.message || "If an account exists with this email, a reset link has been sent.");
  } catch (err) {
    alert("Could not reach the server. Please try again.");
  }
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

if (getToken()) {
  loadChatsFromServer();
} else {
  if (conversations.length === 0) {
    startNewChat();
  } else {
    currentId = conversations[0].id;
    renderSidebar();
    renderActiveConversation();
  }
}

// Notifications
const notificationsBtn = document.getElementById("notificationsBtn");
const notificationsModal = document.getElementById("notificationsModal");
const closeNotificationsBtn = document.getElementById("closeNotificationsBtn");
const markAllReadBtn = document.getElementById("markAllReadBtn");
const notifBadge = document.getElementById("notifBadge");
const notificationsList = document.getElementById("notificationsList");
const notificationsEmpty = document.getElementById("notificationsEmpty");

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function loadNotifications() {
  if (!getToken()) {
    notificationsList.innerHTML = "";
    notificationsEmpty.style.display = "block";
    notificationsEmpty.textContent = "Log in to see your notifications.";
    notifBadge.style.display = "none";
    return;
  }

  try {
    const res = await fetch("/api/notifications", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    const notifications = data.notifications || [];

    const unreadCount = notifications.filter((n) => !n.read).length;
    if (unreadCount > 0) {
      notifBadge.textContent = unreadCount;
      notifBadge.style.display = "flex";
    } else {
      notifBadge.style.display = "none";
    }

    if (notifications.length === 0) {
      notificationsList.innerHTML = "";
      notificationsEmpty.style.display = "block";
      notificationsEmpty.textContent = "No notifications yet.";
      return;
    }

    notificationsEmpty.style.display = "none";
    notificationsList.innerHTML = "";
    notifications.forEach((n) => {
      const item = document.createElement("div");
      item.className = "notif-item" + (n.read ? "" : " unread");
      item.innerHTML = `
        <div class="notif-icon">🔔</div>
        <div class="notif-content">
          <div class="notif-title">${n.title}</div>
          <div class="notif-message">${n.message}</div>
          <div class="notif-time">${timeAgo(n.createdAt)}</div>
        </div>
      `;
      item.addEventListener("click", () => markNotificationRead(n._id, item));
      notificationsList.appendChild(item);
    });
  } catch (err) {
    notificationsList.innerHTML = "";
    notificationsEmpty.style.display = "block";
    notificationsEmpty.textContent = "Could not load notifications.";
  }
}

async function markNotificationRead(id, itemEl) {
  try {
    await fetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    itemEl.classList.remove("unread");
    const unreadLeft = document.querySelectorAll(".notif-item.unread").length;
    if (unreadLeft > 0) {
      notifBadge.textContent = unreadLeft;
      notifBadge.style.display = "flex";
    } else {
      notifBadge.style.display = "none";
    }
  } catch (err) {}
}

notificationsBtn.addEventListener("click", () => {
  notificationsModal.classList.add("open");
  loadNotifications();
});
closeNotificationsBtn.addEventListener("click", () => {
  notificationsModal.classList.remove("open");
});

markAllReadBtn.addEventListener("click", async () => {
  try {
    await fetch("/api/notifications/read-all", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    loadNotifications();
  } catch (err) {}
});

// Check unread count on page load if logged in
if (getToken()) loadNotifications();

// ---------- New expanded sidebar nav (added for full-sidebar redesign) ----------

// Sub-items inside collapsible groups (Education, Career, Government, Documents)
// that just send a canned prompt into the chat.
document.querySelectorAll(".nav-subitem[data-text]").forEach((btn) => {
  btn.addEventListener("click", () => {
    sendMessage(btn.dataset.text);
    sidebarEl.classList.remove("open");
  });
});

// Top-level nav items. Chat/Search behave like "focus the input" for now;
// Home shows the welcome screen; the rest are placeholders until those
// screens/features exist, so they just let you know what's coming.
const navHomeBtn = document.getElementById("navHome");
const navChatLinkBtn = document.getElementById("navChatLink");
const navSearchLinkBtn = document.getElementById("navSearchLink");
const navPinnedBtn = document.getElementById("navPinned");
const navHistoryBtn = document.getElementById("navHistory");
const navAiStudioBtn = document.getElementById("navAiStudio");
const navTemplatesBtn = document.getElementById("navTemplates");
const navCommunityBtn = document.getElementById("navCommunity");
const navSavedPromptsBtn = document.getElementById("navSavedPrompts");
const proBannerBtn = document.getElementById("proBanner");

function setActiveNavItem(activeBtn) {
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
  if (activeBtn) activeBtn.classList.add("active");
}

if (navHomeBtn) {
  navHomeBtn.addEventListener("click", () => {
    setActiveNavItem(navHomeBtn);
    welcomeScreenEl.style.display = "block";
    messagesEl.innerHTML = "";
    sidebarEl.classList.remove("open");
  });
}

if (navChatLinkBtn) {
  navChatLinkBtn.addEventListener("click", () => {
    setActiveNavItem(navChatLinkBtn);
    if (!currentId || !getCurrentConversation()) {
      if (conversations.length > 0) {
        currentId = conversations[0].id;
      } else {
        startNewChat();
      }
    }
    renderSidebar();
    renderActiveConversation();
    inputEl.focus();
    sidebarEl.classList.remove("open");
  });
}

// ---------- Full-page Search ----------
const searchModal = document.getElementById("searchModal");
const closeSearchBtn = document.getElementById("closeSearchBtn");
const fullSearchInput = document.getElementById("fullSearchInput");
const fullSearchResults = document.getElementById("fullSearchResults");
const fullSearchEmpty = document.getElementById("fullSearchEmpty");

function renderSearchResults(query) {
  const q = (query || "").toLowerCase();
  const results = conversations.filter((conv) => {
    if (!q) return true;
    const titleMatch = (conv.title || "").toLowerCase().includes(q);
    const messageMatch = conv.messages.some((m) => m.content.toLowerCase().includes(q));
    return titleMatch || messageMatch;
  });

  fullSearchResults.innerHTML = "";

  if (results.length === 0) {
    fullSearchEmpty.style.display = "block";
    return;
  }
  fullSearchEmpty.style.display = "none";

  results.forEach((conv) => {
    const item = document.createElement("div");
    item.className = "notif-item";
    const lastMessage = conv.messages.length
      ? conv.messages[conv.messages.length - 1].content.slice(0, 80)
      : "No messages yet";
    item.innerHTML = `
      <div class="notif-icon">💬</div>
      <div class="notif-content">
        <div class="notif-title">${conv.title || "New chat"}</div>
        <div class="notif-message">${lastMessage}</div>
      </div>
    `;
    item.addEventListener("click", () => {
      currentId = conv.id;
      renderSidebar();
      renderActiveConversation();
      closeSearchModal();
    });
    fullSearchResults.appendChild(item);
  });
}

function openSearchModal() {
  searchModal.classList.add("open");
  fullSearchInput.value = "";
  renderSearchResults("");
  fullSearchInput.focus();
}
function closeSearchModal() {
  searchModal.classList.remove("open");
}

if (closeSearchBtn) closeSearchBtn.addEventListener("click", closeSearchModal);
if (fullSearchInput) {
  fullSearchInput.addEventListener("input", (e) => renderSearchResults(e.target.value));
}

if (navSearchLinkBtn) {
  navSearchLinkBtn.addEventListener("click", () => {
    setActiveNavItem(navSearchLinkBtn);
    openSearchModal();
    sidebarEl.classList.remove("open");
  });
}

if (navPinnedBtn) {
  navPinnedBtn.addEventListener("click", () => {
    setActiveNavItem(navPinnedBtn);
    renderSidebar();
    sidebarEl.classList.remove("open");
  });
}

if (navHistoryBtn) {
  navHistoryBtn.addEventListener("click", () => {
    setActiveNavItem(navHistoryBtn);
    chatListEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    sidebarEl.classList.remove("open");
  });
}

if (navAiStudioBtn) {
  navAiStudioBtn.addEventListener("click", () => {
    alert("AI Studio is coming soon!");
    sidebarEl.classList.remove("open");
  });
}

if (navTemplatesBtn) {
  navTemplatesBtn.addEventListener("click", () => {
    alert("Templates are coming soon!");
    sidebarEl.classList.remove("open");
  });
}

if (navCommunityBtn) {
  navCommunityBtn.addEventListener("click", () => {
    alert("Community is coming soon!");
    sidebarEl.classList.remove("open");
  });
}

if (navSavedPromptsBtn) {
  navSavedPromptsBtn.addEventListener("click", () => {
    alert("Saved Prompts are coming soon!");
    sidebarEl.classList.remove("open");
  });
}

if (proBannerBtn) {
  proBannerBtn.addEventListener("click", () => {
    alert("FormGuide AI Pro is coming soon!");
    sidebarEl.classList.remove("open");
  });
}

// ---------- Memory Manager ----------
const MEMORY_KEY = "formguide_memories";

function loadMemories() {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function saveMemories(list) {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(list));
}
let memories = loadMemories();

function renderMemoryList() {
  const container = document.getElementById("memoryList");
  if (!container) return;
  container.innerHTML = "";

  if (memories.length === 0) {
    container.innerHTML =
      '<div style="text-align:center;color:#999;padding:24px 0;">No memories added yet. Tap "Add Memory" to get started.</div>';
    return;
  }

  memories.forEach((mem, idx) => {
    const item = document.createElement("div");
    item.className = "memory-item";
    item.innerHTML = `
      <div class="memory-icon">🧠</div>
      <div class="memory-content">
        <div class="memory-label">${mem.label}</div>
        <div class="memory-value">${mem.value}</div>
      </div>
      <button class="memory-edit-btn" title="Edit">✎</button>
      <button class="memory-delete-btn" title="Delete">🗑️</button>
    `;

    item.querySelector(".memory-edit-btn").addEventListener("click", () => {
      const newLabel = prompt("Label (e.g. Name, Goal, Profession):", mem.label);
      if (newLabel === null) return;
      const newValue = prompt(`Value for "${newLabel}":`, mem.value);
      if (newValue === null) return;
      memories[idx] = { label: newLabel.trim(), value: newValue.trim() };
      saveMemories(memories);
      renderMemoryList();
    });

    item.querySelector(".memory-delete-btn").addEventListener("click", () => {
      if (!confirm(`Delete the memory "${mem.label}"?`)) return;
      memories.splice(idx, 1);
      saveMemories(memories);
      renderMemoryList();
    });

    container.appendChild(item);
  });
}

const addMemoryBtn = document.getElementById("addMemoryBtn");
if (addMemoryBtn) {
  addMemoryBtn.addEventListener("click", () => {
    const label = prompt("What should this memory be called? (e.g. Name, Goal, Profession)");
    if (!label || !label.trim()) return;
    const value = prompt(`What's the value for "${label.trim()}"?`);
    if (value === null || !value.trim()) return;
    memories.push({ label: label.trim(), value: value.trim() });
    saveMemories(memories);
    renderMemoryList();
  });
}

// ---------- Home screen hub cards (Government / Education / Career grids) ----------
document.querySelectorAll(".hub-card").forEach((card) => {
  card.addEventListener("click", () => {
    if (card.dataset.openCv === "true") {
      openCvModal();
      return;
    }
    if (card.dataset.openInterview === "true") {
      openInterviewModal();
      return;
    }
    sendMessage(card.dataset.text);
  });
});

// "View all" buttons on each hub section open the sidebar and expand the matching group
document.querySelectorAll(".hub-view-all[data-view-group]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const groupEl = document.getElementById(btn.dataset.viewGroup);
    sidebarEl.classList.add("open");
    if (groupEl) {
      groupEl.classList.add("open");
      groupEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
});
