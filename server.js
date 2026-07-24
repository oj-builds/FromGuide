// server.js
// This is the backend. It keeps your API key secret, talks to Claude,
// and handles user accounts (signup, login, Google, settings).

require("dotenv").config();
const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { OAuth2Client } = require("google-auth-library");

const connectDB = require("./db");
const User = require("./models/User");
const Chat = require("./models/Chat");
const Memory = require("./models/Memory");
const Notification = require("./models/Notification");
const SubjectProgress = require("./models/SubjectProgress");
const StudyLog = require("./models/StudyLog");
const authenticate = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const APP_URL = process.env.APP_URL || "http://localhost:3000";

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        preferences: user.preferences,
      },
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
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        preferences: user.preferences,
      },
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
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        preferences: user.preferences,
      },
    });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(500).json({ error: "Google sign-in failed. Please try again." });
  }
});

app.get("/api/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("name email phone avatar preferences");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong." });
  }
});

app.delete("/api/user/account", authenticate, async (req, res) => {
  try {
    const userId = req.userId;

    await Promise.all([
      Chat.deleteMany({ user: userId }),
      Memory.deleteOne({ user: userId }),
      Notification.deleteMany({ user: userId }),
      User.findByIdAndDelete(userId),
    ]);

    res.json({ success: true, message: "Your account and all associated data have been deleted." });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Could not delete your account. Please try again." });
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
    ).select("name email phone avatar preferences");

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
      "name email phone avatar preferences"
    );
    res.json({ user });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Could not update profile." });
  }
});

// Theme / accent color / reply language — synced to the account instead of the browser
app.patch("/api/user/preferences", authenticate, async (req, res) => {
  try {
    const { theme, accent, language } = req.body;
    const update = {};
    if (theme) update["preferences.theme"] = theme;
    if (accent) update["preferences.accent"] = accent;
    if (language) update["preferences.language"] = language;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: update },
      { new: true }
    ).select("name email phone avatar preferences");

    res.json({ user });
  } catch (err) {
    console.error("Preferences update error:", err);
    res.status(500).json({ error: "Could not update preferences." });
  }
});

app.get("/api/config", (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID || null });
});

// ---------- VOICE NOTE TRANSCRIPTION (OpenAI Whisper — handles many languages,
// including Igbo and English, and switching between them) ----------

app.post("/api/transcribe", authenticate, upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio was received." });
    }
    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Voice notes aren't configured yet. Add OPENAI_API_KEY to your .env file.",
      });
    }

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([req.file.buffer], { type: req.file.mimetype || "audio/webm" }),
      req.file.originalname || "voice-note.webm"
    );
    formData.append("model", "whisper-1");
    // No "language" param set on purpose — lets Whisper auto-detect, since users
    // may speak Igbo, English, or switch between the two mid-sentence.

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Whisper transcription error:", data);
      return res.status(response.status).json({ error: data.error?.message || "Transcription failed." });
    }

    res.json({ text: data.text || "" });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: "Could not process this voice note. Please try again." });
  }
});

// ---------- FILE UPLOAD (PDF / DOCX text extraction) ----------

app.post("/api/upload", authenticate, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded." });
    }

    const { originalname, buffer, mimetype } = req.file;
    const ext = originalname.split(".").pop().toLowerCase();
    let text = "";

    if (ext === "pdf" || mimetype === "application/pdf") {
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else if (
      ext === "docx" ||
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (ext === "txt" || mimetype === "text/plain") {
      text = buffer.toString("utf-8");
    } else {
      return res.status(400).json({ error: "Unsupported file type for text extraction." });
    }

    text = text.trim().slice(0, 12000); // keep prompts a reasonable size

    if (!text) {
      return res.status(400).json({ error: "Could not extract any readable text from this file." });
    }

    res.json({ filename: originalname, text });
  } catch (err) {
    console.error("File upload error:", err);
    res.status(500).json({ error: "Could not process this file. Please try another." });
  }
});

// ---------- IMAGE ANALYSIS (uploaded images, using Claude's vision) ----------

