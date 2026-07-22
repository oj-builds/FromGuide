const chatEl = document.getElementById("chat");
const welcomeScreenEl = document.getElementById("welcomeScreen");

function hideSuggestions() {
  const el = document.getElementById("chatgptSuggestions");
  if (el) el.style.display = "none";
  const composer = document.getElementById("chatComposerArea");
  if (composer) composer.style.display = "block";
}
function showSuggestions() {
  const el = document.getElementById("chatgptSuggestions");
  if (el) el.style.display = "flex";
  const composer = document.getElementById("chatComposerArea");
  if (composer) composer.style.display = "none";
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

      const favBtn = document.createElement("button");
      favBtn.className = "chat-pin-btn";
      favBtn.innerHTML = conv.favorite ? "⭐" : "☆";
      favBtn.title = "Favorite chat";

      favBtn.addEventListener("click", async (e) => {
        e.stopPropagation();

        conv.favorite = !conv.favorite;

        renderSidebar();

        if (getToken()) {
          await fetch(`/api/chats/${conv.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({
              favorite: conv.favorite,
            }),
          });
        }
      });

      item.appendChild(label);
      item.appendChild(favBtn);
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

  switchToChatMode();

  conv.messages.push({ role: "user", content: text });
  saveConversations();
  renderSidebar();
  renderMessage("user", text);
  updateChatEmptyState();
  renderTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        messages: conv.messages,
        language: languagePref,
        mode: typeof currentChatMode !== "undefined" ? currentChatMode : "general",
      }),
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
const navInterviewBtn = document.getElementById("navInterview");
if (navInterviewBtn) {
  navInterviewBtn.addEventListener("click", () => {
    openInterviewModal();
    sidebarEl.classList.remove("open");
  });
}
const navJourneyBtn = document.getElementById("navJourney");
if (navJourneyBtn) {
  navJourneyBtn.addEventListener("click", () => {
    sendMessage("Create a step-by-step learning/career roadmap for me and help me track my progress.");
    sidebarEl.classList.remove("open");
  });
}

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

const navProfileBtn = document.getElementById("navProfile");
if (navProfileBtn) {
  navProfileBtn.addEventListener("click", () => {
    openSettingsModal();
    showSettingsPanel("profile", "Profile");
    sidebarEl.classList.remove("open");
  });
}

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
  loadChatsFromServer();
  loadNotifications();
  closeAuthModal();
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

  updateDashboardGreeting();
  applyOwnerVisibility();
}

function updateDashboardGreeting() {
  const user = getStoredUser();
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user ? user.name.split(" ")[0] : null;

  const greetingEl = document.getElementById("dashGreetingText");
  if (greetingEl) {
    greetingEl.textContent = firstName ? `${timeGreeting}, ${firstName}! 👋` : `${timeGreeting}! 👋`;
  }

  const userChipEl = document.getElementById("userGreetingName");
  if (userChipEl) {
    userChipEl.textContent = user ? `Hello, ${firstName}` : "Hello, Guest";
  }
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
  // Login is required — show the auth screen and hold here until they sign in.
  openAuthModal("login");
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
const navFavoritesBtn = document.getElementById("navFavorites");
const navSupportBtn = document.getElementById("navSupport");
const navNewsBtn = document.getElementById("navNews");
const navFormGuideTvBtn = document.getElementById("navFormGuideTv");
const navPaymentsBtn = document.getElementById("navPayments");
const proBannerBtn = document.getElementById("sidebarProBanner");

function setActiveNavItem(activeBtn) {
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
  if (activeBtn) activeBtn.classList.add("active");
}

const chatModeHeader = document.getElementById("chatModeHeader");
const chatEmptyState = document.getElementById("chatEmptyState");
const topbarEl = document.querySelector(".topbar");

const GENERAL_CHAT_CHIPS = [
  { icon: "🛂", text: "How do I apply for a passport?" },
  { icon: "🆔", text: "What are the requirements for NIN?" },
  { icon: "🚗", text: "How much is a driver's licence?" },
  { icon: "🏢", text: "Where can I register my business?" },
];
const GOVERNMENT_CHAT_CHIPS = [
  { icon: "🆔", text: "What are the requirements for NIN?" },
  { icon: "🛂", text: "How do I apply for a passport?" },
  { icon: "🚗", text: "How much is a driver's licence?" },
  { icon: "🏢", text: "Where can I register my business?" },
];

function updateChatEmptyState() {
  const conv = getCurrentConversation();
  const hasMessages = conv && conv.messages && conv.messages.length > 0;
  const inChatMode = chatModeHeader && chatModeHeader.style.display !== "none";
  // Only touch this element's own visibility while we're actually on the AI
  // Chat screen. Calling this while on the Home dashboard (e.g. as part of
  // resetting Government mode) must never re-show the chat greeting there.
  if (chatEmptyState && inChatMode) chatEmptyState.style.display = hasMessages ? "none" : "block";

  const greetingEl = document.getElementById("chatEmptyGreeting");
  const subtitleEl = document.getElementById("chatEmptySubtitle");
  const chipsEl = document.getElementById("chatEmptyChips");
  const isGov = typeof currentChatMode !== "undefined" && currentChatMode === "government";

  if (greetingEl) {
    const user = getStoredUser();
    if (isGov) {
      greetingEl.textContent = user ? `Hello ${user.name}! 🏛️` : "Hello! 🏛️";
    } else {
      greetingEl.textContent = user ? `Hello ${user.name}! 👋` : "Hello! 👋";
    }
  }
  if (subtitleEl) {
    subtitleEl.textContent = isGov
      ? "Ask me anything about Nigerian government services."
      : "What can I help you with today?";
  }
  if (chipsEl) {
    const chips = isGov ? GOVERNMENT_CHAT_CHIPS : GENERAL_CHAT_CHIPS;
    chipsEl.innerHTML = "";
    if (!hasMessages) {
      chips.forEach((c) => {
        const btn = document.createElement("button");
        btn.className = "dash-chip";
        btn.textContent = `${c.icon} ${c.text}`;
        btn.addEventListener("click", () => sendMessage(c.text));
        chipsEl.appendChild(btn);
      });
    }
  }
}

function switchToDashboardMode() {
  if (topbarEl) topbarEl.style.display = "flex";
  if (chatModeHeader) chatModeHeader.style.display = "none";
  if (chatEmptyState) chatEmptyState.style.display = "none";
  welcomeScreenEl.style.display = "block";
  showSuggestions();
  messagesEl.innerHTML = "";
  if (typeof setGovernmentMode === "function") setGovernmentMode(false);
}

function switchToChatMode() {
  if (topbarEl) topbarEl.style.display = "none";
  if (chatModeHeader) chatModeHeader.style.display = "flex";
  welcomeScreenEl.style.display = "none";
  hideSuggestions();
  updateChatEmptyState();
}

if (navHomeBtn) {
  navHomeBtn.addEventListener("click", () => {
    setActiveNavItem(navHomeBtn);
    showPinnedOnly = false;
    renderSidebar();
    switchToDashboardMode();
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
    switchToChatMode();
    inputEl.focus();
    sidebarEl.classList.remove("open");
  });
}

const chatBackBtn = document.getElementById("chatBackBtn");
if (chatBackBtn) {
  chatBackBtn.addEventListener("click", () => {
    if (navHomeBtn) navHomeBtn.click();
  });
}
const chatSettingsBtn = document.getElementById("chatSettingsBtn");
if (chatSettingsBtn) {
  chatSettingsBtn.addEventListener("click", () => openSettingsModal());
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
      awardXP(20, "Set up Study Companion");
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
    awardXP(10, "Generated a study plan");
    sendMessage(
      `Please create a detailed study timetable for me. Subjects: ${subjects}. I have ${days} day${days === "1" ? "" : "s"} until my exam${hours ? `, and I can study about ${hours} hours per day` : ""}. Break it down day by day (or week by week if the timeframe is long), cover all subjects with a good balance, prioritize weaker topics if you already know them from our past conversations, and include short breaks. Keep it practical and easy to follow.`
    );
  });
}

// ---------- Notes & Flashcards ----------
// Scan (photo -> OCR via vision), upload (doc -> text extraction), or type notes
// into a scratch textarea, then turn that into a summary or a flashcard set.
const notesFlashcardsModal = document.getElementById("notesFlashcardsModal");
const closeNotesFlashcardsBtn = document.getElementById("closeNotesFlashcardsBtn");
const navNotesFlashcardsBtn = document.getElementById("navNotesFlashcards");
const notesTextarea = document.getElementById("notesTextarea");

function openNotesFlashcardsModal() {
  notesTextarea.value = "";
  notesFlashcardsModal.classList.add("open");
}

if (navNotesFlashcardsBtn) {
  navNotesFlashcardsBtn.addEventListener("click", () => {
    openNotesFlashcardsModal();
    sidebarEl.classList.remove("open");
  });
}
if (closeNotesFlashcardsBtn) {
  closeNotesFlashcardsBtn.addEventListener("click", () => notesFlashcardsModal.classList.remove("open"));
}

const notesScanBtn = document.getElementById("notesScanBtn");
const notesPhotoInput = document.getElementById("notesPhotoInput");
if (notesScanBtn && notesPhotoInput) {
  notesScanBtn.addEventListener("click", () => notesPhotoInput.click());
  notesPhotoInput.addEventListener("change", async () => {
    const file = notesPhotoInput.files[0];
    if (!file) return;
    notesPhotoInput.value = "";

    const originalPlaceholder = notesTextarea.placeholder;
    notesTextarea.disabled = true;
    notesTextarea.placeholder = "Reading your notes…";

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/chat/vision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType: file.type,
          question:
            "Please read all the handwritten or printed text in this image and transcribe it exactly as clean, typed text. Only return the transcribed text itself, with no extra commentary.",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Sorry, I couldn't read that image.");
      } else {
        const existing = notesTextarea.value.trim();
        notesTextarea.value = existing ? `${existing}\n\n${data.reply}` : data.reply;
      }
    } catch (err) {
      alert("Could not reach the server to scan this image.");
    } finally {
      notesTextarea.disabled = false;
      notesTextarea.placeholder = originalPlaceholder;
    }
  });
}

const notesUploadBtn = document.getElementById("notesUploadBtn");
const notesDocInput = document.getElementById("notesDocInput");
if (notesUploadBtn && notesDocInput) {
  notesUploadBtn.addEventListener("click", () => notesDocInput.click());
  notesDocInput.addEventListener("change", async () => {
    const file = notesDocInput.files[0];
    if (!file) return;
    notesDocInput.value = "";

    const originalPlaceholder = notesTextarea.placeholder;
    notesTextarea.disabled = true;
    notesTextarea.placeholder = "Reading your document…";

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Sorry, I couldn't read that file.");
      } else {
        const existing = notesTextarea.value.trim();
        notesTextarea.value = existing ? `${existing}\n\n${data.text}` : data.text;
      }
    } catch (err) {
      alert("Could not reach the server to process this file.");
    } finally {
      notesTextarea.disabled = false;
      notesTextarea.placeholder = originalPlaceholder;
    }
  });
}

const notesSummarizeBtn = document.getElementById("notesSummarizeBtn");
if (notesSummarizeBtn) {
  notesSummarizeBtn.addEventListener("click", () => {
    const notes = notesTextarea.value.trim();
    if (!notes) {
      alert("Please scan, upload, or type some notes first.");
      return;
    }
    notesFlashcardsModal.classList.remove("open");
    awardXP(5, "Summarized notes");
    sendMessage(
      `Please summarize the following notes clearly, breaking them into key points I can revise from quickly:\n\n${notes}`
    );
  });
}

const notesFlashcardsBtn = document.getElementById("notesFlashcardsBtn");
if (notesFlashcardsBtn) {
  notesFlashcardsBtn.addEventListener("click", () => {
    const notes = notesTextarea.value.trim();
    if (!notes) {
      alert("Please scan, upload, or type some notes first.");
      return;
    }
    notesFlashcardsModal.classList.remove("open");
    awardXP(5, "Created flashcards");
    sendMessage(
      `Please turn the following notes into a set of flashcards. Format each one clearly as "Q:" and "A:", covering the most important facts and concepts:\n\n${notes}`
    );
  });
}

// ---------- Exam Centre ----------
const examCentreModal = document.getElementById("examCentreModal");
const closeExamCentreBtn = document.getElementById("closeExamCentreBtn");
const navExamCentreBtn = document.getElementById("navExamCentre");

const examSetupView = document.getElementById("examSetupView");
const examLoadingView = document.getElementById("examLoadingView");
const examTakingView = document.getElementById("examTakingView");
const examResultsView = document.getElementById("examResultsView");

let examSelectedType = "WAEC";
let examQuestions = [];
let examAnswers = [];
let examCurrentIndex = 0;
let examTimerInterval = null;
let examSecondsLeft = 0;
let examSubjectLabel = "";

function showExamView(view) {
  [examSetupView, examLoadingView, examTakingView, examResultsView].forEach((v) => {
    v.style.display = v === view ? "block" : "none";
  });
}

function openExamCentreModal() {
  showExamView(examSetupView);
  examCentreModal.classList.add("open");
}

if (navExamCentreBtn) {
  navExamCentreBtn.addEventListener("click", () => {
    openExamCentreModal();
    sidebarEl.classList.remove("open");
  });
}
if (closeExamCentreBtn) {
  closeExamCentreBtn.addEventListener("click", () => {
    if (examTimerInterval) {
      const confirmed = confirm("Leave this exam? Your progress will be lost.");
      if (!confirmed) return;
      clearInterval(examTimerInterval);
    }
    examCentreModal.classList.remove("open");
  });
}

document.querySelectorAll(".exam-type-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".exam-type-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    examSelectedType = btn.dataset.exam;
  });
});

const examStartBtn = document.getElementById("examStartBtn");
if (examStartBtn) {
  examStartBtn.addEventListener("click", async () => {
    const subject = document.getElementById("examSubjectInput").value.trim();
    const count = document.getElementById("examCountSelect").value;

    if (!subject) {
      alert("Please enter a subject.");
      return;
    }
    if (!getToken()) {
      alert("Please log in to take a mock exam.");
      return;
    }

    showExamView(examLoadingView);

    try {
      const res = await fetch("/api/exam/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ examType: examSelectedType, subject, numQuestions: count }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not generate this exam. Please try again.");
        showExamView(examSetupView);
        return;
      }

      examQuestions = data.questions;
      examSubjectLabel = `${data.examType} ${data.subject}`;
      examAnswers = new Array(examQuestions.length).fill(null);
      examCurrentIndex = 0;
      examSecondsLeft = examQuestions.length * 72; // ~1.2 min per question

      startExamTimer();
      renderExamQuestion();
      showExamView(examTakingView);
    } catch (err) {
      alert("Could not reach the server. Please try again.");
      showExamView(examSetupView);
    }
  });
}

function startExamTimer() {
  updateExamTimerText();
  examTimerInterval = setInterval(() => {
    examSecondsLeft -= 1;
    updateExamTimerText();
    if (examSecondsLeft <= 0) {
      clearInterval(examTimerInterval);
      submitExam();
    }
  }, 1000);
}

function updateExamTimerText() {
  const mins = Math.max(0, Math.floor(examSecondsLeft / 60));
  const secs = Math.max(0, examSecondsLeft % 60);
  const el = document.getElementById("examTimerText");
  if (el) el.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
}

function renderExamQuestion() {
  const q = examQuestions[examCurrentIndex];
  document.getElementById("examProgressText").textContent = `Question ${examCurrentIndex + 1} of ${examQuestions.length}`;
  document.getElementById("examQuestionText").textContent = q.question;

  const optionsList = document.getElementById("examOptionsList");
  optionsList.innerHTML = "";
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "exam-option-btn" + (examAnswers[examCurrentIndex] === i ? " selected" : "");
    btn.textContent = `${String.fromCharCode(65 + i)}. ${opt}`;
    btn.addEventListener("click", () => {
      examAnswers[examCurrentIndex] = i;
      renderExamQuestion();
    });
    optionsList.appendChild(btn);
  });

  document.getElementById("examPrevBtn").disabled = examCurrentIndex === 0;
  document.getElementById("examNextBtn").disabled = examCurrentIndex === examQuestions.length - 1;
}

const examPrevBtn = document.getElementById("examPrevBtn");
if (examPrevBtn) {
  examPrevBtn.addEventListener("click", () => {
    if (examCurrentIndex > 0) {
      examCurrentIndex -= 1;
      renderExamQuestion();
    }
  });
}
const examNextBtn = document.getElementById("examNextBtn");
if (examNextBtn) {
  examNextBtn.addEventListener("click", () => {
    if (examCurrentIndex < examQuestions.length - 1) {
      examCurrentIndex += 1;
      renderExamQuestion();
    }
  });
}

const examSubmitBtn = document.getElementById("examSubmitBtn");
if (examSubmitBtn) {
  examSubmitBtn.addEventListener("click", () => {
    const unanswered = examAnswers.filter((a) => a === null).length;
    if (unanswered > 0) {
      const confirmed = confirm(`You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Submit anyway?`);
      if (!confirmed) return;
    }
    submitExam();
  });
}

function submitExam() {
  clearInterval(examTimerInterval);

  let correctCount = 0;
  const weakTopics = {};

  examQuestions.forEach((q, i) => {
    const isCorrect = examAnswers[i] === q.correctIndex;
    if (isCorrect) {
      correctCount += 1;
    } else if (q.topic) {
      weakTopics[q.topic] = (weakTopics[q.topic] || 0) + 1;
    }
  });

  const total = examQuestions.length;
  const percent = Math.round((correctCount / total) * 100);

  // Award XP scaled by performance (up to 20 XP), and count this as a completed exam
  awardXP(Math.round((percent / 100) * 20), `Completed ${examSubjectLabel} mock exam`, true);

  document.getElementById("examScoreText").textContent = `${correctCount}/${total}`;
  document.getElementById("examPercentText").textContent = `${percent}% — ${examSubjectLabel}`;

  const weakTopicsCard = document.getElementById("examWeakTopicsCard");
  const weakTopicsList = document.getElementById("examWeakTopicsList");
  const topicNames = Object.keys(weakTopics).sort((a, b) => weakTopics[b] - weakTopics[a]);

  if (topicNames.length > 0) {
    weakTopicsCard.style.display = "block";
    weakTopicsList.innerHTML = topicNames
      .map((t) => `<div>• ${t} (${weakTopics[t]} question${weakTopics[t] === 1 ? "" : "s"} missed)</div>`)
      .join("");
  } else {
    weakTopicsCard.style.display = "none";
  }

  const reviewList = document.getElementById("examReviewList");
  reviewList.innerHTML = "";
  examQuestions.forEach((q, i) => {
    const userAnswerIndex = examAnswers[i];
    const isCorrect = userAnswerIndex === q.correctIndex;
    const item = document.createElement("div");
    item.className = "exam-review-item " + (isCorrect ? "correct" : "incorrect");
    const userAnswerText = userAnswerIndex === null ? "No answer" : q.options[userAnswerIndex];
    item.innerHTML = `
      <div class="exam-review-q">${i + 1}. ${q.question}</div>
      <div class="exam-review-answer ${isCorrect ? "correct-text" : "incorrect-text"}">Your answer: ${userAnswerText}</div>
      ${!isCorrect ? `<div class="exam-review-answer correct-text">Correct answer: ${q.options[q.correctIndex]}</div>` : ""}
      <div class="exam-review-explanation">${q.explanation || ""}</div>
    `;
    reviewList.appendChild(item);
  });

  showExamView(examResultsView);
}

const examRevisionPlanBtn = document.getElementById("examRevisionPlanBtn");
if (examRevisionPlanBtn) {
  examRevisionPlanBtn.addEventListener("click", () => {
    const weakTopicsList = document.getElementById("examWeakTopicsList");
    const topics = Array.from(weakTopicsList.querySelectorAll("div"))
      .map((el) => el.textContent.replace(/^•\s*/, ""))
      .join(", ");

    examCentreModal.classList.remove("open");
    sendMessage(
      `Based on my recent ${examSubjectLabel} mock exam, I struggled with these topics: ${topics}. Please build me a focused revision plan targeting these weak areas first.`
    );
  });
}

const examRetakeBtn = document.getElementById("examRetakeBtn");
if (examRetakeBtn) {
  examRetakeBtn.addEventListener("click", () => {
    showExamView(examSetupView);
  });
}

// ---------- Digital Library ----------
// Generates original AI explanations, notes, and practice questions on demand.
// Deliberately does NOT store or serve real textbook pages or official past
// papers, since those are copyrighted material this app has no license to
// distribute — everything here is freshly generated per search.
const digitalLibraryModal = document.getElementById("digitalLibraryModal");
const closeDigitalLibraryBtn = document.getElementById("closeDigitalLibraryBtn");
const navDigitalLibraryBtn = document.getElementById("navDigitalLibrary");

let librarySelectedCategory = "notes";

function openDigitalLibraryModal() {
  document.getElementById("libraryQueryInput").value = "";
  digitalLibraryModal.classList.add("open");
}

if (navDigitalLibraryBtn) {
  navDigitalLibraryBtn.addEventListener("click", () => {
    openDigitalLibraryModal();
    sidebarEl.classList.remove("open");
  });
}
if (closeDigitalLibraryBtn) {
  closeDigitalLibraryBtn.addEventListener("click", () => digitalLibraryModal.classList.remove("open"));
}

document.querySelectorAll(".library-cat-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".library-cat-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    librarySelectedCategory = btn.dataset.cat;
  });
});

const librarySearchBtn = document.getElementById("librarySearchBtn");
if (librarySearchBtn) {
  librarySearchBtn.addEventListener("click", () => {
    const query = document.getElementById("libraryQueryInput").value.trim();
    if (!query) {
      alert("Please enter something to search for.");
      return;
    }

    const prompts = {
      notes: `Give me clear, well-organized study notes on "${query}" suitable for a Nigerian student, with headings and key points.`,
      explain: `Please explain "${query}" the way a good textbook chapter would — clear, step-by-step, with examples, suitable for someone learning it for the first time.`,
      pastquestions: `Generate a set of original practice questions in the style of "${query}", with answers and brief explanations. Make clear these are AI-generated practice questions, not real past exam questions.`,
      curriculum: `Summarize what is typically covered under "${query}" in the Nigerian school curriculum, including the main topics a student should know.`,
    };

    digitalLibraryModal.classList.remove("open");
    sendMessage(prompts[librarySelectedCategory] || prompts.notes);
  });
}

// ---------- Achievements / Gamification ----------
// XP is awarded server-side by awardXP(), called after real actions elsewhere
// in the app (completing an exam, setting up Study Companion, etc.) — never
// just for opening a page.
const achievementsModal = document.getElementById("achievementsModal");
const closeAchievementsBtn = document.getElementById("closeAchievementsBtn");
const navAchievementsBtn = document.getElementById("navAchievements");

const BADGE_ICON_FALLBACK = "🔒";

async function awardXP(amount, reason, examCompleted = false) {
  if (!getToken()) return null;
  try {
    const res = await fetch("/api/achievements/award", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ amount, reason, examCompleted }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    updateSidebarLevelBadge(data.level);

    if (data.newBadges && data.newBadges.length > 0) {
      const names = data.newBadges.map((b) => `${b.icon} ${b.label}`).join(", ");
      setTimeout(() => alert(`🎉 New badge unlocked: ${names}!`), 400);
    }
    return data;
  } catch (err) {
    console.error("Could not award XP:", err);
    return null;
  }
}

function updateSidebarLevelBadge(level) {
  const el = document.getElementById("achievementsLevelBadge");
  if (el && level) el.textContent = `Lv.${level}`;
}

async function loadAndSyncAchievements() {
  if (!getToken()) {
    populateDashboardStats(null);
    return;
  }
  try {
    const res = await fetch("/api/achievements", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      populateDashboardStats(null);
      return;
    }
    const data = await res.json();
    updateSidebarLevelBadge(data.level);
    populateDashboardStats(data);
  } catch (err) {
    console.error("Could not load achievements:", err);
    populateDashboardStats(null);
  }
}
loadAndSyncAchievements();

function populateDashboardStats(achievementsData) {
  const streakEl = document.getElementById("dashStatStreak");
  const xpEl = document.getElementById("dashStatXp");
  const examsEl = document.getElementById("dashStatExams");
  const chatsEl = document.getElementById("dashStatChats");
  if (!streakEl) return;

  if (achievementsData) {
    streakEl.textContent = achievementsData.streakCount ?? "—";
    xpEl.textContent = achievementsData.xp;
    examsEl.textContent = achievementsData.examsTaken;
  } else {
    streakEl.textContent = "—";
    xpEl.textContent = "—";
    examsEl.textContent = "—";
  }
  chatsEl.textContent = conversations.length;
}

function populateContinueLearning() {
  const section = document.getElementById("dashContinueSection");
  if (!section) return;

  const recent = conversations.find((c) => c.messages && c.messages.length > 0);
  if (!recent) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  document.getElementById("dashContinueTitle").textContent = recent.title || "New chat";
  const lastMsg = recent.messages[recent.messages.length - 1];
  document.getElementById("dashContinueSub").textContent = lastMsg ? lastMsg.content.slice(0, 50) : "";

  const btn = document.getElementById("dashContinueBtn");
  btn.onclick = () => {
    currentId = recent.id;
    renderSidebar();
    renderActiveConversation();
  };
}

// ---------- Home dashboard: Quick Access, chips, popular services, pro banner ----------
const dashQuickChat = document.getElementById("dashQuickChat");
if (dashQuickChat) {
  dashQuickChat.addEventListener("click", () => {
    inputEl && inputEl.focus();
    document.getElementById("dashQuickInput")?.focus();
  });
}
const dashQuickGov = document.getElementById("dashQuickGov");
if (dashQuickGov) {
  dashQuickGov.addEventListener("click", () => governmentModal.classList.add("open"));
}
const dashQuickEdu = document.getElementById("dashQuickEdu");
if (dashQuickEdu) {
  dashQuickEdu.addEventListener("click", () => educationModal.classList.add("open"));
}
const dashQuickCareer = document.getElementById("dashQuickCareer");
if (dashQuickCareer) {
  dashQuickCareer.addEventListener("click", () => careerModal.classList.add("open"));
}
const dashQuickTv = document.getElementById("dashQuickTv");
if (dashQuickTv) {
  dashQuickTv.addEventListener("click", () => alert("FormGuide TV is coming soon!"));
}
const dashQuickWallet = document.getElementById("dashQuickWallet");
if (dashQuickWallet) {
  dashQuickWallet.addEventListener("click", () => alert("Wallet & Payments is coming soon!"));
}

document.querySelectorAll(".dash-chip[data-text]").forEach((chip) => {
  chip.addEventListener("click", () => sendMessage(chip.dataset.text));
});
const dashWriteCvChip = document.getElementById("dashWriteCvChip");
if (dashWriteCvChip) {
  dashWriteCvChip.addEventListener("click", () => openCvModal());
}

document.querySelectorAll(".dash-popular-item[data-text]").forEach((item) => {
  item.addEventListener("click", () => sendMessage(item.dataset.text));
});

const dashProBanner = document.getElementById("dashProBanner");
if (dashProBanner) {
  dashProBanner.addEventListener("click", () => {
    alert("FormGuide AI Pro is coming soon!");
  });
}

// Hero search bar (type / photo / voice / send) — same underlying pipelines as
// the main chat input bar, just a second entry point on the home screen.
const dashQuickInput = document.getElementById("dashQuickInput");
const dashQuickSendBtn = document.getElementById("dashQuickSendBtn");
const dashQuickPhotoBtn = document.getElementById("dashQuickPhotoBtn");
const dashQuickMicBtn = document.getElementById("dashQuickMicBtn");

function sendFromDashInput() {
  const text = dashQuickInput.value.trim();
  if (!text) return;
  dashQuickInput.value = "";
  sendMessage(text);
}
if (dashQuickSendBtn) dashQuickSendBtn.addEventListener("click", sendFromDashInput);
if (dashQuickInput) {
  dashQuickInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendFromDashInput();
  });
}
if (dashQuickPhotoBtn) {
  dashQuickPhotoBtn.addEventListener("click", () => {
    if (photoFileInput) photoFileInput.click();
  });
}
if (dashQuickMicBtn) {
  wireVoiceNoteButton(dashQuickMicBtn);
}

const ALL_POSSIBLE_BADGES = [
  { id: "first_steps", icon: "🌱", label: "First Steps" },
  { id: "rising_star", icon: "⭐", label: "Rising Star" },
  { id: "dedicated_learner", icon: "🔥", label: "Dedicated Learner" },
  { id: "master_scholar", icon: "👑", label: "Master Scholar" },
  { id: "exam_ace", icon: "🎯", label: "Exam Ace" },
  { id: "exam_champion", icon: "🏆", label: "Exam Champion" },
];

async function openAchievementsModal() {
  const guestNotice = document.getElementById("achievementsGuestNotice");
  const content = document.getElementById("achievementsContent");
  achievementsModal.classList.add("open");

  if (!getToken()) {
    guestNotice.style.display = "block";
    content.style.display = "none";
    return;
  }

  try {
    const res = await fetch("/api/achievements", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      guestNotice.style.display = "block";
      content.style.display = "none";
      return;
    }
    const data = await res.json();
    guestNotice.style.display = "none";
    content.style.display = "block";

    document.getElementById("achievementsLevel").textContent = data.level;
    document.getElementById("achievementsXpText").textContent = `${data.xp} XP`;

    const xpIntoLevel = data.xp % 50;
    const xpNeeded = 50 - xpIntoLevel;
    document.getElementById("achievementsXpBar").style.width = `${(xpIntoLevel / 50) * 100}%`;
    document.getElementById("achievementsNextLevelText").textContent = `${xpNeeded} XP to Level ${data.level + 1}`;

    const badgesGrid = document.getElementById("achievementsBadgesGrid");
    badgesGrid.innerHTML = "";
    ALL_POSSIBLE_BADGES.forEach((badge) => {
      const unlocked = data.badges.some((b) => b.id === badge.id);
      const card = document.createElement("div");
      card.className = "studio-create-card";
      card.style.cursor = "default";
      card.style.opacity = unlocked ? "1" : "0.4";
      card.innerHTML = `
        <span class="studio-create-icon">${unlocked ? badge.icon : BADGE_ICON_FALLBACK}</span>
        <span>${badge.label}</span>
      `;
      badgesGrid.appendChild(card);
    });

    updateSidebarLevelBadge(data.level);
  } catch (err) {
    guestNotice.style.display = "block";
    content.style.display = "none";
  }
}

if (navAchievementsBtn) {
  navAchievementsBtn.addEventListener("click", () => {
    openAchievementsModal();
    sidebarEl.classList.remove("open");
  });
}
if (closeAchievementsBtn) {
  closeAchievementsBtn.addEventListener("click", () => achievementsModal.classList.remove("open"));
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
    awardXP(5, "Used Homework Helper (typed)");
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

if (navFavoritesBtn) {
  navFavoritesBtn.addEventListener("click", () => {
    alert("Favorites are coming soon!");
    sidebarEl.classList.remove("open");
  });
}
if (navSupportBtn) {
  navSupportBtn.addEventListener("click", () => {
    alert("Support is coming soon!");
    sidebarEl.classList.remove("open");
  });
}
if (navNewsBtn) {
  navNewsBtn.addEventListener("click", () => {
    alert("News is coming soon!");
    sidebarEl.classList.remove("open");
  });
}
if (navFormGuideTvBtn) {
  navFormGuideTvBtn.addEventListener("click", () => {
    alert("FormGuide TV is coming soon!");
    sidebarEl.classList.remove("open");
  });
}
if (navPaymentsBtn) {
  navPaymentsBtn.addEventListener("click", () => {
    alert("Payments is coming soon!");
    sidebarEl.classList.remove("open");
  });
}
const navWalletBtn = document.getElementById("navWallet");
if (navWalletBtn) {
  navWalletBtn.addEventListener("click", () => {
    alert("Wallet is coming soon!");
    sidebarEl.classList.remove("open");
  });
}

// ---------- Bottom navigation (mobile) ----------
function setActiveBottomNav(activeId) {
  document.querySelectorAll(".bottom-nav-item").forEach((el) => el.classList.remove("active"));
  const el = document.getElementById(activeId);
  if (el) el.classList.add("active");
}
const bottomNavHome = document.getElementById("bottomNavHome");
if (bottomNavHome) {
  bottomNavHome.addEventListener("click", () => {
    setActiveBottomNav("bottomNavHome");
    if (navHomeBtn) navHomeBtn.click();
  });
}
const bottomNavChat = document.getElementById("bottomNavChat");
if (bottomNavChat) {
  bottomNavChat.addEventListener("click", () => {
    setActiveBottomNav("bottomNavChat");
    if (navChatLinkBtn) navChatLinkBtn.click();
  });
}
const bottomNavWallet = document.getElementById("bottomNavWallet");
if (bottomNavWallet) {
  bottomNavWallet.addEventListener("click", () => {
    setActiveBottomNav("bottomNavWallet");
    alert("Wallet is coming soon!");
  });
}
const bottomNavProfile = document.getElementById("bottomNavProfile");
if (bottomNavProfile) {
  bottomNavProfile.addEventListener("click", () => {
    setActiveBottomNav("bottomNavProfile");
    if (settingsBtn) settingsBtn.click();
  });
}

const comingSoonItems = [
  { id: "navStudyTools", label: "Study Tools" },
  { id: "navSubjects", label: "Subjects" },
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
          awardXP(5, "Used Homework Helper (voice)");
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
      if (isHomeworkPhoto) awardXP(5, "Used Homework Helper (photo)");
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
async function generateImageFlow() {
  sidebarEl.classList.remove("open");
  const description = prompt("Describe the image you'd like FormGuide AI to generate:");
  if (!description || !description.trim()) return;

  switchToChatMode();
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
    updateChatEmptyState();

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
}
if (generateImageBtn) {
  generateImageBtn.addEventListener("click", generateImageFlow);
}

// --- More Tools bottom sheet -->
const moreToolsSheet = document.getElementById("moreToolsSheet");
const moreToolsBackdrop = document.getElementById("moreToolsBackdrop");

function openMoreToolsSheet() {
  moreToolsSheet.classList.add("open");
}
function closeMoreToolsSheet() {
  moreToolsSheet.classList.remove("open");
}

if (moreToolsBtn) {
  moreToolsBtn.addEventListener("click", openMoreToolsSheet);
}
if (moreToolsBackdrop) {
  moreToolsBackdrop.addEventListener("click", closeMoreToolsSheet);
}

// Chat History — dedicated full page with All/Today/Yesterday/This Week filters,
// matching the mockup. Falls back to the plain search page if the dedicated
// #chatHistoryModal markup hasn't been added to index.html yet.
const toolChatHistory = document.getElementById("toolChatHistory");
const chatHistoryModal = document.getElementById("chatHistoryModal");
let chatHistoryFilter = "all";

function getConvTimestamp(conv) {
  const ts = parseInt(String(conv.id || "").replace(/^c/, ""), 10);
  return isNaN(ts) ? 0 : ts;
}

function renderChatHistoryModal() {
  const searchBox = document.getElementById("chatHistorySearchInput");
  const search = (searchBox ? searchBox.value : "").toLowerCase();
  const list = document.getElementById("chatHistoryList");
  const empty = document.getElementById("chatHistoryEmpty");
  if (!list || !empty) return;
  list.innerHTML = "";

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const filtered = conversations.filter((conv) => {
    if (search) {
      const inTitle = (conv.title || "").toLowerCase().includes(search);
      const inMsgs = conv.messages.some((m) => m.content.toLowerCase().includes(search));
      if (!inTitle && !inMsgs) return false;
    }
    const ts = getConvTimestamp(conv);
    if (!ts) return true;
    if (chatHistoryFilter === "today") return ts >= startOfToday.getTime();
    if (chatHistoryFilter === "yesterday") return ts >= startOfYesterday.getTime() && ts < startOfToday.getTime();
    if (chatHistoryFilter === "week") return ts >= startOfWeek.getTime();
    return true;
  });

  if (filtered.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  filtered.forEach((conv) => {
    const item = document.createElement("div");
    item.className = "notif-item";
    const ts = getConvTimestamp(conv);
    const d = ts ? new Date(ts) : null;
    const sameDay = d && d.toDateString() === new Date(now).toDateString();
    const timeLabel = d ? (sameDay ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString()) : "";
    const lastMsg = conv.messages.length ? conv.messages[conv.messages.length - 1].content.slice(0, 60) : "No messages yet";
    item.innerHTML = `
      <div class="notif-icon">💬</div>
      <div class="notif-content">
        <div class="notif-title">${conv.title || "New chat"}</div>
        <div class="notif-message">${lastMsg}</div>
        <div class="notif-time">${timeLabel}</div>
      </div>
    `;
    item.addEventListener("click", () => {
      currentId = conv.id;
      renderSidebar();
      renderActiveConversation();
      switchToChatMode();
      chatHistoryModal.classList.remove("open");
    });
    list.appendChild(item);
  });
}

if (toolChatHistory) {
  toolChatHistory.addEventListener("click", () => {
    closeMoreToolsSheet();
    if (!chatHistoryModal) {
      // Dedicated page not in index.html yet — fall back to the search page.
      openSearchModal();
      return;
    }
    chatHistoryFilter = "all";
    document.querySelectorAll(".chat-history-filter").forEach((b) => b.classList.toggle("active", b.dataset.filter === "all"));
    const searchBox = document.getElementById("chatHistorySearchInput");
    if (searchBox) searchBox.value = "";
    renderChatHistoryModal();
    chatHistoryModal.classList.add("open");
  });
}

const closeChatHistoryBtn = document.getElementById("closeChatHistoryBtn");
if (closeChatHistoryBtn) {
  closeChatHistoryBtn.addEventListener("click", () => chatHistoryModal.classList.remove("open"));
}
const chatHistorySearchInput = document.getElementById("chatHistorySearchInput");
if (chatHistorySearchInput) {
  chatHistorySearchInput.addEventListener("input", renderChatHistoryModal);
}
document.querySelectorAll(".chat-history-filter").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chat-history-filter").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    chatHistoryFilter = btn.dataset.filter;
    renderChatHistoryModal();
  });
});

// Pinned Chats — dedicated slide-over listing only pinned conversations
const toolPinnedChats = document.getElementById("toolPinnedChats");
const pinnedChatsModal = document.getElementById("pinnedChatsModal");
const closePinnedChatsBtn = document.getElementById("closePinnedChatsBtn");
function renderPinnedChatsList() {
  const list = document.getElementById("pinnedChatsList");
  if (!list) return;
  const pinned = conversations.filter((c) => c.pinned);
  list.innerHTML = "";
  if (pinned.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:30px 0;font-size:12.5px;">No pinned chats yet. Tap the 📍 icon next to any chat in your history to pin it.</div>';
    return;
  }
  pinned.forEach((conv) => {
    const item = document.createElement("div");
    item.className = "notif-item";
    const lastMsg = conv.messages.length ? conv.messages[conv.messages.length - 1].content.slice(0, 60) : "No messages yet";
    item.innerHTML = `<div class="notif-icon">📌</div><div class="notif-content"><div class="notif-title">${conv.title || "New chat"}</div><div class="notif-message">${lastMsg}</div></div>`;
    item.addEventListener("click", () => {
      currentId = conv.id;
      renderSidebar();
      renderActiveConversation();
      switchToChatMode();
      pinnedChatsModal.classList.remove("open");
    });
    list.appendChild(item);
  });
}
if (toolPinnedChats) {
  toolPinnedChats.addEventListener("click", () => {
    closeMoreToolsSheet();
    renderPinnedChatsList();
    pinnedChatsModal.classList.add("open");
  });
}
if (closePinnedChatsBtn) {
  closePinnedChatsBtn.addEventListener("click", () => pinnedChatsModal.classList.remove("open"));
}

// Favorite Chats — same pattern as Pinned, using the "favorite" flag saved to the backend
const toolFavoriteChats = document.getElementById("toolFavoriteChats");
const favoriteChatsModal = document.getElementById("favoriteChatsModal");
const closeFavoriteChatsBtn = document.getElementById("closeFavoriteChatsBtn");
function renderFavoriteChatsList() {
  const list = document.getElementById("favoriteChatsList");
  if (!list) return;
  const favorites = conversations.filter((c) => c.favorite);
  list.innerHTML = "";
  if (favorites.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:30px 0;font-size:12.5px;">No favorite chats yet.</div>';
    return;
  }
  favorites.forEach((conv) => {
    const item = document.createElement("div");
    item.className = "notif-item";
    const lastMsg = conv.messages.length ? conv.messages[conv.messages.length - 1].content.slice(0, 60) : "No messages yet";
    item.innerHTML = `<div class="notif-icon">⭐</div><div class="notif-content"><div class="notif-title">${conv.title || "New chat"}</div><div class="notif-message">${lastMsg}</div></div>`;
    item.addEventListener("click", () => {
      currentId = conv.id;
      renderSidebar();
      renderActiveConversation();
      switchToChatMode();
      favoriteChatsModal.classList.remove("open");
    });
    list.appendChild(item);
  });
}
if (toolFavoriteChats) {
  toolFavoriteChats.addEventListener("click", () => {
    closeMoreToolsSheet();
    renderFavoriteChatsList();
    favoriteChatsModal.classList.add("open");
  });
}
if (closeFavoriteChatsBtn) {
  closeFavoriteChatsBtn.addEventListener("click", () => favoriteChatsModal.classList.remove("open"));
}

// AI Memory — opens Settings straight to the Memory panel
const toolAiMemory = document.getElementById("toolAiMemory");
if (toolAiMemory) {
  toolAiMemory.addEventListener("click", () => {
    closeMoreToolsSheet();
    openSettingsModal();
    showSettingsPanel("memory", "Memory Manager");
  });
}

// Read PDF — reuses the existing document upload flow
const toolReadPdf = document.getElementById("toolReadPdf");
if (toolReadPdf) {
  toolReadPdf.addEventListener("click", () => {
    closeMoreToolsSheet();
    openUploadModal();
  });
}

// Upload Image — reuses the existing photo-to-vision flow
const toolUploadImage = document.getElementById("toolUploadImage");
if (toolUploadImage) {
  toolUploadImage.addEventListener("click", () => {
    closeMoreToolsSheet();
    if (photoFileInput) photoFileInput.click();
  });
}

// Translate
const toolTranslate = document.getElementById("toolTranslate");
const translateModal = document.getElementById("translateModal");
const closeTranslateBtn = document.getElementById("closeTranslateBtn");
const translateGoBtn = document.getElementById("translateGoBtn");
if (toolTranslate) {
  toolTranslate.addEventListener("click", () => {
    closeMoreToolsSheet();
    document.getElementById("translateInput").value = "";
    translateModal.classList.add("open");
  });
}
if (closeTranslateBtn) {
  closeTranslateBtn.addEventListener("click", () => translateModal.classList.remove("open"));
}
if (translateGoBtn) {
  translateGoBtn.addEventListener("click", () => {
    const text = document.getElementById("translateInput").value.trim();
    const from = document.getElementById("translateFrom").value;
    const to = document.getElementById("translateTo").value;
    if (!text) {
      alert("Please enter some text to translate.");
      return;
    }
    translateModal.classList.remove("open");
    sendMessage(
      `Please translate the following text from ${from} to ${to}. Only give the translation, then briefly note anything culturally important if relevant:\n\n${text}`
    );
  });
}

// AI Search — reuses the existing full-page search prompt
const toolAiSearch = document.getElementById("toolAiSearch");
if (toolAiSearch) {
  toolAiSearch.addEventListener("click", () => {
    closeMoreToolsSheet();
    openAiSearchModal();
  });
}

// Generate Image — reuses the existing OpenAI image generation flow
const toolGenerateImage = document.getElementById("toolGenerateImage");
if (toolGenerateImage) {
  toolGenerateImage.addEventListener("click", () => {
    closeMoreToolsSheet();
    generateImageFlow();
  });
}

// Voice Chat — reuses the existing tap-to-talk modal
const toolVoiceChat = document.getElementById("toolVoiceChat");
if (toolVoiceChat) {
  toolVoiceChat.addEventListener("click", () => {
    closeMoreToolsSheet();
    openVoiceChatModal();
  });
}

// AI Settings — dedicated page (Model / Response Style / Tone / Language /
// Memory / Safe Search) matching the mockup. Falls back to the account
// Settings > Language panel if the dedicated #aiSettingsModal markup hasn't
// been added to index.html yet.
const AI_PREFS_KEY = "formguide_ai_prefs";
const aiSettingsModal = document.getElementById("aiSettingsModal");

function loadAiPrefs() {
  try {
    return (
      JSON.parse(localStorage.getItem(AI_PREFS_KEY)) || {
        responseStyle: "detailed",
        tone: "friendly",
        memory: true,
        safeSearch: true,
      }
    );
  } catch (e) {
    return { responseStyle: "detailed", tone: "friendly", memory: true, safeSearch: true };
  }
}
function saveAiPrefs(prefs) {
  localStorage.setItem(AI_PREFS_KEY, JSON.stringify(prefs));
}

function openAiSettingsModal() {
  const prefs = loadAiPrefs();
  const styleSel = document.getElementById("aiPrefResponseStyle");
  const toneSel = document.getElementById("aiPrefTone");
  const memToggle = document.getElementById("aiPrefMemoryToggle");
  const safeToggle = document.getElementById("aiPrefSafeSearchToggle");
  const langSub = document.getElementById("aiSettingsLangSub");

  if (styleSel) styleSel.value = prefs.responseStyle;
  if (toneSel) toneSel.value = prefs.tone;
  if (memToggle) memToggle.checked = prefs.memory;
  if (safeToggle) safeToggle.checked = prefs.safeSearch;

  if (langSub) {
    const langLabels = { auto: "Auto-detect", english: "Always English", pidgin: "Always Pidgin" };
    langSub.textContent = `${langLabels[languagePref] || "Auto-detect"} ›`;
  }

  aiSettingsModal.classList.add("open");
}

const toolAiSettings = document.getElementById("toolAiSettings");
if (toolAiSettings) {
  toolAiSettings.addEventListener("click", () => {
    closeMoreToolsSheet();
    if (!aiSettingsModal) {
      // Dedicated page not in index.html yet — fall back to account Settings.
      openSettingsModal();
      showSettingsPanel("language", "AI Settings");
      return;
    }
    openAiSettingsModal();
  });
}

const closeAiSettingsBtn = document.getElementById("closeAiSettingsBtn");
if (closeAiSettingsBtn) {
  closeAiSettingsBtn.addEventListener("click", () => aiSettingsModal.classList.remove("open"));
}

["aiPrefResponseStyle", "aiPrefTone", "aiPrefMemoryToggle", "aiPrefSafeSearchToggle"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", () => {
    saveAiPrefs({
      responseStyle: document.getElementById("aiPrefResponseStyle").value,
      tone: document.getElementById("aiPrefTone").value,
      memory: document.getElementById("aiPrefMemoryToggle").checked,
      safeSearch: document.getElementById("aiPrefSafeSearchToggle").checked,
    });
  });
});

const aiSettingsLangRow = document.getElementById("aiSettingsLangRow");
if (aiSettingsLangRow) {
  aiSettingsLangRow.addEventListener("click", () => {
    aiSettingsModal.classList.remove("open");
    openSettingsModal();
    showSettingsPanel("language", "Language");
  });
}

const aiSettingsResetBtn = document.getElementById("aiSettingsResetBtn");
if (aiSettingsResetBtn) {
  aiSettingsResetBtn.addEventListener("click", () => {
    const defaults = { responseStyle: "detailed", tone: "friendly", memory: true, safeSearch: true };
    saveAiPrefs(defaults);
    document.getElementById("aiPrefResponseStyle").value = defaults.responseStyle;
    document.getElementById("aiPrefTone").value = defaults.tone;
    document.getElementById("aiPrefMemoryToggle").checked = defaults.memory;
    document.getElementById("aiPrefSafeSearchToggle").checked = defaults.safeSearch;
  });
}


// =====================================================================
// GOVERNMENT HUB — service details + "Ask Government AI" chat mode
// =====================================================================

// ---------- Government AI chat mode (Option 1: one AI, different mode) ----------
let currentChatMode = "general";

function setGovernmentMode(on) {
  currentChatMode = on ? "government" : "general";

  const titleEl = document.getElementById("chatModeTitleText");
  const exitBtn = document.getElementById("exitGovModeBtn");
  const chatInputEl = document.getElementById("chat-input");
  const dashInputEl = document.getElementById("dashQuickInput");

  if (titleEl) titleEl.textContent = on ? "🏛️ Government AI" : "🤖 AI Chat";
  if (exitBtn) exitBtn.style.display = on ? "inline-flex" : "none";
  if (chatInputEl) chatInputEl.placeholder = on ? "Ask about any government service…" : "Ask FormGuide AI…";
  if (dashInputEl && on) dashInputEl.placeholder = "Ask about any government service…";
  if (dashInputEl && !on) dashInputEl.placeholder = "Ask FormGuide AI anything…";

  updateChatEmptyState();
}

const exitGovModeBtn = document.getElementById("exitGovModeBtn");
if (exitGovModeBtn) {
  exitGovModeBtn.addEventListener("click", () => setGovernmentMode(false));
}

// ---------- Government Hub: search filter on the service grid ----------
const govSearchInput = document.getElementById("govSearchInput");
if (govSearchInput) {
  govSearchInput.addEventListener("input", () => {
    const q = govSearchInput.value.trim().toLowerCase();
    document.querySelectorAll("#govHubGrid .dash-quick-card").forEach((card) => {
      const name = (card.querySelector("strong")?.textContent || "").toLowerCase();
      card.style.display = !q || name.includes(q) ? "" : "none";
    });
  });
}

// ---------- Government Hub: service data (Overview / Requirements / Steps) ----------
// General guidance based on how these processes typically work in Nigeria.
// Fees, office hours, and exact steps can change — the detail page and the
// AI's own replies both remind the person to confirm on the official portal.
const GOV_SERVICES = {
  nin: {
    icon: "🆔",
    name: "NIN",
    subtitle: "National Identification Number",
    overview: {
      description: "The NIN is an 11-digit number issued by NIMC to every Nigerian citizen and legal resident, used to verify identity for SIM registration, bank accounts, passports, and more.",
      who: "Nigerian citizens and legal residents",
      cost: "Free at NIMC enrollment centres",
      time: "Same day at enrollment; slip printing can take longer at busy centres",
    },
    requirements: [
      "Any valid means of identification (birth certificate, old ID, etc.) if available",
      "Proof of address if requested by the centre",
      "A working phone number to receive your NIN",
      "Your fingerprints and a photograph will be captured on-site",
    ],
    steps: [
      "Locate an NIMC enrollment centre or an accredited agent near you.",
      "Fill out the NIN enrollment form correctly with your personal details.",
      "Submit your details and undergo biometric capture (fingerprints and photo).",
      "Wait for your NIN — it's typically sent by SMS and can also be checked via the NIMC portal or USSD code.",
      "Print or save your NIN slip for future use.",
    ],
  },
  passport: {
    icon: "🛂",
    name: "Passport",
    subtitle: "Nigerian International Passport",
    overview: {
      description: "Issued by the Nigeria Immigration Service (NIS), the international passport is required for travel outside Nigeria and is available in 32 and 64-page booklets with 5 or 10-year validity.",
      who: "Nigerian citizens",
      cost: "Varies by booklet type and page count — check the official NIS portal for current fees",
      time: "Several weeks depending on demand and whether it's a new application or renewal",
    },
    requirements: [
      "Valid NIN",
      "Completed online passport application form",
      "Passport photograph meeting NIS specifications",
      "Birth certificate or age declaration",
      "Payment receipt for the passport fee",
      "For renewals: your previous passport",
    ],
    steps: [
      "Apply online through the official NIS passport portal and fill in your details.",
      "Pay the applicable fee through the approved payment channel.",
      "Book an appointment at your preferred passport office.",
      "Visit the office on your appointment date for biometric capture and document verification.",
      "Track your application status online and collect your passport when ready.",
    ],
  },
  "drivers-license": {
    icon: "🚗",
    name: "Driver's Licence",
    subtitle: "Nigerian Driver's Licence",
    overview: {
      description: "Issued through the Federal Road Safety Corps (FRSC) via the National Vehicle Identification Scheme (nVIS) portal, in partnership with state Vehicle Inspection Offices (VIOs).",
      who: "Nigerians and legal residents who are old enough to drive and have completed the required training",
      cost: "Varies by licence duration (e.g. 3-year or 5-year) — check the current nVIS fee schedule",
      time: "Can take a few weeks depending on your state and the office's backlog",
    },
    requirements: [
      "Valid NIN",
      "Completion of an approved driving school course (learner's permit)",
      "Passport photograph",
      "Age and eligibility requirements met",
      "Payment of the applicable licence fee",
    ],
    steps: [
      "Register and obtain a learner's permit after driving school training.",
      "Apply for your driver's licence through the nVIS portal or your state's VIO.",
      "Pay the required fee through the approved payment channel.",
      "Visit the VIO for biometric capture and any required practical/eye tests.",
      "Track your application and collect your licence card when it's ready.",
    ],
  },
  "voters-card": {
    icon: "🗳️",
    name: "Voter's Card (PVC)",
    subtitle: "Permanent Voter's Card",
    overview: {
      description: "Issued by INEC, the PVC allows eligible Nigerians to vote in elections. Registration happens during INEC's Continuous Voter Registration (CVR) exercise.",
      who: "Nigerian citizens aged 18 and above",
      cost: "Free",
      time: "Registration is immediate; PVC collection typically follows weeks to months later",
    },
    requirements: [
      "Must be a Nigerian citizen aged 18 or above",
      "Valid means of identification (NIN slip, national ID, driver's licence, etc.)",
      "Passport photograph (in some cases)",
      "Proof of residence in the registration area",
    ],
    steps: [
      "Check whether INEC's Continuous Voter Registration (CVR) is currently open.",
      "Register online via the INEC portal or visit a designated registration centre in person.",
      "Provide your personal details and complete biometric capture if registering physically.",
      "Wait for INEC to process your registration.",
      "Check your PVC status and collect it at your designated centre once ready.",
    ],
  },
  cac: {
    icon: "🏢",
    name: "CAC Registration",
    subtitle: "Corporate Affairs Commission — Business Registration",
    overview: {
      description: "The CAC registers business names, limited liability companies, and incorporated trustees in Nigeria, giving your business a legal identity.",
      who: "Anyone looking to formally register a business, company, or NGO in Nigeria",
      cost: "Varies by registration type (business name vs. limited company) — check the current CAC fee schedule",
      time: "Business name registration can be same-day to a few days; company registration usually takes longer",
    },
    requirements: [
      "Valid means of identification for all proprietors/directors",
      "At least two proposed business/company names for availability search",
      "Nature of business and registered address",
      "Memorandum and Articles of Association (for limited companies)",
      "Payment of the applicable CAC fee",
    ],
    steps: [
      "Search and reserve your preferred business/company name on the CAC portal.",
      "Complete the registration form with your business details.",
      "Upload the required documents and identification.",
      "Pay the registration fee through the CAC payment portal.",
      "Receive your Certificate of Registration/Incorporation once approved.",
    ],
  },
  nhia: {
    icon: "🏥",
    name: "NHIA",
    subtitle: "National Health Insurance Authority",
    overview: {
      description: "The NHIA (formerly NHIS) coordinates health insurance schemes that give enrollees access to healthcare services at accredited hospitals and clinics.",
      who: "Employees under formal-sector schemes, and increasingly individuals/families under state and informal-sector schemes",
      cost: "Varies by scheme — some are employer-funded, others are individual/family contributory plans",
      time: "Enrollment processing time varies by scheme and provider",
    },
    requirements: [
      "Valid means of identification (NIN recommended)",
      "Proof of employment (for employer-based schemes) or details of dependents (for family plans)",
      "Passport photograph",
      "Completed enrollment form for your chosen scheme",
    ],
    steps: [
      "Identify which NHIA-accredited scheme applies to you (employer-based, state, or individual/family).",
      "Register through your employer, state scheme portal, or an accredited Health Maintenance Organisation (HMO).",
      "Submit your documents and complete biometric/photo capture where required.",
      "Choose your preferred accredited hospital or clinic as your primary provider.",
      "Receive your NHIA/HMO ID card and start using your benefits.",
    ],
  },
  tax: {
    icon: "📑",
    name: "Tax",
    subtitle: "Tax Identification Number (TIN) & Filing",
    overview: {
      description: "Administered by the Federal Inland Revenue Service (FIRS) and state Internal Revenue Services, tax registration gives individuals and businesses a Tax Identification Number (TIN) used for filing and remitting taxes.",
      who: "Individuals earning taxable income and registered businesses",
      cost: "TIN registration is free; actual tax payable depends on income/business type",
      time: "TIN registration is usually quick once documents are submitted",
    },
    requirements: [
      "Valid means of identification (NIN for individuals, CAC certificate for businesses)",
      "BVN (for individuals, in many cases)",
      "Proof of address",
      "Business registration documents (for companies)",
    ],
    steps: [
      "Register for a TIN via the FIRS portal (individuals) or automatically alongside CAC registration (businesses).",
      "Verify your details and complete any required identity checks.",
      "Receive your TIN, which you'll use for tax filing and remittance.",
      "File your applicable returns (e.g. annual income tax, PAYE, or company tax) by the due dates.",
      "Keep your tax clearance certificate updated as needed.",
    ],
  },
  "birth-certificate": {
    icon: "👶",
    name: "Birth Certificate",
    subtitle: "National Population Commission (NPC)",
    overview: {
      description: "Birth registration is handled by the National Population Commission (NPC), and is important for school enrollment, passport applications, and other official processes.",
      who: "Parents/guardians registering a child's birth, or adults registering a late birth",
      cost: "Registration within 60 days is typically free; late registration may attract a fee",
      time: "Same day to a few days depending on the centre",
    },
    requirements: [
      "Hospital-issued notification of birth (if born in a hospital)",
      "Parents' means of identification",
      "Parents' marriage certificate (if applicable, in some cases)",
      "For late registration: additional supporting evidence of the birth date may be required",
    ],
    steps: [
      "Visit an NPC office or a designated registration centre.",
      "Complete the birth registration form with accurate details.",
      "Submit the hospital notification and parents' identification.",
      "Pay any applicable fee (mainly for late registration).",
      "Collect the birth certificate once processed.",
    ],
  },
  "marriage-certificate": {
    icon: "💍",
    name: "Marriage Certificate",
    subtitle: "Marriage Registry",
    overview: {
      description: "Statutory marriages in Nigeria are registered at a Marriage Registry (often under the state or the Federal Ministry of Interior), giving the union legal recognition distinct from customary or religious marriages.",
      who: "Couples intending a statutory (court/registry) marriage",
      cost: "Varies by registry — check current fees at your local registry",
      time: "A statutory notice period (commonly around 21 days) applies before the marriage can be conducted",
    },
    requirements: [
      "Valid means of identification for both parties",
      "Passport photographs",
      "Proof of age (birth certificate or age declaration)",
      "Sworn affidavit of bachelorhood/spinsterhood (where required)",
      "Witnesses present on the marriage day",
    ],
    steps: [
      "Give notice of intended marriage at your local marriage registry.",
      "Pay the applicable registry fees.",
      "Wait out the statutory notice period during which objections can be raised.",
      "Attend the registry on the scheduled date with your witnesses to conduct the marriage.",
      "Receive your marriage certificate after the ceremony is registered.",
    ],
  },
  nysc: {
    icon: "🎖️",
    name: "NYSC",
    subtitle: "National Youth Service Corps",
    overview: {
      description: "NYSC is a one-year mandatory national service programme for Nigerian graduates under 30, involving orientation camp, primary assignment, and community development service.",
      who: "Nigerian graduates of tertiary institutions, typically under 30 years old",
      cost: "Free to register; corps members receive a monthly allowance",
      time: "The full service year runs 12 months, starting with a 3-week orientation camp",
    },
    requirements: [
      "Statement of result or original certificate from your institution",
      "Valid means of identification",
      "Completed online NYSC mobilization registration",
      "Passport photograph",
    ],
    steps: [
      "Register on the NYSC portal once your institution mobilizes your set.",
      "Print your call-up letter after successful registration.",
      "Report to your assigned orientation camp on the specified date.",
      "Complete the 3-week camp activities and receive your Primary Assignment.",
      "Serve at your Place of Primary Assignment and complete community development activities until passing out.",
    ],
  },
  "student-loan": {
    icon: "🎓",
    name: "Student Loan",
    subtitle: "Nigerian Education Loan Fund (NELFUND)",
    overview: {
      description: "NELFUND provides interest-free loans to eligible Nigerian students in public tertiary institutions to cover tuition and, in some cases, upkeep, under the Student Loan Act.",
      who: "Nigerian students admitted into accredited public tertiary institutions who meet eligibility criteria",
      cost: "Interest-free — repayment begins after a set grace period post-graduation/employment",
      time: "Processing time varies once applications open each academic session",
    },
    requirements: [
      "Admission letter from an accredited public tertiary institution",
      "Valid NIN and BVN",
      "Means-testing / proof of financial need (as required)",
      "Guarantor(s) as specified by NELFUND",
      "Active bank account details",
    ],
    steps: [
      "Confirm your institution and course are eligible under the scheme.",
      "Register and apply through the official NELFUND portal.",
      "Submit your admission documents and guarantor details.",
      "Await verification and approval of your application.",
      "Once approved, funds are disbursed directly to your institution and, where applicable, to you.",
    ],
  },
  "certificate-verification": {
    icon: "📄",
    name: "Certificate Verification",
    subtitle: "WAEC / JAMB / NYSC / Institutional Verification",
    overview: {
      description: "Certificate verification confirms the authenticity of academic or service certificates (WAEC, JAMB, degree certificates, NYSC certificates) — often required by employers or foreign institutions.",
      who: "Graduates, job seekers, or anyone needing to prove a certificate is genuine",
      cost: "Varies by issuing body (WAEC, JAMB, your institution, or NYSC)",
      time: "Can range from a few days to several weeks depending on the body and verification method",
    },
    requirements: [
      "The certificate or exam number to be verified",
      "Valid means of identification",
      "Verification request letter (for institutional or foreign requests)",
      "Payment of the applicable verification fee",
    ],
    steps: [
      "Identify which body issued the certificate (WAEC, JAMB, your institution, or NYSC).",
      "Apply for verification through that body's official portal or verification office.",
      "Submit your certificate details and identification.",
      "Pay the required verification fee.",
      "Receive the verification result or confirmation letter once processed.",
    ],
  },
};

// ---------- Render the service detail page ----------
let currentServiceId = null;
let currentServiceTab = "overview";

function renderServiceDetailTab() {
  const svc = GOV_SERVICES[currentServiceId];
  if (!svc) return;
  const body = document.getElementById("serviceDetailBody");
  if (!body) return;

  if (currentServiceTab === "overview") {
    body.innerHTML = `
      <p class="gov-overview-text">${svc.overview.description}</p>
      <div class="gov-overview-row"><span class="gov-overview-icon">👤</span><div><strong>Who can apply?</strong><span>${svc.overview.who}</span></div></div>
      <div class="gov-overview-row"><span class="gov-overview-icon">💰</span><div><strong>Cost</strong><span>${svc.overview.cost}</span></div></div>
      <div class="gov-overview-row"><span class="gov-overview-icon">⏱️</span><div><strong>Processing Time</strong><span>${svc.overview.time}</span></div></div>
    `;
  } else if (currentServiceTab === "requirements") {
    body.innerHTML = `<ul class="gov-req-list">${svc.requirements
      .map((r) => `<li class="gov-req-item"><span class="gov-req-check">✔</span><span>${r}</span></li>`)
      .join("")}</ul>`;
  } else if (currentServiceTab === "steps") {
    body.innerHTML = `<ol class="gov-steps-list">${svc.steps
      .map((s, i) => `<li class="gov-step-item"><span class="gov-step-number">${i + 1}</span><span>${s}</span></li>`)
      .join("")}</ol>`;
  }
}

function openServiceDetail(id) {
  const svc = GOV_SERVICES[id];
  if (!svc) return;
  currentServiceId = id;
  currentServiceTab = "overview";

  document.getElementById("serviceDetailTitle").textContent = svc.name;
  document.getElementById("serviceDetailIcon").textContent = svc.icon;
  document.getElementById("serviceDetailName").textContent = svc.name;
  document.getElementById("serviceDetailSubtitle").textContent = svc.subtitle;

  document.querySelectorAll(".service-detail-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "overview"));
  renderServiceDetailTab();

  governmentModal.classList.remove("open");
  document.getElementById("serviceDetailModal").classList.add("open");
}

document.querySelectorAll("#govHubGrid .dash-quick-card[data-service]").forEach((card) => {
  card.addEventListener("click", () => openServiceDetail(card.dataset.service));
});

document.querySelectorAll(".service-detail-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".service-detail-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentServiceTab = tab.dataset.tab;
    renderServiceDetailTab();
  });
});

const closeServiceDetailBtn = document.getElementById("closeServiceDetailBtn");
if (closeServiceDetailBtn) {
  closeServiceDetailBtn.addEventListener("click", () => {
    document.getElementById("serviceDetailModal").classList.remove("open");
  });
}

const serviceDetailAskBtn = document.getElementById("serviceDetailAskBtn");
if (serviceDetailAskBtn) {
  serviceDetailAskBtn.addEventListener("click", () => {
    const svc = GOV_SERVICES[currentServiceId];
    if (!svc) return;
    document.getElementById("serviceDetailModal").classList.remove("open");
    setGovernmentMode(true);
    sendMessage(`I have more questions about ${svc.name} (${svc.subtitle}). Can you help?`);
  });
}

// ---------- Government Offices (honest locator: AI guidance, not a fixed fake directory) ----------
const govOfficesModal = document.getElementById("govOfficesModal");
const govOfficesCard = document.getElementById("govOfficesCard");
if (govOfficesCard) {
  govOfficesCard.addEventListener("click", () => {
    governmentModal.classList.remove("open");
    govOfficesModal.classList.add("open");
  });
}
const closeGovOfficesBtn = document.getElementById("closeGovOfficesBtn");
if (closeGovOfficesBtn) {
  closeGovOfficesBtn.addEventListener("click", () => govOfficesModal.classList.remove("open"));
}
const govOfficeFindBtn = document.getElementById("govOfficeFindBtn");
if (govOfficeFindBtn) {
  govOfficeFindBtn.addEventListener("click", () => {
    const service = document.getElementById("govOfficeServiceSelect").value;
    const location = document.getElementById("govOfficeLocationInput").value.trim();
    if (!location) {
      alert("Please enter your state or city first.");
      return;
    }
    govOfficesModal.classList.remove("open");
    setGovernmentMode(true);
    sendMessage(
      `I need to find the right government office for ${service} near ${location}, Nigeria. Please tell me which agency/office handles this, roughly where their offices tend to be in that area, and how I can confirm the exact nearest address (e.g. official portal or office locator).`
    );
  });
}

// ---------- Government Payments (deferred until Paystack integration ships) ----------
const govPaymentsCard = document.getElementById("govPaymentsCard");
if (govPaymentsCard) {
  govPaymentsCard.addEventListener("click", () => {
    alert("Government Payments is coming soon — secure in-app payments for NIN, Passport, CAC and more.");
  });
}

// ---------- Latest Government News (AI summary with an honest disclaimer) ----------
const govNewsCard = document.getElementById("govNewsCard");
if (govNewsCard) {
  govNewsCard.addEventListener("click", () => {
    governmentModal.classList.remove("open");
    setGovernmentMode(true);
    sendMessage(
      "Please share a summary of major recent Nigerian government/education announcements you're aware of (e.g. NIN, JAMB, WAEC, NYSC, passport, or tax updates). Clearly note that I should verify anything time-sensitive on the relevant official website, since your information may not be fully up to date."
    );
  });
}

// ---------- Ask Government AI (switches the SAME chat into Government mode) ----------
const askGovernmentAiCard = document.getElementById("askGovernmentAiCard");
if (askGovernmentAiCard) {
  askGovernmentAiCard.addEventListener("click", () => {
    governmentModal.classList.remove("open");
    setGovernmentMode(true);
    if (!currentId || !getCurrentConversation()) {
      if (conversations.length > 0) {
        currentId = conversations[0].id;
      } else {
        startNewChat();
      }
    }
    renderSidebar();
    renderActiveConversation();
    switchToChatMode();
    inputEl.focus();
  });
}

// =====================================================================
// EDUCATION HUB — landing page card wiring
// Reuses existing modals/functions wherever they already exist (AI Tutor,
// Digital Library, Exam Centre, Study Planner, Flashcards/Notes,
// Achievements). Everything not built yet is an honest "Coming Soon"
// alert, same pattern used elsewhere in the app (Wallet, Payments, etc.)
// rather than a fake working button.
// =====================================================================

function wireEduCard(id, action) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", action);
}

wireEduCard("eduAiTutorCard", () => {
  educationModal.classList.remove("open");
  if (typeof openStudyCompanionModal === "function") openStudyCompanionModal();
});

wireEduCard("eduDigitalLibraryCard", () => {
  educationModal.classList.remove("open");
  if (typeof openDigitalLibraryModal === "function") openDigitalLibraryModal();
});

wireEduCard("eduExamCentreCard", () => {
  educationModal.classList.remove("open");
  if (typeof openExamCentreModal === "function") openExamCentreModal();
});

wireEduCard("eduStudyPlannerCard", () => {
  educationModal.classList.remove("open");
  if (typeof openStudyPlannerModal === "function") openStudyPlannerModal();
});

wireEduCard("eduFlashcardsCard", () => {
  educationModal.classList.remove("open");
  if (typeof openNotesFlashcardsModal === "function") openNotesFlashcardsModal();
});

wireEduCard("eduNotesCard", () => {
  educationModal.classList.remove("open");
  if (typeof openNotesFlashcardsModal === "function") openNotesFlashcardsModal();
});

wireEduCard("eduAchievementsCard", () => {
  educationModal.classList.remove("open");
  if (typeof openAchievementsModal === "function") openAchievementsModal();
});

wireEduCard("eduScholarshipsCard", () => {
  educationModal.classList.remove("open");
  sendMessage("Find scholarships I can apply for.");
});

// Not built yet — honest placeholders, not fake working features
[
  ["eduAiClassroomCard", "AI Classroom"],
  ["eduSchoolDirectoryCard", "School Directory"],
  ["eduSubjectsCard", "Subjects"],
  ["eduStudentProgressCard", "Student Progress"],
  ["eduParentDashboardCard", "Parent Dashboard"],
  ["eduTeacherDashboardCard", "Teacher Dashboard"],
  ["eduScienceLabCard", "Virtual Science Lab"],
  ["eduLanguageLearningCard", "Language Learning"],
  ["eduVoiceTeacherCard", "Voice Teacher"],
  ["eduVideoLessonsCard", "Video Lessons"],
].forEach(([id, label]) => {
  wireEduCard(id, () => alert(`${label} is coming soon!`));
});
