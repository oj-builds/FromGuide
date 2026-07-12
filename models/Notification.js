/* =========================================================
   notifications.js — notification bell & panel
   Depends on: utils.js (timeAgo, getToken), app.js
   ========================================================= */

const notificationsBtn = document.getElementById("notificationsBtn");
const notificationsModal = document.getElementById("notificationsModal");
const closeNotificationsBtn = document.getElementById("closeNotificationsBtn");
const markAllReadBtn = document.getElementById("markAllReadBtn");
const notifBadge = document.getElementById("notifBadge");
const notificationsList = document.getElementById("notificationsList");
const notificationsEmpty = document.getElementById("notificationsEmpty");

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
