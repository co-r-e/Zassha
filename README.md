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

## Quick Start (No build; runs as-is)

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

## Project Structure

- `src/app`: Next.js App Router (pages, layouts, API under `src/app/api`). Example: `src/app/api/explain/stream/route.ts` streams analysis.
- `src/components`: Reusable UI and feature components (e.g., `components/ui/button.tsx`, `parsed-result.tsx`).
- `src/lib`: Utilities and shared helpers (e.g., `lib/utils.ts`).
- `public`: Static assets served at the web root.
- Config: `next.config.ts`, `tsconfig.json` (path alias `@/*`), `eslint.config.mjs`.

## Tech Stack
- Next.js App Router + React 19
- TypeScript (strict)
- Tailwind CSS 4 (`src/app/globals.css`)
- Key runtime deps: `@google/genai`, `docx`, `exceljs`
- Node.js: see `.nvmrc` or `package.json#engines`

## Scripts
- `npm start` (or `npm run dev`): Start with Turbopack at `http://localhost:3000`
- `npm run lint`: Lint with Next.js + TypeScript rules
- `npm run lint:fix`: Auto‑fix lint issues
- `npm run typecheck`: TypeScript checks

## Usage Notes (Local = Production)

- This project runs locally and has no “dev/prod” split. Everything runs as-is on your machine.
- Sidebar: upload one or more videos, choose Summary/Detail, optional hint, then Analyze.
- Each analyzed file appears as a card. The Export button in the card header exports only that file.
- Filenames: `zassha_<original-name>_<YYYYMMDD>.*`.

### Large Videos
- Files ≥ 50MB: automatically switch to resumable chunk upload for reliability.
- Optional segmentation: set `ZASSHA_SEGMENT_LEN` (seconds) to split long videos on the server (requires `ffmpeg`). If unset, it falls back to single-file analysis.
- Optional tuning: `ZASSHA_CHUNK_THRESHOLD_BYTES` (default 50MB), `ZASSHA_CHUNK_SIZE_BYTES` (default 5MB).

### Health
- `GET /api/health` reports `{ ok, hasGemini, hasFfmpeg, config }` for quick diagnostics.

## Environment
- Required secret: `GEMINI_API_KEY` (set in `.env.local`).
- Optional: `ZASSHA_SEGMENT_LEN`, `ZASSHA_CHUNK_THRESHOLD_BYTES`, `ZASSHA_CHUNK_SIZE_BYTES`.
- Example:
```bash
cp .env.example .env.local
echo GEMINI_API_KEY=sk-... >> .env.local
```

## Coding Style & Conventions
- Use `@/` alias for internal imports (e.g., `@/components/ui/button`).
- Components: PascalCase; files: kebab-case (existing exceptions like `ThemeToggle.tsx` are acceptable).
- Keep diffs minimal; run `npm run lint` before PRs.

## Testing
- Not configured yet. When adding tests, prefer Vitest + React Testing Library.
- Name tests `*.test.ts(x)` and colocate near source or under `src/__tests__`.
- Keep tests fast, deterministic, and focused on behavior.

## Contributing
- Follow Conventional Commits (e.g., `feat: add upload limit`, `fix(api): handle empty file`).
- See `CONTRIBUTING.md` for workflow and PR checklist.
- See `AGENTS.md` for structure, commands, and style.
- See `CODE_OF_CONDUCT.md` for community standards.

## Security
- Do not commit secrets. Use `.env.local` locally.
- Security reports: https://co-r-e.net/contact (see SECURITY.md)

## License
MIT — see LICENSE. © 2025 CORe Inc.
