<p align="center">
  <img src="./public/logo.svg" alt="ZASSHA" width="480" />
</p>

<p align="center">
  <a href="./README.md">English</a> · <b>日本語</b>
</p>

ZASSHA は、画面録画を解析して再現可能な業務手順（構造化テキスト）を生成する Next.js アプリです。ローカルアップロード（ブラウザ内）でスクリーンショットを自動取得し、Gemini Files API を用いてサーバー側解析を行います。結果は Word / Excel にエクスポートできます。

## 特長

- 動画 → 構造化された手順（概要・業務推察・業務詳細）
- 操作ごとのスクリーンショット（ブラウザ内で自動キャプチャ）
- 操作単位の表レイアウト＋サムネイル表示
- ファイル単位のエクスポート（カード右上の Export ボタン）
  - Word: 見出しはビジュアル表示、画像→テキストの順、日本語/英語に対応
  - Excel: ヘッダー固定・オートフィルタ・ゼブラ・折返しなど軽量な書式
- ライト/ダークテーマ、日本語/英語切替

## クイックスタート（ビルド不要・そのまま動作）

1) 依存関係をインストール
```bash
npm install
```

2) 環境変数を設定
```bash
cp .env.example .env.local
# .env.local を編集して API キーを設定
```

3) アプリを起動
```bash
npm start
```
ブラウザで http://localhost:3000 を開きます。

## プロジェクト構成

- `src/app`: Next.js App Router（ページ/レイアウト、API は `src/app/api` 配下）。例: `src/app/api/explain/stream/route.ts` がストリーミング解析。
- `src/components`: 再利用 UI / 機能コンポーネント（例: `components/ui/button.tsx`, `parsed-result.tsx`）。
- `src/lib`: 汎用ユーティリティ（例: `lib/utils.ts`）。
- `public`: 静的アセット。
- 設定: `next.config.ts`, `tsconfig.json`（パスエイリアス `@/*`）, `eslint.config.mjs`。

## 技術スタック
- Next.js App Router + React 19
- TypeScript（strict）
- Tailwind CSS 4（`src/app/globals.css`）
- 主なランタイム依存: `@google/genai`, `docx`, `exceljs`
- Node.js バージョンは `.nvmrc` または `package.json#engines` を参照

## スクリプト
- `npm start`（または `npm run dev`）: Turbopack で `http://localhost:3000` に起動
- `npm run lint`: Next.js + TypeScript ルールで Lint
- `npm run lint:fix`: Lint の自動修正
- `npm run typecheck`: TypeScript チェック

## 使い方のヒント

- サイドバーで動画をアップロードし、概要/詳細を選択、必要なら補足を入れて「解析」をクリック。
- 解析された各ファイルはカードとして表示されます。カード右上の Export から、そのカードのファイルだけを Word/Excel で出力します。
- 出力ファイル名: `zassha_<元ファイル名>_<YYYYMMDD>.*`

### 大きな動画
- 50MB 以上のファイルは信頼性のため自動的に「分割アップロード（チャンク）」へ切り替えます。
- サーバー側での動画分割（セグメント化）: `ZASSHA_SEGMENT_LEN`（秒）を設定すると有効化（`ffmpeg` が必要）。未設定の場合は単一ファイルで解析します。
- 調整用の任意変数: `ZASSHA_CHUNK_THRESHOLD_BYTES`（既定 50MB）, `ZASSHA_CHUNK_SIZE_BYTES`（既定 5MB）。

### ヘルスチェック
- `GET /api/health` が `{ ok, hasGemini, hasFfmpeg, config }` を返し、動作確認に利用できます。

## 環境変数
- 必須: `GEMINI_API_KEY`（`.env.local` に設定）。
- 任意: `NEXT_PUBLIC_SITE_URL`（OG/Twitter の絶対URLの基点）, `ZASSHA_SEGMENT_LEN`, `ZASSHA_CHUNK_THRESHOLD_BYTES`, `ZASSHA_CHUNK_SIZE_BYTES`。
```bash
cp .env.example .env.local
echo GEMINI_API_KEY=sk-... >> .env.local
# echo NEXT_PUBLIC_SITE_URL=https://zassha.example.com >> .env.local
```

## コーディング規約・慣習
- 内部インポートは `@/` エイリアスを使用（例: `@/components/ui/button`）。
- コンポーネントはパスカルケース、ファイルはケバブケース（`ThemeToggle.tsx` のような既存例外は許容）。
- 変更は最小限に。PR 前に `npm run lint` を実行。

## コントリビュート
- Conventional Commits に従ってください（例: `feat: add upload limit`, `fix(api): handle empty file`）。
- ワークフローや PR チェックリストは `CONTRIBUTING.md` を参照。
- 構成・コマンド・スタイルは `AGENTS.md` を参照。
- 行動規範は `CODE_OF_CONDUCT.md` を参照。

## テスト
- まだ未設定です。導入する場合は Vitest + React Testing Library を推奨。
- テストファイル名は `*.test.ts(x)`。ソース近傍または `src/__tests__` に配置。
- 高速・決定的・振る舞い重視で記述してください。

## セキュリティ
- シークレットはコミットしないでください。ローカルでは `.env.local` を使用
- セキュリティ連絡先: https://co-r-e.net/contact（詳細は `SECURITY.md`）

## ライセンス
MIT — `LICENSE` を参照。© 2025 CORe Inc.
