"use client";

import * as React from "react";
import { useI18n } from "@/components/i18n-context";

export default function ApiKeyAlert() {
  const { t } = useI18n();
  const [hasKey, setHasKey] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then(async (r) => r.json().catch(() => ({})))
      .then((j: unknown) => {
        if (!active) return;
        setHasKey(Boolean((j as { hasGemini?: boolean } | null)?.hasGemini));
      })
      .catch(() => {
        if (!active) return;
        setHasKey(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (hasKey !== false) return null;
  return (
    <div className="mt-2 inline-flex items-center gap-2 text-[12px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900">
      {t("apiKeyMissing")}
    </div>
  );
}

