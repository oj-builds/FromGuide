const chatEl = document.getElementById("chat");
const welcomeScreenEl = document.getElementById("welcomeScreen");

function hideSuggestions() {
  const el = document.getElementById("chatgptSuggestions");
  if (el) el.style.display = "none";
}
function showSuggestions() {
  const el = document.getElementById("chatgptSuggestions");
  if (el) el.style.display = "flex";
}
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

let showPinnedOnly = false;

function renderSidebar() {
  chatListEl.innerHTML = "";
  const search = searchInput ? searchInput.value.toLowerCase() : "";
  conversations.sort((a, b) => {
    if (a.pinned === b.pinned) return 0;
    return a.pinned ? -1 : 1;
  });

  const visibleConvs = conversations.filter((conv) => {
    if (showPinnedOnly && !conv.pinned) return false;
    if (!search) return true;
    return (conv.title || "").toLowerCase().includes(search);
  });

  if (showPinnedOnly && visibleConvs.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "padding:16px 8px;color:var(--text-dim);font-size:12.5px;text-align:center;";
    empty.textContent = "No pinned chats yet. Tap the 📍 icon next to any chat to pin it here.";
    chatListEl.appendChild(empty);
    return;
  }

  visibleConvs
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

  if (typeof content === "string" && content.startsWith("data:image")) {
    const img = document.createElement("img");
    img.src = content;
    img.className = "chat-generated-image";
    bubble.appendChild(img);
  } else {
    const textNode = document.createElement("div");
    textNode.textContent = content;
    bubble.appendChild(textNode);
  }

  row.appendChild(bubble);
  messagesEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function renderActiveConversation() {
  messagesEl.innerHTML = "";
  const conv = getCurrentConversation();

  if (!conv || conv.messages.length === 0) {
    welcomeScreenEl.style.display = "block"; showSuggestions();
    return;
  }

  welcomeScreenEl.style.display = "none"; hideSuggestions();
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

  welcomeScreenEl.style.display = "none"; hideSuggestions();

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

// --- Home screen quick suggestions (ChatGPT-style) ---
const suggestGovernmentBtn = document.getElementById("suggestGovernment");
const suggestImageBtn = document.getElementById("suggestImage");
const suggestSearchBtn = document.getElementById("suggestSearch");

if (suggestGovernmentBtn) {
  suggestGovernmentBtn.addEventListener("click", () => {
    document.getElementById("governmentModal").classList.add("open");
  });
}
if (suggestImageBtn) {
  suggestImageBtn.addEventListener("click", () => {
    const genBtn = document.getElementById("generateImageBtn");
    if (genBtn) genBtn.click();
  });
}
if (suggestSearchBtn) {
  suggestSearchBtn.addEventListener("click", () => {
    inputEl.focus();
  });
}

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage(inputEl.value.trim());
});

// Feature cards on the welcome screen
const governmentModal = document.getElementById("governmentModal");
const closeGovernmentBtn = document.getElementById("closeGovernmentBtn");
if (closeGovernmentBtn) {
  closeGovernmentBtn.addEventListener("click", () => governmentModal.classList.remove("open"));
}

const educationModal = document.getElementById("educationModal");
const closeEducationBtn = document.getElementById("closeEducationBtn");
if (closeEducationBtn) {
  closeEducationBtn.addEventListener("click", () => educationModal.classList.remove("open"));
}

const careerModal = document.getElementById("careerModal");
const closeCareerBtn = document.getElementById("closeCareerBtn");
if (closeCareerBtn) {
  closeCareerBtn.addEventListener("click", () => careerModal.classList.remove("open"));
}

// The tool cards inside these category pages (NIN, Passport, CV Builder, etc.)
document.querySelectorAll(".hub-card").forEach((card) => {
  card.addEventListener("click", () => {
    governmentModal.classList.remove("open");
    educationModal.classList.remove("open");
    careerModal.classList.remove("open");

    if (card.dataset.openCv === "true") {
      openCvModal();
      return;
    }
    if (card.dataset.openInterview === "true") {
      openInterviewModal();
      return;
    }
    if (card.id === "hubHomeworkHelperBtn") {
      openHomeworkHelperModal();
      return;
    }
    sendMessage(card.dataset.text);
  });
});

// Sidebar: Government / Career / Education each open their own dedicated page
document.getElementById("navGovernment").addEventListener("click", () => {
  governmentModal.classList.add("open");
  sidebarEl.classList.remove("open");
});
document.getElementById("navCareer").addEventListener("click", () => {
  careerModal.classList.add("open");
  sidebarEl.classList.remove("open");
});
document.getElementById("navEducation").addEventListener("click", () => {
  educationModal.classList.add("open");
  sidebarEl.classList.remove("open");
});
document.getElementById("navInterview").addEventListener("click", () => {
  openInterviewModal();
  sidebarEl.classList.remove("open");
});
document.getElementById("navJourney").addEventListener("click", () => {
  sendMessage("Create a step-by-step learning/career roadmap for me and help me track my progress.");
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
    syncPreferenceToBackend("language", languagePref);
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

// Logged-in users get their theme/accent/language saved to their account, so it
// follows them across devices. Guests fall back to this browser's storage only.
function syncPreferenceToBackend(key, value) {
  if (!getToken()) return;
  fetch("/api/user/preferences", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ [key]: value }),
  }).catch((err) => console.error("Could not sync preference:", err));
}