app.post("/api/chat/vision", authenticate, async (req, res) => {
  try {
    const { imageBase64, mediaType, question } = req.body;

    if (!imageBase64 || !mediaType) {
      return res.status(400).json({ error: "Missing image data." });
    }
    if (!API_KEY) {
      return res.status(500).json({ error: "No API key configured on the server." });
    }

    const memory = await getUserMemory(req.userId);
    const memoryText = buildMemoryText(memory);
    let systemPrompt = SYSTEM_PROMPT;
    if (memoryText) {
      systemPrompt += `\n\nThese are things you already know about the user:\n\n${memoryText}\n\nRemember these details while chatting.`;
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
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: imageBase64 },
              },
              {
                type: "text",
                text: question || "Please look at this image and help me with it.",
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic vision API error:", data);
      return res.status(response.status).json({ error: data });
    }

    const textBlock = data.content?.find((block) => block.type === "text");
    res.json({ reply: textBlock ? textBlock.text : "No response received." });
  } catch (err) {
    console.error("Vision chat error:", err);
    res.status(500).json({ error: "Could not analyze this image." });
  }
});

// ---------- IMAGE GENERATION (OpenAI) ----------

const DAILY_IMAGE_LIMIT = 5;

function todayString() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ---------- EXAM CENTRE (mock exam question generation) ----------

const EXAM_TYPES = ["WAEC", "NECO", "JAMB", "Post-UTME", "BECE", "NABTEB"];

// ---------- ACHIEVEMENTS / GAMIFICATION ----------
// XP is only ever awarded from specific real actions in the app (completing an
// exam, setting up Study Companion, etc.) — never just for opening a page.

function computeLevel(xp) {
  return Math.floor(xp / 50) + 1;
}

function computeBadges(xp, examsTaken) {
  const badges = [];
  if (xp >= 10) badges.push({ id: "first_steps", icon: "🌱", label: "First Steps" });
  if (xp >= 50) badges.push({ id: "rising_star", icon: "⭐", label: "Rising Star" });
  if (xp >= 150) badges.push({ id: "dedicated_learner", icon: "🔥", label: "Dedicated Learner" });
  if (xp >= 300) badges.push({ id: "master_scholar", icon: "👑", label: "Master Scholar" });
  if (examsTaken >= 1) badges.push({ id: "exam_ace", icon: "🎯", label: "Exam Ace" });
  if (examsTaken >= 5) badges.push({ id: "exam_champion", icon: "🏆", label: "Exam Champion" });
  return badges;
}

app.get("/api/achievements", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("xp examsTaken");
    if (!user) return res.status(404).json({ error: "User not found." });

    res.json({
      xp: user.xp,
      level: computeLevel(user.xp),
      examsTaken: user.examsTaken,
      badges: computeBadges(user.xp, user.examsTaken),
    });
  } catch (err) {
    console.error("Load achievements error:", err);
    res.status(500).json({ error: "Could not load achievements." });
  }
});

app.post("/api/achievements/award", authenticate, async (req, res) => {
  try {
    let { amount, reason, examCompleted } = req.body;

    // Clamp to sane bounds so this endpoint can't be abused to inflate XP
    amount = Math.max(0, Math.min(parseInt(amount, 10) || 0, 50));

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const badgesBefore = computeBadges(user.xp, user.examsTaken);

    user.xp += amount;
    if (examCompleted) user.examsTaken += 1;
    await user.save();

    const badgesAfter = computeBadges(user.xp, user.examsTaken);
    const newBadges = badgesAfter.filter((b) => !badgesBefore.some((ob) => ob.id === b.id));

    res.json({
      xp: user.xp,
      level: computeLevel(user.xp),
      examsTaken: user.examsTaken,
      badges: badgesAfter,
      newBadges,
      awarded: amount,
      reason: reason || null,
    });
  } catch (err) {
    console.error("Award achievement error:", err);
    res.status(500).json({ error: "Could not update achievements." });
  }
});

