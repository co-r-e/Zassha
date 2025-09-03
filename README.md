<p align="center">
  <img src="./public/logo.svg" alt="ZASSHA" width="480" />
</p>

<p align="center">
  <b>English</b> · <a href="./README.ja.md">日本語</a>
</p>

ZASSHA is a Next.js app for analyzing videos and producing structured, reproducible task descriptions. It supports local uploads and server-side processing (Gemini Files API).

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

## Scripts
- `npm start` (or `npm run dev`): Run the app with Turbopack
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
