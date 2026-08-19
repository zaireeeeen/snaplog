import { del, list } from "@vercel/blob";
import { checkKey } from "./_auth.js";

export default async function handler(req, res) {
  if (!checkKey(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    let cursor;
    let deleted = 0;
    do {
      const page = await list({ cursor, limit: 1000 });
      const urls = page.blobs.map((b) => b.url);
      if (urls.length) {
        await del(urls);
        deleted += urls.length;
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    res.status(200).json({ ok: true, deleted });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
