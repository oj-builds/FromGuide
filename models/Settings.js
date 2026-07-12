/* =========================================================
   settings.js — settings modal, language, theme, accent
   Depends on: utils.js, app.js
   ========================================================= */

const settingsModal = document.getElementById("settingsModal");
const settingsBtn = document.getElementById("settingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

function openSettingsModal() {
  document.querySelectorAll('input[name="language"]').forEach((radio) => {
    radio.checked = radio.value === languagePref;
  });

  const user = getStoredUser();
  document.getElementById("settingsProfileName").textContent = user ? user.name : "Guest User";
  document.getElementById("settingsProfileEmail").textContent = user ? user.email : "Not signed in";
  document.getElementById("settingsAccountEmail").textContent = user ? user.email : "—";
  document.getElementById("settingsPhoneDisplay").textContent = user && user.phone ? user.phone : "Not set";

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

  applyThemeUI();
  applyAccentUI();
  settingsModal.classList.add("open");
}
function closeSettingsModal() {
  settingsModal.classList.remove("open");
}

settingsBtn.addEventListener("click", () => {
  openSettingsModal();
  sidebarEl.classList.remove("open");
});
closeSettingsBtn.addEventListener("click", closeSettingsModal);

document.querySelectorAll(".settings-tab[data-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".settings-tab[data-tab]").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".settings-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`.settings-panel[data-panel="${tab.dataset.tab}"]`).classList.add("active");
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