async function loadPreferencesFromAccount() {
  if (!getToken()) return;
  try {
    const res = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    const prefs = data.user?.preferences;
    if (!prefs) return;

    if (prefs.theme) setTheme(prefs.theme, { skipSync: true });
    if (prefs.accent) setAccent(prefs.accent, { skipSync: true });
    if (prefs.language) {
      languagePref = prefs.language;
      localStorage.setItem(LANG_KEY, languagePref);
    }
  } catch (err) {
    console.error("Could not load account preferences:", err);
  }
}

function applyThemeUI() {
  const saved = localStorage.getItem(THEME_KEY) || "light";
  document.querySelectorAll(".theme-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === saved);
  });
}
function setTheme(theme, opts = {}) {
  localStorage.setItem(THEME_KEY, theme);
  document.body.classList.remove("theme-dark", "theme-light");
  if (theme === "dark") {
    document.body.classList.add("theme-dark");
  } else if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.add(prefersDark ? "theme-dark" : "theme-light");
  }
  applyThemeUI();
  if (!opts.skipSync) syncPreferenceToBackend("theme", theme);
}
document.querySelectorAll(".theme-option").forEach((btn) => {
  btn.addEventListener("click", () => setTheme(btn.dataset.theme));
});
setTheme(localStorage.getItem(THEME_KEY) || "light", { skipSync: true });

function applyAccentUI() {
  const saved = localStorage.getItem(ACCENT_KEY) || "default";
  document.querySelectorAll(".accent-dot").forEach((dot) => {
    dot.classList.toggle("selected", dot.dataset.accent === saved);
  });
}
function setAccent(accent, opts = {}) {
  localStorage.setItem(ACCENT_KEY, accent);
  document.body.classList.remove("accent-blue", "accent-green", "accent-red", "accent-orange");
  if (accent !== "default") document.body.classList.add(`accent-${accent}`);
  applyAccentUI();
  if (!opts.skipSync) syncPreferenceToBackend("accent", accent);
}
document.querySelectorAll(".accent-dot").forEach((dot) => {
  dot.addEventListener("click", () => setAccent(dot.dataset.accent));
});
setAccent(localStorage.getItem(ACCENT_KEY) || "default", { skipSync: true });


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

