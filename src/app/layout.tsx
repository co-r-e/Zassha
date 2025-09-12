import type { Metadata } from "next";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/language-toggle";
import Providers from "@/components/providers";
import { SidebarUploader } from "@/features/upload";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ApiKeyAlert from "@/components/api-key-alert";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  title: {
    default: "ZASSHA — Analyze Screen Recordings into Reproducible Steps",
    template: "%s — ZASSHA",
  },
  description:
    "ZASSHA turns screen recordings into structured, reproducible workflows with per‑operation screenshots and Word/Excel export. Runs locally and via the Gemini Files API.",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
    languages: { en: "/", ja: "/ja" },
  },
  openGraph: {
    title: "ZASSHA — Analyze Screen Recordings into Reproducible Steps",
    description:
      "ZASSHA turns screen recordings into structured, reproducible workflows with per‑operation screenshots and Word/Excel export.",
    type: "website",
    images: [
      { url: "/opengraph-image", width: 1200, height: 630, alt: "ZASSHA — Analyze Screen Recordings into Reproducible Steps" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ZASSHA — Analyze Screen Recordings into Reproducible Steps",
    description:
      "ZASSHA turns screen recordings into structured, reproducible workflows.",
    images: [
      { url: "/twitter-image", width: 1200, height: 630, alt: "ZASSHA — Analyze Screen Recordings into Reproducible Steps" },
    ],
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <div className="min-h-dvh text-foreground bg-background">
            <aside className="fixed left-0 top-0 h-dvh w-[240px] border-r border-border p-6 bg-sidebar text-sidebar-foreground z-20">
              <div className="mb-4">
                <Image src="/logo.svg" alt="ZASSHA" width={120} height={28} className="block dark:hidden" />
                <Image src="/logo-dark.svg" alt="ZASSHA" width={120} height={28} className="hidden dark:block" />
              </div>
              <ApiKeyAlert />
              <div className="flex h-[calc(100%-40px)] flex-col">
                <div className="flex-1 overflow-hidden">
                  <SidebarUploader />
                </div>
                <div className="mt-auto pt-4 border-t border-border flex items-center justify-between gap-2">
                  <LanguageToggle />
                  <ThemeToggle />
                </div>
              </div>
            </aside>
            <div className="ml-[240px] min-h-dvh flex flex-col bg-sidebar dark:bg-background">
              <main className="flex-1 p-6 pt-4">{children}</main>
              <footer className="px-6 py-3 border-t border-border text-[11px] text-muted-foreground bg-sidebar dark:bg-background">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>© {new Date().getFullYear()} CORe Inc.</span>
                  <a
                    href="https://co-r-e.net"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground"
                  >
                    Company
                  </a>
                  <span className="text-muted-foreground/50">•</span>
                  <a
                    href="https://co-r-e.net/contact"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground"
                  >
                    Contact
                  </a>
                </div>
              </footer>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
