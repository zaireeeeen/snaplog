import { list } from "@vercel/blob";
import { checkKey } from "./_auth.js";

export default async function handler(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const all = [];
    let cursor;
    do {
      const page = await list({ prefix: "entries/", cursor, limit: 1000 });
      all.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    const entries = await Promise.all(
      all.map(async (b) => {
        try {
          const r = await fetch(b.url, { cache: "no-store" });
          return await r.json();
        } catch {
          return null;
        }
      })
    );
    const clean = entries.filter(Boolean).sort((a, b) => b.ts - a.ts);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(clean);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
