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
        <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-md bg-emerald-400 text-lg font-black text-slate-950">
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
                  className="rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