app.post("/api/exam/generate", authenticate, async (req, res) => {
  try {
    const { examType, subject, numQuestions } = req.body;

    if (!examType || !EXAM_TYPES.includes(examType)) {
      return res.status(400).json({ error: "Please choose a valid exam type." });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: "Please enter a subject." });
    }
    const count = Math.min(Math.max(parseInt(numQuestions, 10) || 10, 5), 30);

    if (!API_KEY) {
      return res.status(500).json({ error: "No API key configured on the server." });
    }

    const examPrompt = `Generate ${count} multiple-choice practice questions for ${examType} ${subject.trim()}, matching the real difficulty, style and topic coverage of that exam.

Reply ONLY with a JSON array, nothing else — no markdown fences, no commentary. Each item must have this exact shape:
{"topic": "short topic name", "question": "the question text", "options": ["option A", "option B", "option C", "option D"], "correctIndex": 0, "explanation": "brief explanation of the correct answer"}

correctIndex is the 0-based index of the correct option in the "options" array. Make sure questions cover a good spread of topics within the subject, not just one topic repeated.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: examPrompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Exam generation API error:", data);
      return res.status(response.status).json({ error: "Could not generate exam questions." });
    }

    const textBlock = data.content?.find((block) => block.type === "text");
    if (!textBlock) {
      return res.status(500).json({ error: "No response received." });
    }

    let questions;
    try {
      const clean = textBlock.text.replace(/```json|```/g, "").trim();
      questions = JSON.parse(clean);
    } catch (err) {
      console.error("Exam question parse error:", err, textBlock.text);
      return res.status(500).json({ error: "Could not read the generated questions. Please try again." });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(500).json({ error: "No valid questions were generated. Please try again." });
    }

    // Basic shape validation — drop anything malformed rather than failing the whole exam
    questions = questions.filter(
      (q) =>
        q &&
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex < 4
    );

    if (questions.length === 0) {
      return res.status(500).json({ error: "No valid questions were generated. Please try again." });
    }

    res.json({ questions, examType, subject: subject.trim() });
  } catch (err) {
    console.error("Exam generation error:", err);
    res.status(500).json({ error: "Could not generate this exam. Please try again." });
  }
});

// ---------- AI TUTOR: SUBJECT PRACTICE QUIZ + REAL PROGRESS TRACKING ----------
// Same generation pattern as Exam Centre above, but scoped to an AI Tutor
// subject instead of an exam type, and the result feeds real per-subject
// percentages on the Progress page (no invented numbers).

app.post("/api/subject-quiz/generate", authenticate, async (req, res) => {
  try {
    const { subject, numQuestions } = req.body;

    if (!subject || !ALLOWED_TUTOR_SUBJECTS.includes(subject)) {
      return res.status(400).json({ error: "Please choose a valid subject." });
    }
    const count = Math.min(Math.max(parseInt(numQuestions, 10) || 5, 3), 15);

    if (!API_KEY) {
      return res.status(500).json({ error: "No API key configured on the server." });
    }

    const quizPrompt = `Generate ${count} multiple-choice practice questions for the subject "${subject}", suitable for a Nigerian secondary/tertiary student preparing for exams like WAEC/NECO/JAMB.

Reply ONLY with a JSON array, nothing else — no markdown fences, no commentary. Each item must have this exact shape:
{"question": "the question text", "options": ["option A", "option B", "option C", "option D"], "correctIndex": 0, "explanation": "brief explanation of the correct answer"}

correctIndex is the 0-based index of the correct option in the "options" array. Cover a good spread of topics within ${subject}, not just one topic repeated.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 3000,
        messages: [{ role: "user", content: quizPrompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Subject quiz generation API error:", data);
      return res.status(response.status).json({ error: "Could not generate quiz questions." });
    }

    const textBlock = data.content?.find((block) => block.type === "text");
    if (!textBlock) {
      return res.status(500).json({ error: "No response received." });
    }

    let questions;
    try {
      const clean = textBlock.text.replace(/```json|```/g, "").trim();
      questions = JSON.parse(clean);
    } catch (err) {
      console.error("Subject quiz parse error:", err, textBlock.text);
      return res.status(500).json({ error: "Could not read the generated questions. Please try again." });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(500).json({ error: "No valid questions were generated. Please try again." });
    }

    questions = questions.filter(
      (q) =>
        q &&
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex < 4
    );

    if (questions.length === 0) {
      return res.status(500).json({ error: "No valid questions were generated. Please try again." });
    }

    res.json({ questions, subject });
  } catch (err) {
    console.error("Subject quiz generation error:", err);
    res.status(500).json({ error: "Could not generate this quiz. Please try again." });
  }
});

