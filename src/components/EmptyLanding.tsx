"use client";

import * as React from "react";
import Image from "next/image";
import { useI18n } from "@/components/i18n-context";

export default function EmptyLanding() {
  const { t } = useI18n();
  const [hasKey, setHasKey] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    void fetch("/api/health")
      .then(async (r) => r.json().catch(() => ({})))
      .then((j: unknown) => setHasKey(Boolean((j as { hasGemini?: boolean } | null)?.hasGemini)))
      .catch(() => setHasKey(null));
  }, []);
  return (
    <div className="min-h-[65vh] grid place-items-center">
      <div className="text-center">
        {/* Centered logo (light/dark) */}
        <div className="inline-block">
          <Image src="/logo.svg" alt="ZASSHA" width={200} height={46} className="block dark:hidden" />
          <Image src="/logo-dark.svg" alt="ZASSHA" width={200} height={46} className="hidden dark:block" />
        </div>
        {hasKey === false && (
          <div className="mt-4 inline-flex items-center gap-2 text-[12px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900">
            {t("apiKeyMissing")}
         </div>
        )}
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-[72ch] mx-auto whitespace-pre-line">
          {t("landingLead")}
        </p>
      </div>
    </div>
  );
}
