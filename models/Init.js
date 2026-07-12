/* =========================================================
   init.js — startup sequence
   Load this LAST, after every other <script> tag.
   Calls functions defined across chat.js, settings.js,
   auth.js, and notifications.js, so it can only run once
   they've all been parsed.
   ========================================================= */

setTheme(localStorage.getItem(THEME_KEY) || "light");
setAccent(localStorage.getItem(ACCENT_KEY) || "default");
updateAccountButton();

if (conversations.length === 0) {
  startNewChat();
} else {
  currentId = conversations[0].id;
  renderSidebar();
  renderActiveConversation();
}

if (getToken()) loadNotifications();