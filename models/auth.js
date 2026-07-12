/* =========================================================
   auth.js — login, signup, Google sign-in, forgot password
   Depends on: utils.js, app.js
   ========================================================= */

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

fetch("/api/config")
  .then((res) => res.json())
  .then((data) => {
    googleClientId = data.googleClientId;
    if (googleClientId && window.google) {
      initGoogleButton();
    }
  })
  .catch(() => {});