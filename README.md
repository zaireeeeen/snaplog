# 📸 SnapLog

**OCR reader & logger — scan on your phone, work on your laptop.**

Drop, paste (⌘V), or snap any image or screenshot. SnapLog reads the text with
on-device OCR, logs every scan with a timestamp, stores the original image in
your private cloud store, and exports the whole log as an Excel sheet — or as a
ZIP with the Excel log plus every image.

## Features

- **OCR in the browser** — Tesseract.js runs on your device; images are read locally.
- **Batch uploads** — queue 25–50 images at once with live progress.
- **Paste screenshots** — ⌘V straight into the page (desktop).
- **Phone friendly** — snap a photo or pick from your library on mobile.
- **Synced log** — every scan (text + timestamp + image) is saved to a Vercel
  Blob store, so your phone and laptop see the same log.
- **Excel export** — one click downloads a timestamped `.xlsx` of the full log.
- **Log + images ZIP** — the Excel sheet plus an `images/` folder, with the
  sheet's "Stored image" column pointing at each file.
- **Editable text** — fix OCR output inline; edits save automatically.
- **Passcode gate** — a single passcode (checked server-side) protects your data.

## Stack

Static frontend (vanilla HTML/CSS/JS) + Vercel serverless functions +
[Vercel Blob](https://vercel.com/docs/storage/vercel-blob) storage.
Libraries: [Tesseract.js](https://tesseract.projectnaptha.com/),
[SheetJS](https://sheetjs.com/), [JSZip](https://stuk.github.io/jszip/).

## Deploy your own

1. Fork/clone, then `vercel` to create the project.
2. Create a Blob store and connect it to the project (adds `BLOB_READ_WRITE_TOKEN`).
3. Add a `SNAPLOG_KEY` environment variable — this is the passcode.
4. `vercel --prod`.

## Notes

- Stored copies of very large photos are downscaled (max 2200px, JPEG) to fit
  serverless upload limits; OCR always runs on the full-resolution original.
- Blob URLs are public-but-unguessable (random suffix); the log API itself
  requires the passcode.
