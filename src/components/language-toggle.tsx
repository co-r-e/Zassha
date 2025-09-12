"use client";

import * as React from "react";
import { Globe } from "lucide-react";
import { useI18n } from "@/components/i18n-context";

export default function LanguageToggle() {
  const { lang, toggleLang } = useI18n();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label={lang === "en" ? "Switch language to Japanese" : "言語を英語に切り替える"}
      title={lang === "en" ? "Switch to Japanese" : "英語に切り替え"}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted transition-colors"
    >
      <Globe className="h-3.5 w-3.5" />
      <span className="font-medium">{lang.toUpperCase()}</span>
    </button>
  );
}
