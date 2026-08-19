import { put } from "@vercel/blob";
import { checkKey } from "./_auth.js";

export default async function handler(req, res) {
  if (!checkKey(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const e = req.body;
    if (!e || typeof e.id !== "string" || !/^[\w\-]{1,64}$/.test(e.id)) {
      return res.status(400).json({ error: "bad entry" });
    }
    const entry = {
      id: e.id,
      ts: Number(e.ts) || Date.now(),
      filename: String(e.filename || "image.png").slice(0, 200),
      text: String(e.text ?? ""),
      confidence: e.confidence == null ? null : Number(e.confidence),
      imageUrl: String(e.imageUrl || ""),
    };
    await put(`entries/${entry.id}.json`, JSON.stringify(entry), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    res.status(200).json({ ok: true, entry });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
