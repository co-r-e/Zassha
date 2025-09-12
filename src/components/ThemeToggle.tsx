"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/i18n-context";

export default function ThemeToggle() {
  const { t } = useI18n();
  const { theme, systemTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const effectiveTheme = theme === "system" ? systemTheme : theme;
  const isDark = effectiveTheme === "dark";

  return (
    <div className="flex items-center justify-center gap-3">
      <Sun className={`h-4 w-4 ${isDark ? "text-muted-foreground" : "text-foreground"}`} aria-hidden />
      <Switch
        checked={isDark}
        onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
        aria-label={t("themeToggleAria")}
        className="cursor-pointer"
      />
      <Moon className={`h-4 w-4 ${isDark ? "text-foreground" : "text-muted-foreground"}`} aria-hidden />
    </div>
  );
}