document.getElementById("deleteAccountBtn").addEventListener("click", async () => {
  if (!getToken()) {
    alert("You need to be logged in to delete an account.");
    return;
  }

  const firstConfirm = confirm(
    "This will permanently delete your account, all your saved conversations, and everything FormGuide AI remembers about you. This cannot be undone. Continue?"
  );
  if (!firstConfirm) return;

  const secondConfirm = confirm("Are you absolutely sure? This is your last chance to cancel.");
  if (!secondConfirm) return;

  try {
    const res = await fetch("/api/user/account", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Could not delete your account. Please try again.");
      return;
    }

    clearSession();
    conversations = [];
    saveConversations();
    alert("Your account has been deleted. Goodbye for now!");
    window.location.reload();
  } catch (err) {
    alert("Could not reach the server. Please try again.");
  }
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
  loadPreferencesFromAccount();
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

  applyOwnerVisibility();
}

// The name chip in the top bar is ONLY ever visible to you — never to regular
// users, regardless of who else logs in. Set OWNER_EMAIL to the exact email
// your account logs in with, and FOUNDER_NAME to your real name. Everyone
// else, including guests, only ever sees the bell.
const OWNER_EMAIL = "";
const FOUNDER_NAME = "";

function applyOwnerVisibility() {
  const user = getStoredUser();
  const isOwner = !!(OWNER_EMAIL && user && user.email && user.email.toLowerCase() === OWNER_EMAIL.toLowerCase());

  const chip = document.getElementById("ownerChip");
  const ownerNameEl = document.getElementById("ownerName");
  if (!chip) return;

  chip.style.display = isOwner ? "block" : "none";
  if (ownerNameEl && isOwner) {
    ownerNameEl.textContent = FOUNDER_NAME ? `${FOUNDER_NAME} · Founder & CEO` : "Founder & CEO";
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
  loadPreferencesFromAccount();
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
const topNotifBadge = document.getElementById("topNotifBadge");
const notificationsList = document.getElementById("notificationsList");
const notificationsEmpty = document.getElementById("notificationsEmpty");

function setNotifBadge(count) {
  [notifBadge, topNotifBadge].forEach((el) => {
    if (!el) return;
    if (count > 0) {
      el.textContent = count;
      el.style.display = "flex";
    } else {
      el.style.display = "none";
    }
  });
}

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
    setNotifBadge(0);
    return;
  }

  try {
    const res = await fetch("/api/notifications", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    const notifications = data.notifications || [];

    const unreadCount = notifications.filter((n) => !n.read).length;
    setNotifBadge(unreadCount);

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
    setNotifBadge(unreadLeft);
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
const proBannerBtn = document.getElementById("sidebarProBanner");

function setActiveNavItem(activeBtn) {
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
  if (activeBtn) activeBtn.classList.add("active");
}

if (navHomeBtn) {
  navHomeBtn.addEventListener("click", () => {
    setActiveNavItem(navHomeBtn);
    showPinnedOnly = false;
    renderSidebar();
    welcomeScreenEl.style.display = "block"; showSuggestions();
    messagesEl.innerHTML = "";
    sidebarEl.classList.remove("open");
  });
}

if (navChatLinkBtn) {
  navChatLinkBtn.addEventListener("click", () => {
    setActiveNavItem(navChatLinkBtn);
    showPinnedOnly = false;
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
    showPinnedOnly = true;
    renderSidebar();
    sidebarEl.classList.add("open");
  });
}

if (navHistoryBtn) {
  navHistoryBtn.addEventListener("click", () => {
    setActiveNavItem(navHistoryBtn);
    chatListEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    sidebarEl.classList.remove("open");
  });
}

const aiStudioModal = document.getElementById("aiStudioModal");
const closeAiStudioBtn = document.getElementById("closeAiStudioBtn");

function renderStudioProjects() {
  const grid = document.getElementById("studioProjectsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const recent = conversations.slice(0, 5);
  recent.forEach((conv) => {
    const card = document.createElement("button");
    card.className = "studio-project-card";
    const lastMsg = conv.messages.length ? conv.messages[conv.messages.length - 1].content.slice(0, 40) : "No messages yet";
    card.innerHTML = `
      <span class="icon">💬</span>
      <div class="studio-project-title">${conv.title || "New chat"}</div>
      <div class="studio-project-meta">${lastMsg}</div>
    `;
    card.addEventListener("click", () => {
      currentId = conv.id;
      renderSidebar();
      renderActiveConversation();
      aiStudioModal.classList.remove("open");
    });
    grid.appendChild(card);
  });

  const newCard = document.createElement("button");
  newCard.className = "studio-project-card new-project";
  newCard.textContent = "+ New Project";
  newCard.addEventListener("click", () => {
    startNewChat();
    aiStudioModal.classList.remove("open");
  });
  grid.appendChild(newCard);
}

function openAiStudioModal() {
  const user = getStoredUser();
  const nameEl = document.getElementById("studioWelcomeName");
  if (nameEl) nameEl.textContent = user ? `Welcome back, ${user.name} 👋` : "Welcome back 👋";
  renderStudioProjects();
  aiStudioModal.classList.add("open");
}

if (navAiStudioBtn) {
  navAiStudioBtn.addEventListener("click", () => {
    openAiStudioModal();
    sidebarEl.classList.remove("open");
  });
}
if (closeAiStudioBtn) {
  closeAiStudioBtn.addEventListener("click", () => aiStudioModal.classList.remove("open"));
}

document.querySelectorAll(".studio-create-card[data-text], .studio-popular-card[data-text]").forEach((card) => {
  card.addEventListener("click", () => {
    aiStudioModal.classList.remove("open");
    sendMessage(card.dataset.text);
  });
});

const studioImageCard = document.getElementById("studioImageCard");
const studioImageCard2 = document.getElementById("studioImageCard2");
[studioImageCard, studioImageCard2].forEach((btn) => {
  if (!btn) return;
  btn.addEventListener("click", () => {
    aiStudioModal.classList.remove("open");
    if (generateImageBtn) generateImageBtn.click();
  });
});

const studioMoreToolsCard = document.getElementById("studioMoreToolsCard");
if (studioMoreToolsCard) {
  studioMoreToolsCard.addEventListener("click", () => {
    aiStudioModal.classList.remove("open");
    sidebarEl.classList.add("open");
  });
}

const templatesModal = document.getElementById("templatesModal");
const closeTemplatesBtn = document.getElementById("closeTemplatesBtn");

if (navTemplatesBtn) {
  navTemplatesBtn.addEventListener("click", () => {
    templatesModal.classList.add("open");
    sidebarEl.classList.remove("open");
  });
}
if (closeTemplatesBtn) {
  closeTemplatesBtn.addEventListener("click", () => templatesModal.classList.remove("open"));
}

// ---------- AI Study Companion ----------
// Uses the real backend Memory system (not localStorage) so the profile
// follows the user's account, and generates plans through the normal chat
// pipeline so replies are personalized and saved in chat history like anything else.
const studyCompanionModal = document.getElementById("studyCompanionModal");
const closeStudyCompanionBtn = document.getElementById("closeStudyCompanionBtn");
const navAiTutorBtn = document.getElementById("navAiTutor");

const COMPANION_KEYS = {
  classLevel: "study_class_level",
  curriculum: "study_curriculum",
  subjects: "study_subjects",
  examDate: "study_exam_date",
  careerGoal: "study_career_goal",
};

async function fetchCompanionProfile() {
  if (!getToken()) return null;
  try {
    const res = await fetch("/api/memories", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.memories || [];
  } catch (err) {
    console.error("Could not load study profile:", err);
    return null;
  }
}

function getMemoryValue(memories, key) {
  const found = memories.find((m) => m.key === key);
  return found ? found.value : "";
}

async function saveCompanionField(key, value) {
  return fetch("/api/memories", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ key, value }),
  });
}

function renderCompanionDashboard(memories) {
  const user = getStoredUser();
  const greetingEl = document.getElementById("companionGreeting");
  if (greetingEl) greetingEl.textContent = user ? `Good to see you, ${user.name} 👋` : "Good to see you 👋";

  const classLevel = getMemoryValue(memories, COMPANION_KEYS.classLevel);
  const curriculum = getMemoryValue(memories, COMPANION_KEYS.curriculum);
  const subjects = getMemoryValue(memories, COMPANION_KEYS.subjects);
  const examDate = getMemoryValue(memories, COMPANION_KEYS.examDate);
  const careerGoal = getMemoryValue(memories, COMPANION_KEYS.careerGoal);

  const summaryEl = document.getElementById("companionProfileSummary");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div>🎓 <strong>Class:</strong> ${classLevel}</div>
      <div>📘 <strong>Curriculum:</strong> ${curriculum}</div>
      <div>📚 <strong>Subjects:</strong> ${subjects}</div>
      <div>🗓️ <strong>Next exam:</strong> ${examDate}</div>
      <div>🎯 <strong>Career goal:</strong> ${careerGoal}</div>
    `;
  }
}

async function openStudyCompanionModal() {
  const guestNotice = document.getElementById("companionGuestNotice");
  const onboarding = document.getElementById("companionOnboarding");
  const dashboard = document.getElementById("companionDashboard");
  if (!guestNotice || !onboarding || !dashboard) return;

  guestNotice.style.display = "none";
  onboarding.style.display = "none";
  dashboard.style.display = "none";
  studyCompanionModal.classList.add("open");

  if (!getToken()) {
    guestNotice.style.display = "block";
    return;
  }

  const memories = await fetchCompanionProfile();
  if (memories === null) {
    guestNotice.style.display = "block";
    return;
  }

  const classLevel = getMemoryValue(memories, COMPANION_KEYS.classLevel);
  if (!classLevel) {
    onboarding.style.display = "block";
  } else {
    renderCompanionDashboard(memories);
    dashboard.style.display = "block";
  }
}

if (navAiTutorBtn) {
  navAiTutorBtn.addEventListener("click", () => {
    openStudyCompanionModal();
    sidebarEl.classList.remove("open");
  });
}
if (closeStudyCompanionBtn) {
  closeStudyCompanionBtn.addEventListener("click", () => studyCompanionModal.classList.remove("open"));
}

const companionSaveBtn = document.getElementById("companionSaveBtn");
if (companionSaveBtn) {
  companionSaveBtn.addEventListener("click", async () => {
    const classLevel = document.getElementById("companionClassLevel").value.trim();
    const curriculum = document.getElementById("companionCurriculum").value.trim();
    const subjects = document.getElementById("companionSubjects").value.trim();
    const examDate = document.getElementById("companionExamDate").value.trim();
    const careerGoal = document.getElementById("companionCareerGoal").value.trim();

    if (!classLevel || !subjects) {
      alert("Please fill in at least your class level and subjects.");
      return;
    }

    companionSaveBtn.disabled = true;
    const originalText = companionSaveBtn.textContent;
    companionSaveBtn.textContent = "Saving…";

    try {
      await Promise.all([
        saveCompanionField(COMPANION_KEYS.classLevel, classLevel),
        saveCompanionField(COMPANION_KEYS.curriculum, curriculum || "Not specified"),
        saveCompanionField(COMPANION_KEYS.subjects, subjects),
        saveCompanionField(COMPANION_KEYS.examDate, examDate || "Not specified"),
        saveCompanionField(COMPANION_KEYS.careerGoal, careerGoal || "Not specified"),
      ]);

      studyCompanionModal.classList.remove("open");
      sendMessage(
        `Here's my learning profile — Class: ${classLevel}. Curriculum: ${curriculum || "Not specified"}. Subjects: ${subjects}. Next exam: ${examDate || "Not specified"}. Career goal: ${careerGoal || "Not specified"}. Please create a focused, personalized study plan for today based on this, and briefly tell me how you'll help me as my study companion going forward.`
      );
    } catch (err) {
      alert("Could not save your profile. Please check your connection and try again.");
    } finally {
      companionSaveBtn.disabled = false;
      companionSaveBtn.textContent = originalText;
    }
  });
}

const companionPlanBtn = document.getElementById("companionPlanBtn");
if (companionPlanBtn) {
  companionPlanBtn.addEventListener("click", async () => {
    const memories = await fetchCompanionProfile();
    if (!memories) return;

    const classLevel = getMemoryValue(memories, COMPANION_KEYS.classLevel);
    const curriculum = getMemoryValue(memories, COMPANION_KEYS.curriculum);
    const subjects = getMemoryValue(memories, COMPANION_KEYS.subjects);
    const examDate = getMemoryValue(memories, COMPANION_KEYS.examDate);
    const careerGoal = getMemoryValue(memories, COMPANION_KEYS.careerGoal);

    studyCompanionModal.classList.remove("open");
    sendMessage(
      `Based on my learning profile — Class: ${classLevel}. Curriculum: ${curriculum}. Subjects: ${subjects}. Next exam: ${examDate}. Career goal: ${careerGoal} — please build me a focused study plan for today. Prioritize weaker topics if you already know them from our past conversations, and keep it practical and specific to today.`
    );
  });
}

const companionEditBtn = document.getElementById("companionEditBtn");
if (companionEditBtn) {
  companionEditBtn.addEventListener("click", async () => {
    const memories = await fetchCompanionProfile();
    if (!memories) return;

    document.getElementById("companionClassLevel").value = getMemoryValue(memories, COMPANION_KEYS.classLevel);
    document.getElementById("companionCurriculum").value = getMemoryValue(memories, COMPANION_KEYS.curriculum);
    document.getElementById("companionSubjects").value = getMemoryValue(memories, COMPANION_KEYS.subjects);
    document.getElementById("companionExamDate").value = getMemoryValue(memories, COMPANION_KEYS.examDate);
    document.getElementById("companionCareerGoal").value = getMemoryValue(memories, COMPANION_KEYS.careerGoal);

    document.getElementById("companionDashboard").style.display = "none";
    document.getElementById("companionOnboarding").style.display = "block";
  });
}

// ---------- Study Planner ----------
// If the user already has a Study Companion profile, pull subjects/exam info
// from it automatically so they don't have to type the same thing twice.
const studyPlannerModal = document.getElementById("studyPlannerModal");
const closeStudyPlannerBtn = document.getElementById("closeStudyPlannerBtn");
const navStudyPlannerBtn = document.getElementById("navStudyPlanner");

async function openStudyPlannerModal() {
  const subjectsInput = document.getElementById("plannerSubjects");
  subjectsInput.value = "";

  if (getToken()) {
    const memories = await fetchCompanionProfile();
    if (memories) {
      const savedSubjects = getMemoryValue(memories, COMPANION_KEYS.subjects);
      if (savedSubjects) subjectsInput.value = savedSubjects;
    }
  }

  studyPlannerModal.classList.add("open");
}

if (navStudyPlannerBtn) {
  navStudyPlannerBtn.addEventListener("click", () => {
    openStudyPlannerModal();
    sidebarEl.classList.remove("open");
  });
}
if (closeStudyPlannerBtn) {
  closeStudyPlannerBtn.addEventListener("click", () => studyPlannerModal.classList.remove("open"));
}

const plannerGenerateBtn = document.getElementById("plannerGenerateBtn");
if (plannerGenerateBtn) {
  plannerGenerateBtn.addEventListener("click", () => {
    const subjects = document.getElementById("plannerSubjects").value.trim();
    const days = document.getElementById("plannerDays").value.trim();
    const hours = document.getElementById("plannerHours").value.trim();

    if (!subjects || !days) {
      alert("Please fill in your subjects and how many days you have until your exam.");
      return;
    }

    studyPlannerModal.classList.remove("open");
    sendMessage(
      `Please create a detailed study timetable for me. Subjects: ${subjects}. I have ${days} day${days === "1" ? "" : "s"} until my exam${hours ? `, and I can study about ${hours} hours per day` : ""}. Break it down day by day (or week by week if the timeframe is long), cover all subjects with a good balance, prioritize weaker topics if you already know them from our past conversations, and include short breaks. Keep it practical and easy to follow.`
    );
  });
}

// ---------- AI Homework Helper ----------
// Reuses the existing photo-upload (vision) and voice-note (Whisper) pipelines,
// just framed specifically to get step-by-step explanations instead of bare answers.
const homeworkHelperModal = document.getElementById("homeworkHelperModal");
const closeHomeworkHelperBtn = document.getElementById("closeHomeworkHelperBtn");
const navHomeworkHelperBtn = document.getElementById("navHomeworkHelper");

function openHomeworkHelperModal() {
  document.getElementById("homeworkActionCards").style.display = "grid";
  document.getElementById("homeworkTypeBox").style.display = "none";
  document.getElementById("homeworkTypeInput").value = "";
  homeworkHelperModal.classList.add("open");
}

if (navHomeworkHelperBtn) {
  navHomeworkHelperBtn.addEventListener("click", () => {
    openHomeworkHelperModal();
    sidebarEl.classList.remove("open");
  });
}
if (closeHomeworkHelperBtn) {
  closeHomeworkHelperBtn.addEventListener("click", () => homeworkHelperModal.classList.remove("open"));
}

const homeworkPhotoBtn = document.getElementById("homeworkPhotoBtn");
if (homeworkPhotoBtn) {
  homeworkPhotoBtn.addEventListener("click", () => {
    uploadContext = "homework";
    homeworkHelperModal.classList.remove("open");
    if (photoFileInput) photoFileInput.click();
  });
}

const homeworkTypeBtn = document.getElementById("homeworkTypeBtn");
if (homeworkTypeBtn) {
  homeworkTypeBtn.addEventListener("click", () => {
    document.getElementById("homeworkActionCards").style.display = "none";
    document.getElementById("homeworkTypeBox").style.display = "block";
    document.getElementById("homeworkTypeInput").focus();
  });
}

const homeworkTypeSubmitBtn = document.getElementById("homeworkTypeSubmitBtn");
if (homeworkTypeSubmitBtn) {
  homeworkTypeSubmitBtn.addEventListener("click", () => {
    const question = document.getElementById("homeworkTypeInput").value.trim();
    if (!question) {
      alert("Please type your question first.");
      return;
    }
    homeworkHelperModal.classList.remove("open");
    sendMessage(
      `Please help me with this homework question, explaining step by step rather than just giving the answer: ${question}`
    );
  });
}

const homeworkSpeakBtn = document.getElementById("homeworkSpeakBtn");
if (homeworkSpeakBtn) {
  wireVoiceNoteButton(homeworkSpeakBtn);
  // Mark that the next voice note came from Homework Helper so it gets framed
  // for step-by-step explanation instead of being sent as a plain message.
  homeworkSpeakBtn.addEventListener("mousedown", () => {
    recordingContext = "homework";
    homeworkHelperModal.classList.remove("open");
  });
  homeworkSpeakBtn.addEventListener("touchstart", () => {
    recordingContext = "homework";
    homeworkHelperModal.classList.remove("open");
  });
}

document.querySelectorAll(".templates-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".templates-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const category = tab.dataset.category;
    document.querySelectorAll(".template-card").forEach((card) => {
      card.style.display = category === "all" || card.dataset.category === category ? "flex" : "none";
    });
  });
});

document.querySelectorAll(".template-card").forEach((card) => {
  card.addEventListener("click", () => {
    templatesModal.classList.remove("open");
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

const comingSoonItems = [
  { id: "navStudyTools", label: "Study Tools" },
  { id: "navSubjects", label: "Subjects" },
  { id: "navExamCentre", label: "Exam Centre" },
  { id: "navDigitalLibrary", label: "Digital Library" },
  { id: "navNotesFlashcards", label: "Notes & Flashcards" },
  { id: "navSchoolDirectory", label: "School Directory" },
  { id: "navWallet", label: "Payments & Wallet" },
  { id: "navParentDashboard", label: "Parent Dashboard" },
  { id: "navAchievements", label: "Achievements" },
];

comingSoonItems.forEach(({ id, label }) => {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener("click", () => {
      alert(`${label} is coming soon!`);
      sidebarEl.classList.remove("open");
    });
  }
});

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

  if (!getToken()) {
    const notice = document.createElement("div");
    notice.style.cssText =
      "background:#fff3cd;color:#7a5c00;border:1px solid #ffe08a;border-radius:10px;padding:10px 12px;font-size:12px;margin-bottom:14px;";
    notice.textContent =
      "You're not logged in — these memories will only be saved on this device. Log in to keep them saved for good.";
    container.appendChild(notice);
  }

  if (memories.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "text-align:center;color:#999;padding:24px 0;";
    empty.textContent = 'No memories added yet. Tap "Add Memory" to get started.';
    container.appendChild(empty);
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

// ---------- Action buttons row: Voice Chat / Upload File / AI Search / Generate Image / More Tools ----------
const voiceChatBtn = document.getElementById("voiceChatBtn");
const voiceChatModal = document.getElementById("voiceChatModal");
const closeVoiceChatBtn = document.getElementById("closeVoiceChatBtn");
const voiceMicBtn = document.getElementById("voiceMicBtn");
const voiceStatusText = document.getElementById("voiceStatusText");
const voiceWaveform = document.getElementById("voiceWaveform");

const uploadFileBtn = document.getElementById("uploadFileBtn");
const uploadModal = document.getElementById("uploadModal");
const closeUploadBtn = document.getElementById("closeUploadBtn");
const dropZone = document.getElementById("dropZone");
const uploadFileInput = document.getElementById("uploadFileInput");
const recentFilesList = document.getElementById("recentFilesList");

const aiSearchBtn = document.getElementById("aiSearchBtn");
const generateImageBtn = document.getElementById("generateImageBtn");
const moreToolsBtn = document.getElementById("moreToolsBtn");

// --- Chat with Voice (tap to talk, full screen — uses the browser's built-in
// speech recognition where supported; separate from the press-and-hold voice
// note icon next to the send button) ---
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognitionAPI) {
  recognition = new SpeechRecognitionAPI();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    closeVoiceChatModal();
    sendMessage(transcript);
  };

  recognition.onerror = () => {
    voiceStatusText.textContent = "Sorry, I couldn't hear that. Tap to try again.";
    stopListeningUI();
  };

  recognition.onend = () => {
    stopListeningUI();
  };
}

function startListeningUI() {
  isListening = true;
  voiceMicBtn.classList.add("listening");
  voiceWaveform.classList.add("active");
  voiceStatusText.textContent = "I'm listening…";
}
function stopListeningUI() {
  isListening = false;
  voiceMicBtn.classList.remove("listening");
  voiceWaveform.classList.remove("active");
  voiceStatusText.textContent = "Tap to speak";
}

function openVoiceChatModal() {
  voiceChatModal.classList.add("open");
  stopListeningUI();
  if (!SpeechRecognitionAPI) {
    voiceStatusText.textContent = "Voice input isn't supported in this browser. Try Chrome.";
  }
}
function closeVoiceChatModal() {
  voiceChatModal.classList.remove("open");
  if (recognition && isListening) recognition.stop();
  stopListeningUI();
}

if (voiceChatBtn) {
  voiceChatBtn.addEventListener("click", () => {
    openVoiceChatModal();
    sidebarEl.classList.remove("open");
  });
}
if (closeVoiceChatBtn) closeVoiceChatBtn.addEventListener("click", closeVoiceChatModal);

if (voiceMicBtn) {
  voiceMicBtn.addEventListener("click", () => {
    if (!SpeechRecognitionAPI) return;
    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
        startListeningUI();
      } catch (err) {
        console.error("Speech recognition error:", err);
      }
    }
  });
}

// --- Voice Notes (WhatsApp-style press-and-hold, transcribed via OpenAI Whisper —
// handles Igbo, English, and mixing between them far better than browser speech recognition) ---
const recordingIndicator = document.getElementById("recordingIndicator");
const recordingTimerEl = document.getElementById("recordingTimer");

let mediaRecorder = null;
let audioChunks = [];
let recordingStream = null;
let recordingTimerInterval = null;
let recordingSeconds = 0;
let isRecording = false;
let recordingContext = "voice_note"; // "voice_note" or "homework" — changes how the transcript is framed

function showRecordingIndicator() {
  recordingSeconds = 0;
  recordingTimerEl.textContent = "0:00";
  recordingIndicator.classList.add("active");
  recordingTimerInterval = setInterval(() => {
    recordingSeconds += 1;
    const mins = Math.floor(recordingSeconds / 60);
    const secs = String(recordingSeconds % 60).padStart(2, "0");
    recordingTimerEl.textContent = `${mins}:${secs}`;
  }, 1000);
}
function hideRecordingIndicator() {
  clearInterval(recordingTimerInterval);
  recordingIndicator.classList.remove("active");
}

async function startRecording() {
  if (isRecording) return;
  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    alert("Microphone access is needed for voice notes. Please allow microphone permission and try again.");
    return;
  }

  audioChunks = [];
  mediaRecorder = new MediaRecorder(recordingStream);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };
  mediaRecorder.start();
  isRecording = true;
  showRecordingIndicator();
}

function stopRecordingAndSend() {
  if (!isRecording || !mediaRecorder) return;
  isRecording = false;

  mediaRecorder.onstop = async () => {
    hideRecordingIndicator();
    recordingStream.getTracks().forEach((t) => t.stop());

    const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
    if (audioBlob.size < 800) return; // too short — probably an accidental tap

    welcomeScreenEl.style.display = "none"; hideSuggestions();
    renderTyping();

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "voice-note.webm");

      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();
      removeTyping();

      if (!res.ok) {
        renderMessage("assistant", data.error || "Sorry, I couldn't understand that voice note.");
        return;
      }
      if (data.text && data.text.trim()) {
        if (recordingContext === "homework") {
          recordingContext = "voice_note";
          sendMessage(
            `Please help me with this homework question, explaining step by step rather than just giving the answer: ${data.text.trim()}`
          );
        } else {
          sendMessage(data.text.trim());
        }
      } else {
        renderMessage("assistant", "I couldn't hear anything clearly in that voice note. Please try again.");
      }
    } catch (err) {
      removeTyping();
      renderMessage("assistant", "Could not reach the server to process your voice note.");
    }
  };

  mediaRecorder.stop();
}

function cancelRecording() {
  if (!isRecording || !mediaRecorder) return;
  isRecording = false;
  mediaRecorder.onstop = () => {
    recordingStream.getTracks().forEach((t) => t.stop());
  };
  mediaRecorder.stop();
  hideRecordingIndicator();
}

function wireVoiceNoteButton(el) {
  if (!el) return;
  el.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startRecording();
  });
  el.addEventListener("mouseup", stopRecordingAndSend);
  el.addEventListener("mouseleave", () => {
    if (isRecording) cancelRecording();
  });
  el.addEventListener("touchstart", (e) => {
    e.preventDefault();
    startRecording();
  });
  el.addEventListener("touchend", (e) => {
    e.preventDefault();
    stopRecordingAndSend();
  });
  el.addEventListener("touchcancel", () => {
    if (isRecording) cancelRecording();
  });
}

// --- Upload & Analyze ---
const RECENT_FILES_KEY = "formguide_recent_files";
let uploadContext = "general"; // "general" or "homework" — changes how photo uploads are framed

function loadRecentFiles() {
  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function saveRecentFiles(list) {
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(list.slice(0, 10)));
}

function fileIconFor(name) {
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf") return "📕";
  if (ext === "docx" || ext === "doc") return "📘";
  if (["png", "jpg", "jpeg"].includes(ext)) return "🖼️";
  return "📄";
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function renderRecentFiles() {
  const files = loadRecentFiles();
  recentFilesList.innerHTML = "";
  if (files.length === 0) {
    recentFilesList.innerHTML =
      '<div style="text-align:center;color:var(--text-dim);padding:16px 0;font-size:12.5px;">No files uploaded yet.</div>';
    return;
  }
  files.forEach((f) => {
    const item = document.createElement("div");
    item.className = "recent-file-item";
    item.innerHTML = `
      <div class="recent-file-icon">${fileIconFor(f.name)}</div>
      <div class="recent-file-info">
        <div class="recent-file-name">${f.name}</div>
        <div class="recent-file-meta">${formatFileSize(f.size)} • ${f.type || "file"}</div>
      </div>
    `;
    item.addEventListener("click", () => {
      closeUploadModal();
      sendMessage(`I previously uploaded a file called "${f.name}". Can you help me with it again?`);
    });
    recentFilesList.appendChild(item);
  });
}

function openUploadModal() {
  uploadModal.classList.add("open");
  renderRecentFiles();
}
function closeUploadModal() {
  uploadModal.classList.remove("open");
}

if (uploadFileBtn) {
  uploadFileBtn.addEventListener("click", () => {
    openUploadModal();
    sidebarEl.classList.remove("open");
  });
}
if (closeUploadBtn) closeUploadBtn.addEventListener("click", closeUploadModal);

if (dropZone) {
  dropZone.addEventListener("click", () => uploadFileInput.click());
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      handleUploadedFile(e.dataTransfer.files[0], { allowImages: false });
    }
  });
}

if (uploadFileInput) {
  uploadFileInput.addEventListener("change", () => {
    if (uploadFileInput.files.length > 0) {
      handleUploadedFile(uploadFileInput.files[0], { allowImages: false });
    }
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result looks like "data:image/png;base64,AAAA..." — strip the prefix
      const base64 = String(reader.result).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function appendExchangeToCurrentChat(userText, assistantText) {
  let conv = getCurrentConversation();
  if (!conv) {
    startNewChat();
    conv = getCurrentConversation();
  }
  if (!conv.title) conv.title = makeTitle(userText);

  welcomeScreenEl.style.display = "none"; hideSuggestions();
  conv.messages.push({ role: "user", content: userText });
  conv.messages.push({ role: "assistant", content: assistantText });
  saveConversations();
  renderSidebar();
  renderMessage("user", userText);
  renderMessage("assistant", assistantText);

  if (getToken() && currentId) {
    try {
      await fetch(`/api/chats/${currentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ title: conv.title, messages: conv.messages }),
      });
    } catch (err) {
      console.error("Failed to save chat:", err);
    }
  }
}

