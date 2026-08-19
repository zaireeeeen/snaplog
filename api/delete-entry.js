import { del, list } from "@vercel/blob";
import { checkKey } from "./_auth.js";

export default async function handler(req, res) {
  if (!checkKey(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { id, imageUrl } = req.body || {};
    if (typeof id !== "string" || !/^[\w\-]{1,64}$/.test(id)) {
      return res.status(400).json({ error: "bad id" });
    }
    const { blobs } = await list({ prefix: `entries/${id}` });
    const urls = blobs.map((b) => b.url);
    if (imageUrl && typeof imageUrl === "string") urls.push(imageUrl);
    if (urls.length) await del(urls);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
