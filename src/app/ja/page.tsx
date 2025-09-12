import type { Metadata } from "next";
export { default } from "../page";

const titleJa = "ZASSHA — 画面録画から再現可能な業務手順を自動作成";
const descJa =
  "画面録画をAIで解析し、概要・解説・再現可能な手順を自動生成。操作ごとのスクリーンショットと表で整理し、Word/Excelにエクスポート。ローカル/サーバー解析に対応。";

export const metadata: Metadata = {
  title: titleJa,
  description: descJa,
  openGraph: {
    title: titleJa,
    description: descJa,
    type: "website",
    images: [
      { url: "/ja/opengraph-image", width: 1200, height: 630, alt: titleJa },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: titleJa,
    description: descJa,
    images: [
      { url: "/ja/twitter-image", width: 1200, height: 630, alt: titleJa },
    ],
  },
};
