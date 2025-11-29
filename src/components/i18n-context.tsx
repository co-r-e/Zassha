"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type Lang = "en" | "ja";

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: <K extends keyof typeof en>(
    key: K,
    ...args: typeof en[K] extends (...args: infer P) => unknown ? P : []
  ) => string;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

const LS_KEY = "zassha.lang";

const en = {
  // SidebarUploader
  dropOrClick: "Drag & drop videos, or click",
  select: "Select",
  delete: "Delete",
  summary: "Summary",
  detail: "Detail",
  hintLabel: "Hint (optional)",
  hintPlaceholder: "e.g., A video changing Slack notifications",
  errorPrefix: "Error",
  apiKeyMissing: "API key is not configured. Set GEMINI_API_KEY in .env.local and restart.",
  analyze: "Analyze",
  analyzeHint: "Please upload videos",
  preview: "Preview",
  showAfterUpload: "It will appear here after upload.",
  // ParsedResult
  unrecognizedFormat: "Could not recognize the parsed text format. Showing raw text.",
  overview: "Overview",
  noOverview: "No overview",
  businessInference: "Business Inference",
  noInference: "No inference",
  tokenUsage: "Token Usage",
  input: "Input",
  output: "Output",
  total: "Total",
  duration: "Duration",
  businessDetails: "Business Details",
  stepName: "Step Name",
  usedTool: "Used Tool",
  operations: "Operations",
  stepInference: "Step Inference",
  screenshot: "Screenshot",
  operationVideo: "Operation Video",
  capturing: "Capturing…",
  captureFailed: "Failed",
  view: "View",
  close: "Close",
  openInNewTab: "Open in new tab",
  noVideo: "No video",
  expand: "Expand",
  collapseHint: "Click to collapse",
  expandHint: "Click to expand",
  unknown: "Unknown",
  operationsCount: (n: number) => `${n} operations (click to expand)`,
  expandAll: "Expand All",
  collapseAll: "Collapse All",
  // Page
  analysisResult: "Analysis Result",
  willShowAfterAnalysis: "It will appear here after analysis.",
  landingLead: "Generate reproducible procedures from your screen recordings. Upload a video from the left sidebar and click Analyze to get started.",
  introLead: "Turn screen recordings into clean, reproducible steps. Upload a video on the left, then click Analyze.",
  introAnalyzeTitle: "Analyze",
  introAnalyzeDesc: "Summary or Detail mode. ZASSHA infers intent, tools, and operations in order.",
  introPreviewTitle: "Preview",
  introPreviewDesc: "Per‑operation timeline with inline video previews and precise durations.",
  introExportTitle: "Export",
  introExportDesc: "One‑click export to Word and Excel per file, ready to share.",
  introHint: "Upload videos from the left sidebar and start your first analysis.",
  // Success page
  processingDone: "Processing completed",
  goHome: "Home",
  inProgressPrefix: "In progress",
  queuedMessage: "Running analysis. Please wait…",
  timeout: "Timed out. Please check again later.",
  fetchError: "Failed to fetch results.",
  downloadWord: "Download Word",
  downloadPptx: "Download PowerPoint",
  downloadExcel: "Download Excel",
  downloadYaml: "Download YAML",
  export: "Export",
  errorOccurred: "An error occurred.",
  // Contact
  contactTitle: "Contact",
  contactDescription: "Send requests or bug reports here (form coming soon).",
  // Theme toggle
  themeToggleAria: "Toggle theme",
  // UploadContext errors
  noSelectionError: "No targets selected for analysis",
  genericError: "Processing failed",
} as const;

