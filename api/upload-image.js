import { put } from "@vercel/blob";
import { checkKey } from "./_auth.js";

export default async function handler(req, res) {
  if (!checkKey(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const name = String(req.query.name || "image.png").replace(/[^\w.\-]+/g, "_").slice(0, 100);
    const type = String(req.query.type || "image/png");
    const body = req.body; // Buffer for application/octet-stream
    if (!body || !body.length) return res.status(400).json({ error: "empty body" });
    const blob = await put(`images/${name}`, body, {
      access: "public",
      contentType: type,
      addRandomSuffix: true,
    });
    res.status(200).json({ url: blob.url });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