// Save a real quiz result — cumulative per (user, subject)
app.post("/api/subject-progress/record", authenticate, async (req, res) => {
  try {
    const { subject, correct, total } = req.body;

    if (!subject || !ALLOWED_TUTOR_SUBJECTS.includes(subject)) {
      return res.status(400).json({ error: "Unknown subject." });
    }

    // Clamp to sane bounds so this endpoint can't be abused to fake a score
    const totalNum = Math.max(1, Math.min(parseInt(total, 10) || 1, 50));
    const correctNum = Math.max(0, Math.min(parseInt(correct, 10) || 0, totalNum));

    let record = await SubjectProgress.findOne({ user: req.userId, subject });
    if (!record) {
      record = new SubjectProgress({ user: req.userId, subject });
    }
    record.questionsAnswered += totalNum;
    record.questionsCorrect += correctNum;
    record.lastPracticed = new Date();
    await record.save();

    // Also log this as a real, dated event — this is what powers the
    // Study Calendar's real day-by-day activity (SubjectProgress above only
    // keeps a running total + the single latest date).
    await StudyLog.create({ user: req.userId, subject, correct: correctNum, total: totalNum });

    res.json({
      subject,
      questionsAnswered: record.questionsAnswered,
      questionsCorrect: record.questionsCorrect,
      percentage: Math.round((record.questionsCorrect / record.questionsAnswered) * 100),
    });
  } catch (err) {
    console.error("Record subject progress error:", err);
    res.status(500).json({ error: "Could not save your progress." });
  }
});

// Fetch real per-subject percentages for the Progress page
app.get("/api/subject-progress", authenticate, async (req, res) => {
  try {
    const records = await SubjectProgress.find({ user: req.userId });
    const progress = records.map((r) => ({
      subject: r.subject,
      questionsAnswered: r.questionsAnswered,
      questionsCorrect: r.questionsCorrect,
      percentage: r.questionsAnswered > 0 ? Math.round((r.questionsCorrect / r.questionsAnswered) * 100) : null,
      lastPracticed: r.lastPracticed,
    }));
    res.json({ progress });
  } catch (err) {
    console.error("Load subject progress error:", err);
    res.status(500).json({ error: "Could not load subject progress." });
  }
});

// Fetch a real month of study activity for the Study Calendar page.
// month is "YYYY-MM"; defaults to the current month if omitted.
app.get("/api/study-log", authenticate, async (req, res) => {
  try {
    const monthParam = typeof req.query.month === "string" ? req.query.month : "";
    const now = new Date();
    const [year, month] = /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam.split("-").map(Number)
      : [now.getFullYear(), now.getMonth() + 1];

    const startOfMonth = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);

    const logs = await StudyLog.find({
      user: req.userId,
      createdAt: { $gte: startOfMonth, $lt: startOfNextMonth },
    }).sort({ createdAt: 1 });

    // Group into real days, each with the real subjects studied that day
    const byDay = {};
    logs.forEach((log) => {
      const dayKey = log.createdAt.toISOString().slice(0, 10); // "YYYY-MM-DD"
      if (!byDay[dayKey]) byDay[dayKey] = [];
      byDay[dayKey].push({
        subject: log.subject,
        correct: log.correct,
        total: log.total,
      });
    });

    res.json({ year, month, days: byDay });
  } catch (err) {
    console.error("Load study log error:", err);
    res.status(500).json({ error: "Could not load your study calendar." });
  }
});

app.post("/api/generate-image", authenticate, async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Please describe the image you want." });
    }
    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Image generation isn't configured yet. Add OPENAI_API_KEY to your .env file.",
      });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const today = todayString();
    if (user.imageGenDate !== today) {
      user.imageGenDate = today;
      user.imageGenCount = 0;
    }

    if (user.imageGenCount >= DAILY_IMAGE_LIMIT) {
      return res.status(429).json({
        error: `You've reached today's limit of ${DAILY_IMAGE_LIMIT} generated images. Please try again tomorrow.`,
      });
    }

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt.trim(),
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI image generation error:", data);
      return res.status(response.status).json({ error: data.error?.message || "Image generation failed." });
    }

    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(500).json({ error: "No image was returned." });
    }

    user.imageGenCount += 1;
    await user.save();

    res.json({
      image: `data:image/png;base64,${b64}`,
      remaining: DAILY_IMAGE_LIMIT - user.imageGenCount,
    });
  } catch (err) {
    console.error("Image generation error:", err);
    res.status(500).json({ error: "Could not generate this image. Please try again." });
  }
});

// ---------- CHAT SYSTEM PROMPT ----------

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

