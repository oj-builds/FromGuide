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
