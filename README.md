# SnapLog

**Scan it on your phone. Work with it on your laptop.**

SnapLog reads your screenshots, pulls out the details that matter (emails, names, roles, salaries, phone numbers), keeps every scan in a timestamped log, and hands you the whole thing as an Excel sheet.

I built it in a day because my camera roll was where important details went to die. 122 screenshots of job posts, saved "for later." Zero of them ever opened again. This fixed that.

## What it does

- Drop, paste, or snap any image. Batches of 25 to 50 at a time work fine.
- Reads the text with AI vision (Gemini's free tier) and extracts the structured bits: email, role, company, location, salary, phone, how to apply.
- Every scan is logged with a timestamp and synced through your own private cloud store, so what you capture on your phone is waiting on your laptop.
- One click exports the full log as Excel. Another packs the log plus every stored image into a ZIP.
- A passcode you choose keeps the log yours.
- No Gemini key? It falls back to on-device OCR (Tesseract). Rougher output, still free, nothing breaks.

## Who it's for

- **Job seekers.** A week of we're-hiring screenshots becomes one sheet of roles, salaries, and recruiter emails you can actually work through. Nothing expires unread.
- **Real estate agents.** Listings from portals and WhatsApp groups land in one sheet with prices, locations, and numbers. A Saturday of browsing becomes a Monday call list.
- **Event and wedding planners.** Vendor quotes arrive as screenshots. Each gets filed with a timestamp, the numbers and phone numbers pulled out. Comparing twelve florists no longer means three apps.
- **Students and researchers.** Lecture slides and library shots become searchable text with dates attached. "I know I saved that somewhere" becomes a citation.
- **Small traders.** Supplier price lists and invoices move through WhatsApp as images. They land in a running log with amounts and contacts extracted. Month-end starts from a sheet, not a camera roll.

## Deploy your own

Your copy runs on your own free accounts. Your screenshots never touch anyone else's server, including mine.

1. Fork or clone this repo, then create a project on [Vercel](https://vercel.com) (free) and import it.
2. In the project, add a **Blob store** (Storage tab → Create → Blob). This is where your images and log live.
3. Get a free Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). No card needed.
4. Add two environment variables:

| Variable | What it is |
|---|---|
| `SNAPLOG_KEY` | A passcode you invent. Gates your log. |
| `GEMINI_API_KEY` | Your free Gemini key. Powers the smart reading. |

5. Deploy. Open the URL on your phone and laptop, enter your passcode once per device, done.

Optional: `GEMINI_MODEL` overrides the default model (`gemini-3.6-flash`).

## Limitations, honestly

- Google's free tier means Google may use what you send to improve its products. Fine for job posts. Do not feed it private chats or anything with passwords in frame.
- Free tier caps at roughly 250 to 1,500 images a day and the app paces itself to stay under the per-minute limit, so a 120-image batch takes about 10 minutes.
- The passcode is a shared secret, not real authentication. It keeps strangers out. It is not built for teams or sensitive data.
- Stored copies of very large photos are downscaled to fit upload limits. Extraction quality is unaffected.
- Phone uploads need the screen to stay awake until the batch finishes.
- Status: personal tool, shared as-is. Use it, fork it, make it yours.

## Built with

Static HTML/CSS/JS, Vercel serverless functions, Vercel Blob, Gemini vision, Tesseract.js fallback, SheetJS for the Excel export, JSZip for the archive. Built with AI pair-programming (Claude Code). I directed the architecture and the product decisions; the AI wrote fast and argued back occasionally.

## Who made this

[Ankita Biswas](https://www.linkedin.com/in/ankita-biswass), brand strategist in Dubai. This is the algorithm half of Art Meets Algorithm. If your camera roll looks like mine did, say hi.

MIT licensed.
