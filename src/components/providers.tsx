"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { UploadProvider } from "@/components/upload-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <UploadProvider>{children}</UploadProvider>
    </ThemeProvider>
  );
}

