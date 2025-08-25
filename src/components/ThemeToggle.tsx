"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function ThemeToggle() {
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
        aria-label="テーマ切替"
        className="cursor-pointer"
      />
      <Moon className={`h-4 w-4 ${isDark ? "text-foreground" : "text-muted-foreground"}`} aria-hidden />
    </div>
  );
}



