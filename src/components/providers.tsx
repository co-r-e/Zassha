"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { UploadProvider } from "@/components/upload-context";
import { I18nProvider } from "@/components/i18n-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <I18nProvider>
        <UploadProvider>{children}</UploadProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