async function handleUploadedFile(file, options = {}) {
  const { allowImages = true } = options;
  const maxSize = 20 * 1024 * 1024;
  if (file.size > maxSize) {
    alert("Please choose a file smaller than 20MB.");
    return;
  }

  const isImage = file.type.startsWith("image/");

  if (isImage && !allowImages) {
    alert("This uploader is for documents only. Use the 📎 icon in the message box to send a photo.");
    return;
  }

  const files = loadRecentFiles();
  files.unshift({ name: file.name, size: file.size, type: file.type });
  saveRecentFiles(files);

  const ext = file.name.split(".").pop().toLowerCase();
  const isDocument = ["pdf", "docx", "txt"].includes(ext);

  closeUploadModal();

  const isHomeworkPhoto = uploadContext === "homework";
  if (isHomeworkPhoto) uploadContext = "general";

  if (isImage) {
    // Images go straight to Claude's vision — no text extraction needed.
    renderTyping();
    try {
      const base64 = await fileToBase64(file);
      const question = isHomeworkPhoto
        ? `This is a homework question. Please read it from the image and explain how to solve it step by step, not just the final answer.`
        : `Please look at this image ("${file.name}") and help me with it.`;

      const res = await fetch("/api/chat/vision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType: file.type,
          question: question,
        }),
      });
      const data = await res.json();
      removeTyping();

      if (!res.ok) {
        renderMessage("assistant", data.error || "Sorry, I couldn't analyze that image.");
        return;
      }

      await appendExchangeToCurrentChat(`[Uploaded image: ${file.name}]`, data.reply);
    } catch (err) {
      removeTyping();
      renderMessage("assistant", "Could not reach the server to analyze this image.");
    }
    return;
  }

  if (isDocument) {
    renderTyping();
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();
      removeTyping();

      if (!res.ok) {
        renderMessage("assistant", data.error || "Sorry, I couldn't read that file.");
        return;
      }

      sendMessage(
        `I've uploaded a file called "${data.filename}". Here is its content:\n\n${data.text}\n\nPlease help me understand or work with this.`
      );
    } catch (err) {
      removeTyping();
      renderMessage("assistant", "Could not reach the server to process this file.");
    }
    return;
  }

  sendMessage(
    `I've uploaded a file called "${file.name}" (${formatFileSize(file.size)}), but I'm not sure FormGuide AI can read this file type yet.`
  );
}

