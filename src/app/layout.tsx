import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { UploadCloud } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";

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
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <div className="min-h-dvh text-foreground bg-background">
          <aside className="fixed left-0 top-0 h-dvh w-[240px] border-r border-border p-6 bg-sidebar text-sidebar-foreground z-20">
            <div className="mb-6">
              <Image src="/logo.svg" alt="ZASSHA" width={120} height={28} className="block dark:hidden" />
              <Image src="/logo-dark.svg" alt="ZASSHA" width={120} height={28} className="hidden dark:block" />
            </div>
            <div className="flex h-[calc(100%-40px)] flex-col">
              <nav className="mt-4 space-y-3">
                <Link
                  className="group relative flex items-center gap-2 text-sm px-2 py-2 rounded-md pl-3 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-1 before:rounded-full before:bg-sidebar-primary before:scale-y-0 before:opacity-0 before:transition before:duration-300 group-hover:before:scale-y-100 group-hover:before:opacity-100"
                  href="/"
                >
                  <UploadCloud className="h-4 w-4" /> アップロード
                </Link>
              </nav>
              <div className="mt-auto pt-4 border-t border-border">
                <ThemeToggle />
              </div>
            </div>
          </aside>
          <main className="ml-[240px] p-6 pt-4">{children}</main>
        </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
