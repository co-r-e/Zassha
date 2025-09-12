"use client";

import * as React from "react";
import Image from "next/image";
import { useI18n } from "@/components/i18n-context";

export default function EmptyLanding() {
  const { t } = useI18n();
  return (
    <div className="min-h-[65vh] grid place-items-center">
      <div className="text-center">
        <div className="inline-block">
          <Image src="/logo.svg" alt="ZASSHA" width={200} height={46} className="block dark:hidden" />
          <Image src="/logo-dark.svg" alt="ZASSHA" width={200} height={46} className="hidden dark:block" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-[72ch] mx-auto whitespace-pre-line">
          {t("landingLead")}
        </p>
      </div>
    </div>
  );
}
