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
const SYSTEM_PROMPT = `You are a patient, plain-spoken assistant that helps Nigerians fill out government forms
(NIN enrollment, international passport, JAMB registration, WAEC result checker, voter's card, etc).

Rules you must follow:
- Explain each field or step simply, in short numbered steps.
- List the documents required for the process being discussed.
- Flag common mistakes that cause rejection or delay.
- If the user seems to prefer Pidgin, switch to Pidgin.
- Never invent fees, office addresses, or requirements you are not confident about.
  If unsure, say so plainly and point them to the official source to confirm.
- Keep answers concise. Use short paragraphs or numbered lists, not long essays.`;

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
