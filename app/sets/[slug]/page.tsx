import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { ProgressDonut } from "@/components/ProgressDonut";
import { StatCard } from "@/components/StatCard";
import { VariantTable } from "@/components/VariantTable";
import { summarizeVariants } from "@/lib/collection";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { compareRarity, rarityToken } from "@/lib/rarity";

export const dynamic = "force-dynamic";

type SetDetailPageProps = {
  params: {
    slug: string;
  };
};

export default async function SetDetailPage({ params }: SetDetailPageProps) {
  const pageStartedAt = Date.now();
  noStore();

  const dataFetchStartedAt = Date.now();
  const set = await prisma.pokemonSet.findUnique({
    where: { slug: params.slug },
    include: {
      cards: {
        orderBy: { displayOrder: "asc" },
        include: {
          set: { select: { name: true, slug: true, symbol: true, color: true } },
          variants: {
            orderBy: { id: "asc" },
            include: {
              ownedItems: true,
              card: {
                include: { set: { select: { name: true, slug: true, symbol: true, color: true } } },
              },
            },
          },
        },
      },
    },
  });
  const dataFetchMs = Date.now() - dataFetchStartedAt;

  if (!set) {
    notFound();
  }

  const variants = set.cards.flatMap((card) => card.variants);
  const summary = summarizeVariants(variants);
  const rarityBreakdown = Array.from(
    variants.reduce((map, variant) => {
      const current = map.get(variant.card.rarity) ?? { total: 0, owned: 0 };
      current.total += 1;
      if (variant.ownedItems.some((item) => item.status === "OWNED")) {
        current.owned += 1;
      }
      map.set(variant.card.rarity, current);
      return map;
    }, new Map<string, { total: number; owned: number }>()),
  ).sort(([a], [b]) => compareRarity(a, b));
  const serverPrepareMs = Date.now() - pageStartedAt;
  const navigationDebugTiming = {
    route: `/sets/${params.slug}`,
    dataFetchMs,
    serverPrepareMs,
    variantCount: variants.length,
    selectedSet: set.slug,
  };

  return (
    <div className="space-y-6">
      <section className="neon-panel set-archive-header grid gap-6 rounded-lg p-5 sm:p-6 lg:grid-cols-[1fr_220px]">
        <div>
          <Link href="/sets" className="text-sm font-bold text-cyan-300 hover:text-white">
            Back to sets
          </Link>
          <div className="mt-4 flex items-center gap-4">
            <div
              className="grid size-14 place-items-center rounded-lg text-base font-black text-slate-950 shadow-glow ring-1 ring-white/20"
              style={{ backgroundColor: set.color }}
              title={set.symbolLabel}
            >
              {set.symbol}
            </div>
            <div>
              <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Set display file</p>
              <h1 className="text-4xl font-black text-white">{set.name}</h1>
              <p className="mt-1 text-slate-400">
                {set.releaseYear} · {set.totalCards} original checklist cards · {set.series}
              </p>
              <div className="neon-divider mt-4 max-w-md" />
            </div>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <ProgressDonut value={summary.completion} label="set" size="sm" />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
        <StatCard label="Seeded variants" value={String(summary.totalVariants)} />
        <StatCard label="Owned" value={String(summary.ownedVariants)} tone="green" />
        <StatCard label="Missing" value={String(summary.missingVariants)} tone="rose" />
        <StatCard
          label="Owned value"
          value={formatCurrency(summary.estimatedCollectionValue)}
          helper={`${summary.pricedOwnedVariants} priced owned cards`}
          tone="green"
        />
        <StatCard
          label="Remaining cost"
          value={formatCurrency(summary.estimatedRemainingCost)}
          helper={`${summary.pricedVariants} / ${summary.totalVariants} cards priced`}
          tone="amber"
        />
      </section>

      <section className="neon-panel rounded-lg p-5">
        <div className="grid gap-5 lg:grid-cols-[14rem_1fr] lg:items-center">
          <div className="lg:border-r lg:border-cyan-300/10 lg:pr-5">
            <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Rarity signal</p>
            <h2 className="text-lg font-black text-white">Rarity progress</h2>
            <p className="mt-1 text-sm text-slate-400">Owned cards by rarity in this set</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {rarityBreakdown.map(([rarity, counts]) => {
              const completion = counts.total ? (counts.owned / counts.total) * 100 : 0;
              const visualCompletion = completion > 0 ? Math.max(4, completion) : 0;
              const rarityClass = `rarity-${rarityToken(rarity)}`;

              return (
                <div key={rarity} className={`rarity-progress-card ${rarityClass} rounded-lg p-3`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="rarity-progress-label text-xs font-black">{rarity}</span>
                    <span className="text-sm font-black text-white">{counts.owned}/{counts.total}</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-950 ring-1 ring-white/[0.08]">
                    <div
                      className="rarity-progress-fill h-full rounded-full"
                      style={{ width: `${visualCompletion}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <VariantTable variants={variants} navigationDebugTiming={navigationDebugTiming} />
    </div>
  );
}
