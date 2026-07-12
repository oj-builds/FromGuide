// server.js
// This is the backend. It keeps your API key secret, talks to Claude,
// and handles user accounts (signup, login, Google, settings).

require("dotenv").config();
const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const connectDB = require("./db");
const User = require("./models/User");
const Chat = require("./models/Chat");
const Notification = require("./models/Notification");
const authenticate = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const APP_URL = process.env.APP_URL || "http://localhost:3000";

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

app.use(express.json({ limit: "5mb" })); // raised so avatar base64 uploads don't get rejected
app.use(express.static(path.join(__dirname, "public")));

connectDB();

// ---------- AUTH ROUTES ----------

app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Please fill in all fields." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });
    await Notification.create({
  user: user._id,
  title: "Welcome to FormGuide AI 🎉",
  message: "Your account has been created. Explore CV building, interview coaching, and more.",
  type: "system",
});

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "30d" });

    res.json({
      token,
      user: { name: user.name, email: user.email, phone: user.phone, avatar: user.avatar },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Something went wrong creating your account." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Please enter your email and password." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: "No account found with this email." });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        error: "This account uses Google Sign-In. Please continue with Google instead.",
      });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(400).json({ error: "Incorrect password." });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "30d" });

    res.json({
      token,
      user: { name: user.name, email: user.email, phone: user.phone, avatar: user.avatar },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong logging you in." });
  }
});

app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Please enter your email." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.json({
        message: "If an account exists with this email, a reset link has been sent.",
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetTokenHash = tokenHash;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetLink = `${APP_URL}/reset.html?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

    if (!RESEND_API_KEY) {
      console.log("⚠️ RESEND_API_KEY not set. Reset link (for testing):", resetLink);
      return res.json({
        message: "If an account exists with this email, a reset link has been sent.",
      });
    }

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "FormGuide AI <onboarding@resend.dev>",
        to: user.email,
        subject: "Reset your FormGuide AI password",
        html: `<p>Hi ${user.name},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
      }),
    });

    res.json({ message: "If an account exists with this email, a reset link has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

app.post("/api/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: "Missing information." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.resetTokenHash || !user.resetTokenExpiry) {
      return res.status(400).json({ error: "Invalid or expired reset link." });
    }
    if (user.resetTokenExpiry < new Date()) {
      return res.status(400).json({ error: "This reset link has expired. Please request a new one." });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    if (tokenHash !== user.resetTokenHash) {
      return res.status(400).json({ error: "Invalid or expired reset link." });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetTokenHash = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ message: "Password updated. You can now log in with your new password." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

app.post("/api/auth/google", async (req, res) => {
  try {
    if (!googleClient) {
      return res.status(500).json({ error: "Google Sign-In isn't configured on the server yet." });
    }

    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: "Missing Google credential." });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    let user = await User.findOne({ email: payload.email.toLowerCase() });

    if (!user) {
      user = await User.create({
        name: payload.name || payload.email.split("@")[0],
        email: payload.email,
        googleId: payload.sub,
      });
    } else if (!user.googleId) {
      user.googleId = payload.sub;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({
      token,
      user: { name: user.name, email: user.email, phone: user.phone, avatar: user.avatar },
    });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(500).json({ error: "Google sign-in failed. Please try again." });
  }
});

app.get("/api/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("name email phone avatar");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong." });
  }
});

app.patch("/api/user/phone", authenticate, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number is required." });

    const user = await User.findByIdAndUpdate(
      req.userId,
      { phone },
      { new: true }
    ).select("name email phone avatar");

    res.json({ user });
  } catch (err) {
    console.error("Phone update error:", err);
    res.status(500).json({ error: "Could not update phone number." });
  }
});

app.patch("/api/user/password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Both current and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    if (!user.passwordHash) {
      return res.status(400).json({
        error: "This account uses Google Sign-In and has no password to change.",
      });
    }

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    console.error("Password change error:", err);
    res.status(500).json({ error: "Could not update password." });
  }
});

app.patch("/api/user/profile", authenticate, async (req, res) => {
  try {
    const { avatar, name } = req.body;
    const update = {};
    if (avatar) update.avatar = avatar;
    if (name) update.name = name;

    const user = await User.findByIdAndUpdate(req.userId, update, { new: true }).select(
      "name email phone avatar"
    );
    res.json({ user });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Could not update profile." });
  }
});

