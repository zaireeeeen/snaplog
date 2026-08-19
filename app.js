/* SnapLog — OCR reader & logger, synced across devices.
   OCR runs on-device (Tesseract.js). Each scan (text + timestamp + image) is
   saved to a private Vercel Blob store via the /api functions, so what you
   scan on your phone shows up on your laptop. SheetJS exports the Excel log,
   JSZip bundles log + images. */

"use strict";

// ---------- passcode / API ----------
const KEY_STORAGE = "snaplog-key";
let apiKey = localStorage.getItem(KEY_STORAGE) || "";

async function api(path, opts = {}) {
  const headers = Object.assign({ "x-snaplog-key": apiKey }, opts.headers || {});
  const res = await fetch(path, Object.assign({}, opts, { headers }));
  if (res.status === 401) {
    showGate(true);
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${path} failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

function showGate(wrongKey = false) {
  const gate = document.querySelector("#gate");
  gate.hidden = false;
  document.querySelector("#gateErr").hidden = !wrongKey;
  document.querySelector("#gateKey").focus();
}

// ---------- helpers ----------
const $ = (sel) => document.querySelector(sel);
const entriesEl = $("#entries");
const emptyEl = $("#empty");
const countEl = $("#count");
const statusEl = $("#status");
const statusText = $("#statusText");
const statusBar = $("#statusBar");

function fmtStamp(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
         `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function stampForFile(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function safeName(name) {
  return (name || "image").replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

function imageFileName(entry) {
  const ext = (entry.filename.match(/\.(png|jpe?g|webp|gif|bmp)$/i) || [".jpg"])[0];
  const base = safeName(entry.filename.replace(/\.[^.]+$/, ""));
  return `${entry.id}_${base}${ext}`;
}

function wordCount(text) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* Downscale big camera photos so uploads stay under the 4.5MB function limit.
   OCR always runs on the ORIGINAL full-res file — only the stored copy shrinks. */
async function uploadableImage(file) {
  const MAX_BYTES = 3.5 * 1024 * 1024;
  if (file.size <= MAX_BYTES) return { blob: file, type: file.type || "image/png", name: file.name };
  const bmp = await createImageBitmap(file);
  const MAX_DIM = 2200;
  const scale = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  const name = (file.name || "image").replace(/\.[^.]+$/, "") + ".jpg";
  return { blob, type: "image/jpeg", name };
}

// ---------- rendering ----------
function renderEntry(entry, { prepend = false } = {}) {
  const tpl = $("#entryTpl").content.cloneNode(true);
  const root = tpl.querySelector(".entry");
  root.dataset.id = entry.id;

  tpl.querySelector(".thumb").src = entry.imageUrl;
  tpl.querySelector(".stamp").textContent = fmtStamp(entry.ts);
  tpl.querySelector(".fname").textContent = entry.filename;
  tpl.querySelector(".conf").textContent =
    entry.confidence != null ? `confidence ${Math.round(entry.confidence)}%` : "";

  const ta = tpl.querySelector(".text");
  ta.value = entry.text;

  let saveTimer;
  ta.addEventListener("input", () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      entry.text = ta.value;
      try {
        await api("/api/save-entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
      } catch (err) {
        console.error("save failed", err);
      }
    }, 600);
  });

  tpl.querySelector(".copy").addEventListener("click", async (e) => {
    await navigator.clipboard.writeText(ta.value);
    const btn = e.currentTarget;
    btn.textContent = "Copied ✓";
    setTimeout(() => (btn.textContent = "Copy text"), 1200);
  });

  tpl.querySelector(".dl").addEventListener("click", async () => {
    try {
      const blob = await (await fetch(entry.imageUrl)).blob();
      triggerDownload(blob, imageFileName(entry));
    } catch {
      window.open(entry.imageUrl, "_blank");
    }
  });

  // two-step delete: first click arms, second click (within 3s) deletes
  const delBtn = tpl.querySelector(".del");
  delBtn.addEventListener("click", async () => {
    if (delBtn.dataset.armed) {
      delBtn.disabled = true;
      try {
        await api("/api/delete-entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: entry.id, imageUrl: entry.imageUrl }),
        });
        root.remove();
        updateCount();
      } catch (err) {
        console.error("delete failed", err);
        delBtn.disabled = false;
      }
    } else {
      delBtn.dataset.armed = "1";
      delBtn.textContent = "Sure? Click again";
      setTimeout(() => { delete delBtn.dataset.armed; delBtn.textContent = "Delete"; }, 3000);
    }
  });

  if (prepend) entriesEl.prepend(tpl);
  else entriesEl.appendChild(tpl);
  updateCount();
}

function updateCount() {
  const n = entriesEl.children.length;
  countEl.textContent = `${n} ${n === 1 ? "entry" : "entries"}`;
  emptyEl.hidden = n > 0;
}

async function loadEntries() {
  const entries = await api("/api/entries");
  entriesEl.innerHTML = "";
  for (const e of entries) renderEntry(e);
  updateCount();
  return entries;
}

// ---------- OCR queue (built for 25–50 image batches) ----------
let worker = null;
let workerLoading = null;
const queue = [];
let processing = false;
let batchTotal = 0;
let batchDone = 0;

async function getWorker() {
  if (worker) return worker;
  if (!workerLoading) {
    setStatus("Warming up the OCR engine (first run downloads the language model)…", 0);
    workerLoading = Tesseract.createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text" && batchTotal) {
          const base = batchDone / batchTotal;
          setBar((base + m.progress / batchTotal) * 100);
        }
      },
    }).then((w) => { worker = w; return w; });
  }
  return workerLoading;
}

function setStatus(text, pct) {
  statusEl.hidden = false;
  statusText.textContent = text;
  if (pct != null) setBar(pct);
}

function setBar(pct) {
  statusBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
}

function hideStatus() {
  statusEl.hidden = true;
  setBar(0);
}

function enqueueFiles(files) {
  const images = [...files].filter((f) => f.type.startsWith("image/"));
  if (!images.length) return;
  const wasIdle = !processing;
  if (wasIdle) { batchTotal = 0; batchDone = 0; }
  batchTotal += images.length;
  for (const f of images) queue.push(f);
  if (wasIdle) processQueue();
}

async function processQueue() {
  processing = true;
  let failed = 0;
  try {
    const w = await getWorker();
    while (queue.length) {
      const file = queue.shift();
      const label = file.name || "pasted image";
      setStatus(`Reading ${batchDone + 1} of ${batchTotal} — ${label}`, (batchDone / batchTotal) * 100);
      try {
        const ts = Date.now();
        const { data } = await w.recognize(file);

        setStatus(`Saving ${batchDone + 1} of ${batchTotal} — ${label}`);
        const up = await uploadableImage(file);
        const filename = up.name || `screenshot-${stampForFile(ts)}.jpg`;
        const img = await api(
          `/api/upload-image?name=${encodeURIComponent(filename)}&type=${encodeURIComponent(up.type)}`,
          { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: up.blob }
        );

        const entry = {
          id: `${ts}-${Math.random().toString(36).slice(2, 7)}`,
          ts,
          filename,
          text: (data.text || "").trim(),
          confidence: data.confidence,
          imageUrl: img.url,
        };
        await api("/api/save-entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        renderEntry(entry, { prepend: true });
      } catch (err) {
        console.error("Failed for", label, err);
        failed++;
      }
      batchDone++;
      setBar((batchDone / batchTotal) * 100);
    }
    const ok = batchDone - failed;
    setStatus(
      failed
        ? `Done — ${ok} logged, ${failed} failed (see console).`
        : `Done — ${ok} image${ok === 1 ? "" : "s"} read and logged.`,
      100
    );
    setTimeout(hideStatus, 3000);
  } catch (err) {
    console.error(err);
    setStatus("OCR engine failed to load. Check your connection and reload.", 0);
  } finally {
    processing = false;
    batchTotal = 0;
    batchDone = 0;
  }
}

// ---------- exports ----------
function buildSheet(entries) {
  const rows = [[
    "#", "Timestamp", "File name", "Stored image", "Words", "Characters", "Confidence (%)", "Extracted text",
  ]];
  const chrono = [...entries].sort((a, b) => a.ts - b.ts); // chronological log
  chrono.forEach((e, i) => {
    rows.push([
      i + 1,
      fmtStamp(e.ts),
      e.filename,
      `images/${imageFileName(e)}`,
      wordCount(e.text),
      e.text.length,
      e.confidence != null ? Math.round(e.confidence) : "",
      e.text,
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 4 }, { wch: 20 }, { wch: 28 }, { wch: 38 },
    { wch: 7 }, { wch: 11 }, { wch: 14 }, { wch: 90 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SnapLog");
  return wb;
}

async function exportXlsx() {
  const entries = await api("/api/entries");
  if (!entries.length) { flashButton($("#exportXlsx"), "Log is empty"); return; }
  XLSX.writeFile(buildSheet(entries), `snaplog-${stampForFile(Date.now())}.xlsx`);
}

async function exportZip() {
  const btn = $("#exportZip");
  const entries = await api("/api/entries");
  if (!entries.length) { flashButton(btn, "Log is empty"); return; }
  btn.disabled = true;
  btn.textContent = "Packing…";
  try {
    const zip = new JSZip();
    const xlsxData = XLSX.write(buildSheet(entries), { type: "array", bookType: "xlsx" });
    zip.file("snaplog.xlsx", xlsxData);
    const imgs = zip.folder("images");
    for (const e of entries) {
      try {
        const blob = await (await fetch(e.imageUrl)).blob();
        imgs.file(imageFileName(e), blob);
      } catch (err) {
        console.error("could not fetch image for", e.filename, err);
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(blob, `snaplog-${stampForFile(Date.now())}.zip`);
  } finally {
    btn.disabled = false;
    btn.textContent = "🗂 Log + images (ZIP)";
  }
}

function flashButton(btn, msg) {
  const orig = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => (btn.textContent = orig), 1400);
}

// ---------- wiring ----------
const dropzone = $("#dropzone");
const fileInput = $("#fileInput");

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") fileInput.click();
});
$("#browseBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});
fileInput.addEventListener("change", () => {
  enqueueFiles(fileInput.files);
  fileInput.value = "";
});

["dragenter", "dragover"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag");
  })
);
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag");
  })
);
dropzone.addEventListener("drop", (e) => enqueueFiles(e.dataTransfer.files));

document.addEventListener("paste", (e) => {
  const files = [...(e.clipboardData?.items || [])]
    .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
    .map((it) => it.getAsFile())
    .filter(Boolean);
  if (files.length) enqueueFiles(files);
});

$("#refresh").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try { await loadEntries(); } catch (err) { console.error(err); }
  btn.disabled = false;
});
$("#exportXlsx").addEventListener("click", () => exportXlsx().catch(console.error));
$("#exportZip").addEventListener("click", () => exportZip().catch(console.error));

// two-step clear-all, same non-blocking pattern as per-entry delete
const clearBtn = $("#clearAll");
clearBtn.addEventListener("click", async () => {
  if (clearBtn.dataset.armed) {
    clearBtn.disabled = true;
    try {
      await api("/api/clear-all", { method: "POST" });
      entriesEl.innerHTML = "";
      updateCount();
    } catch (err) {
      console.error("clear failed", err);
    }
    clearBtn.disabled = false;
    clearBtn.textContent = "🗑 Clear all";
    delete clearBtn.dataset.armed;
  } else {
    clearBtn.dataset.armed = "1";
    clearBtn.textContent = "Deletes everything — click again";
    setTimeout(() => { delete clearBtn.dataset.armed; clearBtn.textContent = "🗑 Clear all"; }, 3500);
  }
});

// ---------- passcode gate ----------
$("#gateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  apiKey = $("#gateKey").value.trim();
  try {
    await loadEntries();
    localStorage.setItem(KEY_STORAGE, apiKey);
    $("#gate").hidden = true;
    $("#gateErr").hidden = true;
  } catch {
    $("#gateErr").hidden = false;
  }
});

// ---------- boot ----------
(async function boot() {
  updateCount();
  if (!apiKey) { showGate(); return; }
  try {
    await loadEntries();
  } catch (err) {
    // 401 already opened the gate; anything else, log it
    if (err.message !== "unauthorized") console.error("Failed to load log:", err);
  }
})();
