# FormGuide

An AI assistant that helps people fill Nigerian government forms (NIN, passport,
JAMB, WAEC result checker, and more). Built with a simple Node.js backend and a
plain HTML/CSS/JS frontend — no build tools needed.

## 1. Get an API key

1. Go to https://console.anthropic.com and sign up.
2. Create an API key.
3. Add a small amount of credit (a few dollars covers a lot of testing).

## 2. Run it on your own computer

You need Node.js installed (v18 or newer): https://nodejs.org

```bash
# 1. Install dependencies
npm install

# 2. Set up your API key
cp .env.example .env
# then open .env and paste your real key in place of "your_key_here"

# 3. Start the app
npm start
```

Open http://localhost:3000 in your browser. Try it.

## 3. Project structure

```
form-helper-app/
  server.js        <- backend: talks to Claude, keeps your API key private
  package.json      <- lists dependencies
  .env              <- your secret API key (never share or upload this file)
  public/
    index.html      <- the page structure
    style.css       <- the look and feel
    app.js          <- the chat logic (sending/receiving messages)
```

## 4. How to expand it (step by step, as you grow)

- **Add more form types**: edit the `SYSTEM_PROMPT` text in `server.js` — that's
  where you tell the AI how to behave. Add details about new forms there.
- **Add Pidgin toggle**: add a button in `index.html` that tells the assistant
  to reply in Pidgin (already supported in the prompt).
- **Save chat history per user**: later, add a database (like SQLite or
  Supabase) to remember conversations across visits.
- **Add file upload**: let people upload a photo of a form and have Claude
  explain fields directly from the image — this uses Claude's image support.

Small, one-feature-at-a-time additions are the right pace. Ship, test with real
people, then add the next thing.

## 5. Deploy it online (so anyone can use it)

The easiest option: **Render** (has a free tier, one Node.js app, no separate
frontend hosting needed since this server serves both).

1. Push this project to a GitHub repository.
2. Go to https://render.com, sign up, click "New Web Service."
3. Connect your GitHub repo.
4. Set:
   - Build command: `npm install`
   - Start command: `npm start`
5. Under "Environment," add `ANTHROPIC_API_KEY` with your real key as the value.
   (Never put your key directly in your code or GitHub repo.)
6. Deploy. Render gives you a live URL — that's your app, online, shareable.

## 6. Before sharing widely

- Test with 5–10 real people first (classmates, family, a WhatsApp group).
- Watch what confuses them, and fix that before adding new features.
- Keep an eye on your Anthropic usage/billing dashboard as more people use it.