app.get("/api/config", (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID || null });
});

// ---------- CHAT ROUTE ----------

const SYSTEM_PROMPT = `You are FormGuide AI, Nigeria's trusted AI assistant for government services, careers, education and official documents.

Your mission is to save users time and reduce confusion.

Always answer using this format whenever it makes sense:

📋 Service
(Name of the service)

📝 Overview
(Short explanation)

✅ Requirements
- List all required documents.

🪜 Steps
1. First step
2. Second step
3. Third step

💰 Cost
Only provide official costs if you are confident.
If you are not certain, clearly say the user should verify on the official website.

⏳ Processing Time
Provide an estimate only if reliable.

⚠️ Common Mistakes
- Mistake 1
- Mistake 2

💡 Helpful Tips
Give practical advice that saves the user time.

➡️ Next Step
Tell the user exactly what to do next.

Rules you must follow:
- Never invent information, fees, office addresses, or requirements you are not confident about. If unsure, say "I'm not certain. Please verify on the official government website."
- Use simple English.
- If the user writes in Nigerian Pidgin, reply in Pidgin.
- Use bullet points instead of long paragraphs.
- Be friendly and encouraging.
- Keep answers concise — avoid long essays.
- EXCEPTION: If the user is doing a mock interview practice session, do NOT use the structured format above. Instead, act as a real interviewer: ask one question at a time, wait for their answer, then give brief constructive feedback (2-3 sentences) before asking the next question. Keep it conversational, not a form.`;

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, language } = req.body;

    if (!API_KEY) {
      return res.status(500).json({
        error: "No API key configured on the server. Add ANTHROPIC_API_KEY to your .env file.",
      });
    }

    let systemPrompt = SYSTEM_PROMPT;
    if (language === "pidgin") {
      systemPrompt += "\n\nThe user has set their preference to always reply in Nigerian Pidgin, regardless of what language they type in.";
    } else if (language === "english") {
      systemPrompt += "\n\nThe user has set their preference to always reply in English, even if they write in Pidgin.";
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", data);
      return res.status(response.status).json({ error: data });
    }

    const textBlock = data.content?.find((block) => block.type === "text");
    res.json({ reply: textBlock ? textBlock.text : "No response received." });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Something went wrong on the server." });
  }
});

app.get("/api/notifications", authenticate, async (req, res) => {
  const notifications = await Notification.find({ user: req.userId }).sort({ createdAt: -1 });
  res.json({ notifications });
});

app.patch("/api/notifications/:id/read", authenticate, async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.userId },
    { read: true },
    { new: true }
  );
  if (!notification) return res.status(404).json({ error: "Notification not found" });
  res.json({ notification });
});

app.patch("/api/notifications/read-all", authenticate, async (req, res) => {
  await Notification.updateMany({ user: req.userId, read: false }, { read: true });
  res.json({ success: true });
});

// ===============================
// CHAT ROUTES
// ===============================

// Get all chats for the logged in user
app.get("/api/chats", authenticate, async (req, res) => {
  try {
    const chats = await Chat.find({
      user: req.userId,
    }).sort({ updatedAt: -1 });

    res.json(chats);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Could not load chats."
    });
  }
});

// Create a new chat
app.post("/api/chats", authenticate, async (req, res) => {
  try {
    const chat = await Chat.create({
      user: req.userId,
      title: "New Chat",
      messages: []
    });

    res.json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Could not create chat."
    });
  }
});

// Update chat
app.patch("/api/chats/:id", authenticate, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!chat) {
      return res.status(404).json({
        error: "Chat not found."
      });
    }

    if (req.body.title) {
      chat.title = req.body.title;
    }

    if (req.body.messages) {
      chat.messages = req.body.messages;
    }

    await chat.save();

    res.json(chat);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Could not update chat."
    });
  }
});

app.delete("/api/chats/:id", authenticate, async (req, res) => {
  console.log("DELETE REQUEST:", req.params.id);

  try {
    const result = await Chat.deleteOne({
      _id: req.params.id,
      user: req.userId
    });

    console.log(result);

    res.json({
      success: true,
      result
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Could not delete chat."
    });
  }
});

app.listen(PORT, () => {
  console.log(`FormGuide server running at http://localhost:${PORT}`);
});
