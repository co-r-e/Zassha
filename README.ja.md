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

## クイックスタート（ビルド不要）

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

## 依存バージョン
- Node.js: `.nvmrc` または `package.json#engines` を参照
- 主なランタイム依存: `@google/genai`, `docx`, `exceljs`

## スクリプト
- `npm start`（または `npm run dev`）: Turbopack で起動
- `npm run lint`: ESLint
- `npm run typecheck`: TypeScript チェック

## 使い方のヒント

- サイドバーで動画をアップロードし、概要/詳細を選択、必要なら補足を入れて「解析」をクリック。
- 解析された各ファイルはカードとして表示されます。カード右上の Export から、そのカードのファイルだけを Word/Excel で出力します。
- 出力ファイル名: `zassha_<元ファイル名>_<YYYYMMDD>.*`

## コントリビュート
- ワークフローやPRチェックリストは `CONTRIBUTING.md` を参照
- リポジトリ構成とコマンドは `AGENTS.md` を参照
- 行動規範は `CODE_OF_CONDUCT.md` を参照

## セキュリティ
- シークレットはコミットしないでください。ローカルでは `.env.local` を使用
- セキュリティ連絡先: https://co-r-e.net/contact（詳細は `SECURITY.md`）

## ライセンス
MIT — `LICENSE` を参照。© 2025 CORe Inc.
