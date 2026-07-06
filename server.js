// server.js
// This is the backend. It keeps your API key secret, talks to Claude,
// and now handles user accounts (Phase 1: signup and login).

require("dotenv").config();
const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const connectDB = require("./db");
const User = require("./models/User");
const authenticate = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Connect to the database when the server starts
connectDB();

// ---------- AUTH ROUTES ----------

// Create a new account
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

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "30d" });

    res.json({ token, user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Something went wrong creating your account." });
  }
});

// Log in to an existing account
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

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(400).json({ error: "Incorrect password." });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "30d" });

    res.json({ token, user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong logging you in." });
  }
});

// Get the currently logged-in user's info (used to check if a saved token is still valid)
app.get("/api/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("name email");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong." });
  }
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
        error:
          "No API key configured on the server. Add ANTHROPIC_API_KEY to your .env file.",
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

app.listen(PORT, () => {
  console.log(`FormGuide server running at http://localhost:${PORT}`);
});
