import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "1st Edition Tracker",
  description: "Local-first tracker for English 1st Edition vintage Pokemon cards.",
};

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/sets", label: "Sets" },
  { href: "/cards", label: "Cards" },
];

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
              <span className="grid size-10 place-items-center rounded-md bg-gradient-to-br from-cyan-300 via-sky-400 to-fuchsia-400 text-lg font-black text-slate-950 shadow-glow">
                1E
              </span>
              <span>
                <span className="block text-base font-black tracking-wide text-white">
                  Vintage Pokemon
                </span>
                <span className="block text-sm text-slate-400">1st Edition collection platform</span>
              </span>
            </Link>
            <nav className="flex gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-cyan-300/10 hover:text-cyan-100 hover:shadow-glow"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
