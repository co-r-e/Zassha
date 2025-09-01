"use client";
import { useI18n } from "@/components/i18n-context";

export default function ContactPage() {
  const { t } = useI18n();
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-4">{t("contactTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("contactDescription")}</p>
    </div>
  );
}

