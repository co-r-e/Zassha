ZASSHA is a Next.js app for analyzing videos and producing structured, reproducible task descriptions. It supports local uploads and server-side processing (Gemini Files API).

## Quick Start

1) Install dependencies
```bash
npm ci
```

2) Configure environment
```bash
cp .env.example .env.local
# then edit .env.local to set API keys
```

3) Run the dev server
```bash
npm run dev
```
Open http://localhost:3000.

## Dependencies
- Node.js: see `.nvmrc` or `package.json#engines`.

## Scripts
- `npm run dev`: Start local dev (Turbopack)
- `npm run build`: Production build
- `npm start`: Start built app
- `npm run lint`: Lint with ESLint

## Contributing
- See CONTRIBUTING.md for workflow and PR checklist.
- See AGENTS.md for repository structure, commands, and style.
- See CODE_OF_CONDUCT.md for community standards.

## Security
- Do not commit secrets. Use `.env.local` locally.
- Security reports: https://co-r-e.net/contact (see SECURITY.md)

## License
MIT — see LICENSE.
