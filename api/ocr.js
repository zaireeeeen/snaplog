import { checkKey } from "./_auth.js";

const PROMPT = `Transcribe and extract data from this phone screenshot (often a job post from Instagram/LinkedIn).
Return ONLY a JSON object, no markdown:
{
 "text": "complete accurate transcription of all meaningful text (skip the phone status bar and UI chrome like like/comment counts)",
 "is_job_post": true/false,
 "platform": "instagram"|"linkedin"|"whatsapp"|"other",
 "role": "job title or null",
 "company": "company or page name, or null",
 "location": "or null",
 "salary": "or null",
 "email": "EXACT email address visible in the image or null - transcribe character-perfect, never guess",
 "phone": "or null",
 "link": "application URL or handle, or null",
 "apply": "how the post says to apply, or null"
}`;

export default async function handler(req, res) {
  if (!checkKey(req, res)) return;
  const key = (process.env.GEMINI_API_KEY || "").trim();
  const model = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();

  if (req.method === "GET") {
    return res.status(200).json({ configured: !!key, model: key ? model : null });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "GET or POST only" });
  if (!key) return res.status(501).json({ configured: false, error: "GEMINI_API_KEY not set" });

  try {
    const type = String(req.query.type || "image/jpeg");
    const body = req.body; // Buffer for application/octet-stream
    if (!body || !body.length) return res.status(400).json({ error: "empty body" });

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: type, data: body.toString("base64") } },
              { text: PROMPT },
            ],
          }],
          generationConfig: { response_mime_type: "application/json", temperature: 0 },
        }),
      }
    );
    if (r.status === 429) return res.status(429).json({ error: "rate limited" });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      return res.status(502).json({ error: `gemini ${r.status}: ${detail}` });
    }
    const j = await r.json();
    const raw = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { text: raw };
    }
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