const ja = {
  // SidebarUploader
  dropOrClick: "動画をドラッグ＆ドロップ、またはクリック",
  select: "選択",
  delete: "削除",
  summary: "概要",
  detail: "詳細",
  hintLabel: "補足（任意）",
  hintPlaceholder: "例: Slackの通知設定を変更している動画",
  errorPrefix: "エラー",
  apiKeyMissing: "APIキーが設定されていません。.env.local に GEMINI_API_KEY を設定し、アプリを再起動してください。",
  analyze: "解析",
  analyzeHint: "動画をアップロードしてください",
  preview: "プレビュー",
  showAfterUpload: "アップロード後にここに表示されます。",
  // ParsedResult
  unrecognizedFormat: "解析テキストの形式を認識できませんでした。元のテキストを表示します。",
  overview: "概要",
  noOverview: "概要情報なし",
  businessInference: "解説",
  noInference: "解説情報なし",
  tokenUsage: "トークン使用量",
  input: "入力",
  output: "出力",
  total: "合計",
  duration: "所要時間",
  businessDetails: "業務詳細",
  stepName: "ステップ名",
  usedTool: "使用ツール",
  operations: "操作詳細",
  stepInference: "解説",
  screenshot: "スクリーンショット",
  operationVideo: "操作動画",
  capturing: "生成中…",
  captureFailed: "失敗",
  view: "表示",
  close: "閉じる",
  openInNewTab: "新しいタブで開く",
  noVideo: "動画なし",
  expand: "展開",
  collapseHint: "クリックして折りたたむ",
  expandHint: "クリックして展開する",
  unknown: "不明",
  operationsCount: (n: number) => `${n}個の操作 (クリックして展開)`,
  expandAll: "すべて展開",
  collapseAll: "すべて折りたたみ",
  // Page
  analysisResult: "解説結果",
  willShowAfterAnalysis: "解析後にここに表示されます。",
  landingLead: "画面録画から、再現可能な手順書を生成します。\n左のサイドバーから動画をアップロードして『解析』始めましょう。",
  introLead: "画面録画から、再現可能な手順書を自動生成します。左のサイドバーから動画をアップロードして『解析』を押してください。",
  introAnalyzeTitle: "解析",
  introAnalyzeDesc: "概要／詳細モードに対応。意図・使用ツール・操作を順序立てて抽出します。",
  introPreviewTitle: "プレビュー",
  introPreviewDesc: "操作ごとのタイムラインに、所要時間と操作動画をインライン表示。",
  introExportTitle: "エクスポート",
  introExportDesc: "ファイル単位で Word / Excel にワンクリック出力できます。",
  introHint: "左のサイドバーから動画を選んで、最初の解析を始めましょう。",
  // Success page
  processingDone: "処理が完了しました",
  goHome: "トップへ",
  inProgressPrefix: "進行中",
  queuedMessage: "解析を実行中です。完了までお待ちください…",
  timeout: "タイムアウトしました。しばらくしてからご確認ください。",
  fetchError: "結果の取得に失敗しました。",
  downloadWord: "Wordをダウンロード",
  downloadPptx: "PowerPointをダウンロード",
  downloadExcel: "Excelをダウンロード",
  downloadYaml: "YAMLをダウンロード",
  export: "エクスポート",
  errorOccurred: "エラーが発生しました。",
  // Contact
  contactTitle: "お問い合わせ",
  contactDescription: "ご要望や不具合はこのページからご連絡ください（フォームは後日追加予定）。",
  // Theme toggle
  themeToggleAria: "テーマ切替",
  // UploadContext errors
  noSelectionError: "解析対象が選択されていません",
  genericError: "処理に失敗しました",
} as const;

type Dict = typeof en;

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lang, setLang] = React.useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    // URL優先: /ja で始まるか
    const path = window.location.pathname || "/";
    if (path === "/ja" || path.startsWith("/ja/")) return "ja";
    return "en";
  });

  // URL変化に応じて言語を同期
  React.useEffect(() => {
    if (!pathname) return;
    const urlLang: Lang = pathname === "/ja" || pathname.startsWith("/ja/") ? "ja" : "en";
    setLang((prev) => (prev === urlLang ? prev : urlLang));
  }, [pathname]);

  // 言語属性とLS反映
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
    try { window.localStorage.setItem(LS_KEY, lang); } catch {}
  }, [lang]);

  const value: I18nContextValue = {
    lang,
    setLang,
    toggleLang: () => {
      const path = pathname || "/";
      const qs = searchParams?.toString();
      if (lang === "en") {
        // to JA → 先頭に /ja を付与
        const nextPath = path === "/" ? "/ja" : `/ja${path}`;
        router.push(qs ? `${nextPath}?${qs}` : nextPath);
      } else {
        // to EN → 先頭の /ja を剥がす
        const nextPath = path === "/ja" ? "/" : path.replace(/^\/ja(?=\/)/, "");
        router.push(qs ? `${nextPath}?${qs}` : nextPath);
      }
    },
    t: ((key: keyof Dict, ...args: unknown[]) => {
      const d = lang === "ja" ? ja : en;
      const val = d[key];
      if (typeof val === "function") return (val as (...fnArgs: unknown[]) => string)(...args);
      return val as string;
    }) as I18nContextValue["t"],
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

// Helpers to format with numbers where needed
export function tCount(lang: Lang, key: keyof typeof en, n: number) {
  const d = lang === "ja" ? ja : en;
  const val = d[key];
  if (typeof val === "function") return (val as unknown as (n: number) => string)(n);
  return String(val);
}
