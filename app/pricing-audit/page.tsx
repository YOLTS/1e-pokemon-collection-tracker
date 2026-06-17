import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getMarketPrice } from "@/lib/collection";
import { PRICE_SOURCE } from "@/lib/domain";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const priceSource = PRICE_SOURCE.MANUAL_SPREADSHEET;

function formatAuditCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSource(source: string) {
  return source === priceSource ? "Manual spreadsheet price" : source;
}

export default async function PricingAuditPage() {
  noStore();

  const variants = await prisma.cardVariant.findMany({
    where: {
      marketPriceSource: priceSource,
      marketPrice: { not: null },
    },
    include: {
      card: { include: { set: true } },
      priceSnapshots: {
        where: { source: priceSource },
        orderBy: { capturedAt: "desc" },
        take: 1,
      },
    },
  });

  const pricedCards = variants
    .flatMap((variant) => {
      const price = getMarketPrice(variant);
      if (price === null) return [];
      return [{ variant, snapshot: variant.priceSnapshots[0], price }];
    })
    .sort((a, b) => b.price - a.price);

  const highest = pricedCards[0] ?? null;
  const median = pricedCards[Math.floor(pricedCards.length / 2)] ?? null;
  const totalValue = pricedCards.reduce((total, entry) => total + entry.price, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="neon-eyebrow text-sm font-bold uppercase tracking-widest">Manual pricing review</p>
          <h1 className="mt-2 text-4xl font-black text-white">Manual spreadsheet pricing audit</h1>
          <p className="mt-3 max-w-3xl text-slate-400">
            Manual spreadsheet pricing snapshots imported from your tracker workbook.
          </p>
          <div className="neon-divider mt-5 max-w-xl" />
        </div>
        <Link href="/cards" className="btn-secondary inline-flex items-center justify-center rounded-md px-4 py-3 text-sm font-black transition">
          Back to cards
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="neon-panel rounded-lg p-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Highest priced card</p>
          <p className="mt-2 text-xl font-black text-white">{highest?.variant.card.name ?? "Unavailable"}</p>
          <p className="mt-1 text-sm font-bold text-amber-100">{highest ? formatAuditCurrency(highest.price) : "-"}</p>
        </div>
        <div className="neon-panel rounded-lg p-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Median priced card</p>
          <p className="mt-2 text-xl font-black text-white">{median?.variant.card.name ?? "Unavailable"}</p>
          <p className="mt-1 text-sm font-bold text-cyan-100">{median ? formatAuditCurrency(median.price) : "-"}</p>
        </div>
        <div className="neon-panel rounded-lg p-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Total priced cards</p>
          <p className="mt-2 text-3xl font-black text-white">{pricedCards.length}</p>
          <p className="mt-1 text-sm text-slate-500">Manual spreadsheet snapshots</p>
        </div>
        <div className="neon-panel rounded-lg p-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Sum of priced cards</p>
          <p className="mt-2 text-3xl font-black text-white">{formatAuditCurrency(totalValue)}</p>
          <p className="mt-1 text-sm text-slate-500">Before ownership filtering</p>
        </div>
      </section>

      <section className="neon-panel overflow-hidden rounded-lg">
        <div className="border-b border-cyan-300/10 bg-slate-950/[0.62] px-4 py-3">
          <p className="text-sm font-bold text-slate-300">All priced cards · highest market value first</p>
        </div>
        <div className="overflow-x-auto">
          <table className="pricing-audit-table w-full min-w-[850px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th>Card</th>
                <th>Set</th>
                <th>Number</th>
                <th className="text-right">Market value</th>
                <th>Price source</th>
                <th>Price type</th>
              </tr>
            </thead>
            <tbody>
              {pricedCards.map(({ variant, snapshot, price }) => (
                <tr key={variant.id}>
                  <td>
                    <Link href={`/cards/${variant.id}`} className="font-black text-white transition hover:text-cyan-200">
                      {variant.card.name}
                    </Link>
                  </td>
                  <td className="text-slate-300">{variant.card.set.name}</td>
                  <td className="font-mono text-slate-400">{variant.card.cardNumber}</td>
                  <td className="text-right font-black text-amber-100">{formatAuditCurrency(price)}</td>
                  <td className="text-slate-400">{formatSource(snapshot?.source ?? variant.marketPriceSource ?? "Manual")}</td>
                  <td>
                    <span className="rounded-md border border-cyan-300/15 bg-cyan-300/[0.06] px-2 py-1 font-mono text-xs font-bold text-cyan-100/80">
                      Manual spreadsheet
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

