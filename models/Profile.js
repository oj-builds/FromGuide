/* =========================================================
   profile.js — avatar, phone, password, account deletion
   Depends on: utils.js, app.js, auth.js (setSession)
   ========================================================= */

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