// --- AI Search (uses a proper modal instead of window.prompt, which is
// unreliable or blocked in some mobile browser contexts) ---
const aiSearchModal = document.getElementById("aiSearchModal");
const closeAiSearchBtn = document.getElementById("closeAiSearchBtn");
const aiSearchInput = document.getElementById("aiSearchInput");
const aiSearchSubmitBtn = document.getElementById("aiSearchSubmitBtn");

function openAiSearchModal() {
  aiSearchModal.classList.add("open");
  aiSearchInput.value = "";
  setTimeout(() => aiSearchInput.focus(), 50);
}
function closeAiSearchModal() {
  aiSearchModal.classList.remove("open");
}
function submitAiSearch() {
  const query = aiSearchInput.value.trim();
  if (!query) return;
  closeAiSearchModal();
  sendMessage(query);
}

if (aiSearchBtn) {
  aiSearchBtn.addEventListener("click", () => {
    sidebarEl.classList.remove("open");
    openAiSearchModal();
  });
}
if (closeAiSearchBtn) closeAiSearchBtn.addEventListener("click", closeAiSearchModal);
if (aiSearchSubmitBtn) aiSearchSubmitBtn.addEventListener("click", submitAiSearch);
if (aiSearchInput) {
  aiSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitAiSearch();
  });
}

