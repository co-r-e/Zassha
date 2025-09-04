<p align="center">
  <img src="./public/logo.svg" alt="ZASSHA" width="480" />
</p>

<p align="center">
  <b>English</b> · <a href="./README.ja.md">日本語</a>
</p>

ZASSHA is a Next.js app that analyzes screen recordings and produces structured, reproducible task descriptions. It supports local uploads and server‑side processing (Gemini Files API), and can export results to Word and Excel.

## Features

- Video analysis to structured steps (Overview, Business Inference, Business Details)
- Per‑operation screenshots (captured locally in the browser)
- Clean table view with per‑operation rows and inline thumbnails
- Export per file to Word (.docx) and Excel (.xlsx)
  - Word: visual headings, image first then text, localized (EN/JA)
  - Excel: styled header, autofilter, zebra striping, wrapped text
- Light/dark theme, EN/JA toggle

## Quick Start (No Build)

1) Install dependencies
```bash
npm install
```

2) Configure environment
```bash
cp .env.example .env.local
# then edit .env.local to set API keys
```

3) Start the app
```bash
npm start
```
Open http://localhost:3000.

## Dependencies
- Node.js: see `.nvmrc` or `package.json#engines`.
- Key runtime deps: `@google/genai`, `docx`, `exceljs`

## Scripts
- `npm start` (or `npm run dev`): Run with Turbopack
- `npm run lint`: ESLint
- `npm run typecheck`: TypeScript checks

## Usage tips

- Upload one or more videos in the sidebar, choose Summary or Detail, add an optional hint, then click Analyze.
- Each analyzed file renders as a card. The Export button is in the card header (right side) and exports only that file.
- Word/Excel filenames follow: `zassha_<original-name>_<YYYYMMDD>.*`.

## Contributing
- See CONTRIBUTING.md for workflow and PR checklist.
- See AGENTS.md for repository structure, commands, and style.
- See CODE_OF_CONDUCT.md for community standards.

## Security
- Do not commit secrets. Use `.env.local` locally.
- Security reports: https://co-r-e.net/contact (see SECURITY.md)

## License
MIT — see LICENSE. © 2025 CORe Inc.
