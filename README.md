<p align="center">
  <img src="./public/logo.svg" alt="ZASSHA" width="480" />
</p>

<p align="center">
  <b>English</b> · <a href="./README.ja.md">日本語</a>
</p>

ZASSHA turns your screen recordings into clear, reproducible steps you can share. Upload a video, click Analyze, and export to Word, PowerPoint, or Excel.

— This README focuses on everyday use. A short developer note is at the end.

## Quick Start (5 minutes)

1) Install dependencies
```bash
npm install
```

2) Set your API key
```bash
cp .env.example .env.local
# open .env.local and set GEMINI_API_KEY=...
```

3) Start ZASSHA
```bash
npm start
```
Then open http://localhost:3000 in your browser.

## How To Use

1) Add videos
- Drag & drop files into the left sidebar, or click the upload area and pick `video/*` files.

2) Choose analysis mode
- Summary: short, concise output (500–800 chars).
- Detail: full step‑by‑step output with timestamps and tools.

3) (Optional) Add a hint
- Write a short sentence about the task or goal (e.g., “Change Slack notification settings”). This improves accuracy.

4) Click Analyze
- Progress appears per file. Large files (≥ 50 MB) upload in resumable chunks automatically.

5) Review the result
- Overview: short description of the video.
- Business Inference: what the operator is trying to check/confirm.
- Business Details: a table of steps and operations. Each operation shows a thumbnail; hover to preview the clip, click to open a larger player.

6) Export your document
- Click Export on the file’s card and choose:
  - Word (.docx): headings + text with screenshots.
  - PowerPoint (.pptx): one slide per operation. Screenshot + caption on the slide; details (Used Tool / Timestamp / Inference) in slide Notes.
  - Excel (.xlsx): rows with No., Step, Inference, Used Tool, Timestamp, Operation.
- Filenames are like `zassha_<original>_<YYYYMMDD>.*`.

7) Switch language and theme
- Footer: EN/JA toggle; light/dark theme toggle.

## Tips For Better Results
- Keep the recording focused on the task; avoid rapid app switching.
- Record at 1080p+ if possible; UI text becomes easier to recognize.
- Enter a hint when the goal isn’t obvious from the video alone.

## Troubleshooting
- “API key is not configured”
  - Edit `.env.local` and set `GEMINI_API_KEY`, then restart `npm start`.
- Large file stalls
  - Resumable upload is automatic. For very long videos, server‑side segmentation can help (requires `ffmpeg`; see “Advanced”).
- No thumbnails or previews
  - Ensure the video can play in your browser. Some codecs may not preview; export will still work.
- PowerPoint fonts look different
  - ZASSHA asks for “Yu Gothic UI”. If unavailable, PowerPoint uses a fallback font.

## Privacy
- Your video is processed via Google’s Gemini Files API. If server‑side segmentation is enabled, the server temporarily splits the video before uploading segments to Gemini. Captured screenshots are generated in your browser for export files.

## System Requirements
- A modern browser (Chrome/Edge/Firefox/Safari).
- Node.js 18+ (see `.nvmrc`).
- Optional for very long videos: `ffmpeg` on the server to enable segmentation.

---

## For Advanced Users / Developers

- Start/stop
  - `npm start` (or `npm run dev`) — runs at `http://localhost:3000`.
- Lint/typecheck
  - `npm run lint`, `npm run typecheck`.
- Folders
  - `src/features/analysis` — parsed result, export menu, segment player
  - `src/features/upload` — sidebar uploader
  - `src/components` — UI primitives and contexts
  - `src/lib` — parsing/export utilities
- Optional segmentation
  - Set `ZASSHA_SEGMENT_LEN` (seconds) in `.env.local`. Requires `ffmpeg` in PATH. If unset, the app analyzes the whole video without splitting.

License: MIT — see LICENSE. © 2025 CORe Inc.