// --- Inline attach / mic buttons on the input bar ---
const inlineAttachBtn = document.getElementById("inlineAttachBtn");
const inlineMicBtn = document.getElementById("inlineMicBtn");
const photoFileInput = document.getElementById("photoFileInput");

if (inlineAttachBtn && photoFileInput) {
  inlineAttachBtn.addEventListener("click", () => photoFileInput.click());
}
if (photoFileInput) {
  photoFileInput.addEventListener("change", () => {
    if (photoFileInput.files.length > 0) {
      handleUploadedFile(photoFileInput.files[0], { allowImages: true });
      photoFileInput.value = "";
    }
  });
}

wireVoiceNoteButton(inlineMicBtn);

// --- Top bar notification bell (in addition to the one in the sidebar) ---
const topNotifBtn = document.getElementById("topNotifBtn");
if (topNotifBtn) {
  topNotifBtn.addEventListener("click", () => {
    notificationsModal.classList.add("open");
    loadNotifications();
  });
}

// --- Generate Image (OpenAI, via your backend) ---
if (generateImageBtn) {
  generateImageBtn.addEventListener("click", async () => {
    sidebarEl.classList.remove("open");
    const description = prompt("Describe the image you'd like FormGuide AI to generate:");
    if (!description || !description.trim()) return;

    welcomeScreenEl.style.display = "none"; hideSuggestions();
    renderTyping();

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ prompt: description.trim() }),
      });
      const data = await res.json();
      removeTyping();

      if (!res.ok) {
        renderMessage("assistant", data.error || "Sorry, I couldn't generate that image.");
        return;
      }

      await appendExchangeToCurrentChat(`Generate an image: ${description.trim()}`, data.image);

      if (typeof data.remaining === "number") {
        renderMessage(
          "assistant",
          data.remaining > 0
            ? `You have ${data.remaining} image generation${data.remaining === 1 ? "" : "s"} left today.`
            : "That was your last image generation for today. You can generate more tomorrow."
        );
      }
    } catch (err) {
      removeTyping();
      renderMessage("assistant", "Could not reach the server to generate this image.");
    }
  });
}

// --- More Tools (opens sidebar's AI Tools section) ---
if (moreToolsBtn) {
  moreToolsBtn.addEventListener("click", () => {
    sidebarEl.classList.add("open");
    const label = Array.from(document.querySelectorAll(".sidebar-section-label")).find(
      (el) => el.textContent.trim() === "AI Tools"
    );
    if (label) label.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}
