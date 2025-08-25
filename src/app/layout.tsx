import type { Metadata } from "next";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import Providers from "@/components/providers";
import SidebarUploader from "@/components/SidebarUploader";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// ThemeProvider moved into Providers

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZASSHA",
  description: "動画の内容をテキストで解説",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
        <div className="min-h-dvh text-foreground bg-background">
          <aside className="fixed left-0 top-0 h-dvh w-[240px] border-r border-border p-6 bg-sidebar text-sidebar-foreground z-20">
            <div className="mb-6">
              <Image src="/logo.svg" alt="ZASSHA" width={120} height={28} className="block dark:hidden" />
              <Image src="/logo-dark.svg" alt="ZASSHA" width={120} height={28} className="hidden dark:block" />
            </div>
            <div className="flex h-[calc(100%-40px)] flex-col">
              <div className="flex-1 overflow-hidden">
                <SidebarUploader />
              </div>
              <div className="mt-auto pt-4 border-t border-border">
                <ThemeToggle />
              </div>
            </div>
          </aside>
          <main className="ml-[240px] p-6 pt-4">{children}</main>
        </div>
        </Providers>
      </body>
    </html>
  );
}