// AI Tutor mode — same pattern as Government AI: one AI, one chat screen,
// a narrower system prompt scoped to whichever subject the person picked.
const ALLOWED_TUTOR_SUBJECTS = [
  "Mathematics", "English", "Physics", "Chemistry", "Biology", "Economics",
  "Government", "Computer Science", "Geography", "Literature", "Languages",
];

function buildSubjectSystemPrompt(subject) {
  // Only ever insert a subject name we recognize into the prompt — never
  // pass arbitrary client-supplied text straight into the system prompt.
  const safeSubject = ALLOWED_TUTOR_SUBJECTS.includes(subject) ? subject : "the requested subject";

  return `You are the AI ${safeSubject} Teacher inside FormGuide AI's AI Tutor.

You ONLY help with ${safeSubject} — explaining concepts, working through problems step by step, answering questions, and helping the student practice.

Guidelines:
- Explain clearly and patiently, the way a good teacher would — break concepts into simple steps rather than dumping a wall of text.
- When solving a problem, show your working step by step, don't just give the final answer.
- Use simple English, or Nigerian Pidgin if the user writes in Pidgin.
- Be encouraging or Nigerian students preparing for WAEC/NECO/JAMB and similar exams — relate examples to that context where it helps.
- Never invent facts, formulas, or figures you're not confident about. If unsure, say so honestly rather than guessing.
- If the user asks something unrelated to ${safeSubject} or general studying, politely say you're focused on ${safeSubject} in this mode, and suggest they switch subjects or return to the main AI Chat for that.`;
}

// Government Hub mode — same model, same endpoint, a narrower system prompt.
// This is what makes "Ask Government AI" behave like a specialist without
// standing up a second AI or a second chat system.
const GOVERNMENT_SYSTEM_PROMPT = `You are Government AI, the Government Services specialist inside FormGuide AI.

You ONLY help with Nigerian government services and official processes, including but not limited to:
- NIN (National Identification Number)
- Passport (international passport)
- Driver's Licence
- Voter's Card (PVC) / INEC registration
- CAC business registration
- NHIA (health insurance)
- Tax / TIN / FIRS matters
- Birth Certificate
- Marriage Certificate
- NYSC
- Student Loan (NELFUND)
- Certificate verification (WAEC/JAMB/NYSC/institutional)
- Government offices, government payments, and related official processes

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
- Use simple English, or Nigerian Pidgin if the user writes in Pidgin.
- Use bullet points instead of long paragraphs. Be friendly, encouraging, and concise.
- If the user asks something that has nothing to do with Nigerian government services (e.g. jokes, unrelated general knowledge, coding help), politely say you're focused on government services in this mode, and suggest they switch back to the main AI Chat for that — then still try to gently steer back to how you can help with government matters.`;

// ---------- MEMORY HELPERS ----------

async function getUserMemory(userId) {
  let memory = await Memory.findOne({ user: userId });
  if (!memory) {
    memory = await Memory.create({
      user: userId,
      memories: [],
    });
  }
  return memory;
}

async function saveMemory(userId, key, value) {
  const memory = await getUserMemory(userId);
  const existing = memory.memories.find((m) => m.key === key);

  if (existing) {
    existing.value = value;
  } else {
    memory.memories.push({ key, value });
  }

  await memory.save();
}

function buildMemoryText(memory) {
  return memory.memories.map((m) => `${m.key}: ${m.value}`).join("\n");
}

async function extractMemories(userMessage) {
  const extractionPrompt = `Extract any new personal facts about the user from this message that are worth remembering long-term (name, job, education, country, preferred language, or anything they explicitly ask you to remember).

User message: "${userMessage}"

Reply ONLY with a JSON array, nothing else. Example: [{"key": "name", "value": "David"}]
If there's nothing worth remembering, reply with: []`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 300,
      messages: [{ role: "user", content: extractionPrompt }],
    }),
  });

  const data = await response.json();
  const textBlock = data.content?.find((block) => block.type === "text");

  try {
    const clean = textBlock.text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error("Memory extraction parse error:", err);
    return [];
  }
}

// ---------- CHAT COMPLETION ROUTE ----------

