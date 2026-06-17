import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { OfflineRuntime } from "@/components/OfflineRuntime";
import { PrimaryNav } from "@/components/PrimaryNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "1st Edition Tracker",
  description: "Local-first tracker for English 1st Edition vintage Pokemon cards.",
  applicationName: "1st Edition Tracker",
  manifest: "/manifest.webmanifest?v=5",
  appleWebApp: {
    capable: true,
    title: "1E Tracker",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png?v=5", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=5", sizes: "512x512", type: "image/png" },
      { url: "/icons/favicon-32.png?v=5", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png?v=5", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <OfflineRuntime />
        <header className="sticky top-0 z-30 border-b border-cyan-300/15 bg-slate-950/[0.78] shadow-[0_10px_42px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logos/top_banner_logo.png"
                alt=""
                width={128}
                height={128}
                className="size-32 shrink-0 object-contain mix-blend-screen"
                priority
              />
              <span>
                <span className="block text-base font-black tracking-wide text-white">
                  Vintage Pokémon
                </span>
                <span className="block text-sm text-slate-400">1st Edition Collection Platform</span>
              </span>
            </Link>
            <PrimaryNav />
          </div>
        </header>
        <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
