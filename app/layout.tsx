import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PrimaryNav } from "@/components/PrimaryNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "1st Edition Tracker",
  description: "Local-first tracker for English 1st Edition vintage Pokemon cards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
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