app.post("/api/chat", authenticate, async (req, res) => {
  try {
    const { messages, language, mode, subject } = req.body;

    if (!API_KEY) {
      return res.status(500).json({
        error: "No API key configured on the server. Add ANTHROPIC_API_KEY to your .env file.",
      });
    }

    const memory = await getUserMemory(req.userId);
    const memoryText = buildMemoryText(memory);

    // Pick the base system prompt by mode. Everything else (memory, language)
    // layers on top exactly the same way regardless of mode.
    let systemPrompt =
      mode === "subject" && subject
        ? buildSubjectSystemPrompt(subject)
        : mode === "government"
        ? GOVERNMENT_SYSTEM_PROMPT
        : SYSTEM_PROMPT;

    if (memoryText) {
      systemPrompt += `\n\nThese are things you already know about the user:\n\n${memoryText}\n\nRemember these details while chatting.`;
    }

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

    // Fire-and-forget: pull out any new personal facts from the user's latest
    // message and save them, without delaying the chat reply above.
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage && lastUserMessage.content) {
      extractMemories(lastUserMessage.content)
        .then((facts) => {
          if (!Array.isArray(facts)) return;
          facts.forEach((fact) => {
            if (fact && fact.key && fact.value) {
              saveMemory(req.userId, String(fact.key).trim(), String(fact.value).trim()).catch((err) =>
                console.error("Could not save extracted memory:", err)
              );
            }
          });
        })
        .catch((err) => console.error("Memory extraction failed:", err));
    }
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Something went wrong on the server." });
  }
});

// ---------- MEMORY ROUTES ----------

app.get("/api/memories", authenticate, async (req, res) => {
  try {
    const memory = await getUserMemory(req.userId);
    res.json({ memories: memory.memories });
  } catch (err) {
    console.error("Load memories error:", err);
    res.status(500).json({ error: "Could not load memories." });
  }
});

app.post("/api/memories", authenticate, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || !value) {
      return res.status(400).json({ error: "Both key and value are required." });
    }

    await saveMemory(req.userId, String(key).trim(), String(value).trim());
    const memory = await getUserMemory(req.userId);
    res.json({ memories: memory.memories });
  } catch (err) {
    console.error("Add memory error:", err);
    res.status(500).json({ error: "Could not save memory." });
  }
});

app.patch("/api/memories/:key", authenticate, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value) return res.status(400).json({ error: "Value is required." });

    const memory = await getUserMemory(req.userId);
    const entry = memory.memories.find((m) => m.key === req.params.key);
    if (!entry) return res.status(404).json({ error: "Memory not found." });

    entry.value = String(value).trim();
    await memory.save();
    res.json({ memories: memory.memories });
  } catch (err) {
    console.error("Update memory error:", err);
    res.status(500).json({ error: "Could not update memory." });
  }
});

app.delete("/api/memories/:key", authenticate, async (req, res) => {
  try {
    const memory = await getUserMemory(req.userId);
    memory.memories = memory.memories.filter((m) => m.key !== req.params.key);
    await memory.save();
    res.json({ memories: memory.memories });
  } catch (err) {
    console.error("Delete memory error:", err);
    res.status(500).json({ error: "Could not delete memory." });
  }
});

// ---------- NOTIFICATION ROUTES ----------

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

// ---------- CHAT (CONVERSATION) ROUTES ----------

// Get all chats for the logged in user
app.get("/api/chats", authenticate, async (req, res) => {
  try {
    const chats = await Chat.find({ user: req.userId }).sort({ updatedAt: -1 });
    res.json(chats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load chats." });
  }
});

// Create a new chat
app.post("/api/chats", authenticate, async (req, res) => {
  try {
    const chat = await Chat.create({
      user: req.userId,
      title: "New Chat",
      messages: [],
    });
    res.json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create chat." });
  }
});

// Update chat
app.patch("/api/chats/:id", authenticate, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, user: req.userId });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found." });
    }

    if (typeof req.body.title === "string") {
      chat.title = req.body.title.trim();
    }

    if (typeof req.body.pinned === "boolean") {
      chat.pinned = req.body.pinned;
    }

    if (typeof req.body.favorite === "boolean") {
      chat.favorite = req.body.favorite;
    }

    if (req.body.messages) {
      chat.messages = req.body.messages;
    }

    await chat.save();
    res.json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update chat." });
  }
});

// Delete chat
app.delete("/api/chats/:id", authenticate, async (req, res) => {
  try {
    const result = await Chat.deleteOne({ _id: req.params.id, user: req.userId });
    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete chat." });
  }
});

// ---------- SERVER START ----------

app.listen(PORT, () => {
  console.log(`FormGuide server running at http://localhost:${PORT}`);
});
