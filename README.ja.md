<p align="center">
  <img src="./public/logo.svg" alt="ZASSHA" width="480" />
</p>

<p align="center">
  <a href="./README.md">English</a> · <b>日本語</b>
</p>

ZASSHA は、動画を解析して再現可能な業務手順（構造化テキスト）を生成する Next.js アプリです。ローカルアップロードに対応し、サーバー側では Gemini Files API を用いて処理します。

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

## スクリプト
- `npm start`（または `npm run dev`）: Turbopack で起動
- `npm run lint`: ESLint で検査

## コントリビュート
- ワークフローやPRチェックリストは `CONTRIBUTING.md` を参照
- リポジトリ構成とコマンドは `AGENTS.md` を参照
- 行動規範は `CODE_OF_CONDUCT.md` を参照

## セキュリティ
- シークレットはコミットしないでください。ローカルでは `.env.local` を使用
- セキュリティ連絡先: https://co-r-e.net/contact（詳細は `SECURITY.md`）

## ライセンス
MIT — `LICENSE` を参照
