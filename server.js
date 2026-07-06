// server.js
// This is the backend. It keeps your API key secret and talks to Claude on behalf of your frontend.

require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// This is the "brain" instructions for your app.
// Edit this text any time to change how your assistant behaves.
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
    const { messages } = req.body;

    if (!API_KEY) {
      return res.status(500).json({
        error:
          "No API key configured on the server. Add ANTHROPIC_API_KEY to your .env file.",
      });
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
        system: SYSTEM_PROMPT,
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
