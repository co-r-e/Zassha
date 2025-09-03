# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js App Router (pages, layouts, API under `src/app/api`). Example: `src/app/api/explain/stream/route.ts` streams analysis.
- `src/components`: Reusable UI and feature components (e.g., `components/ui/button.tsx`, `parsed-result.tsx`).
- `src/lib`: Utilities and shared helpers (e.g., `lib/utils.ts`).
- `public`: Static assets served at the web root.
- Config: `next.config.ts`, `tsconfig.json` (path alias `@/*`), `eslint.config.mjs`.

## Run & Commands (No Build)
- `npm start` (or `npm run dev`): Start the app with Turbopack at `http://localhost:3000`.
- `npm run lint`: Lint with Next.js + TypeScript rules; fix issues before PRs.

## Coding Style & Naming Conventions
- Language: TypeScript (strict). React Client/Server Components with App Router.
- Styling: Tailwind CSS 4; global styles in `src/app/globals.css`.
- Indentation: 2 spaces. Keep diffs minimal and focused.
- Imports: Use `@/` alias for internal modules (e.g., `@/components/ui/button`).
- Naming: Components in PascalCase; files kebab-case (e.g., `parsed-result.tsx`). Existing exceptions like `ThemeToggle.tsx` are acceptable.
- Linting: Keep `npm run lint` clean; prefer small, cohesive changes.

## Testing Guidelines
- Framework: Not configured yet. When adding tests, prefer Vitest + React Testing Library.
- Naming: `*.test.ts` or `*.test.tsx`; colocate near source or under `src/__tests__`.
- Practice: Keep tests fast, deterministic, and focused on behavior.
- Run: `vitest` (once added). Include brief test notes in PRs.

## Commit & Pull Request Guidelines
- Commits: Use Conventional Commits (e.g., `feat: add upload limit`, `fix(api): handle empty file`).
- PRs: Provide a clear description, link issues, include screenshots for UI changes, and a short testing note.
- CI hygiene: Ensure `npm run lint` passes locally before opening/merging.

## Security & Configuration Tips
- Secrets: Store in `.env.local` (do not commit).
- Required: `GEMINI_API_KEY` only.
