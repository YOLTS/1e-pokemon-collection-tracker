import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { ProgressDonut } from "@/components/ProgressDonut";
import { StatCard } from "@/components/StatCard";
import { VariantTable } from "@/components/VariantTable";
import { summarizeVariants } from "@/lib/collection";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SetDetailPageProps = {
  params: {
    slug: string;
  };
};

export default async function SetDetailPage({ params }: SetDetailPageProps) {
  noStore();

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
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
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
                {set.releaseYear} - {set.totalCards} original checklist cards - {set.series}
              </p>
              <div className="neon-divider mt-4 max-w-md" />
            </div>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <ProgressDonut value={summary.completion} label="set" size="sm" />
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Seeded variants" value={String(summary.totalVariants)} />
        <StatCard label="Owned" value={String(summary.ownedVariants)} tone="green" />
        <StatCard label="Missing" value={String(summary.missingVariants)} tone="rose" />
        <StatCard label="Owned value" value={formatCurrency(summary.estimatedCollectionValue)} tone="green" />
        <StatCard label="Remaining cost" value={formatCurrency(summary.estimatedRemainingCost)} tone="amber" />
      </section>

      <section className="neon-panel rounded-lg p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Rarity signal</p>
            <h2 className="text-lg font-black text-white">Rarity progress</h2>
            <p className="mt-1 text-sm text-slate-400">Owned cards by rarity in this set</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {rarityBreakdown.map(([rarity, counts]) => (
              <span
                key={rarity}
                className="rounded-md border border-cyan-300/15 bg-slate-950/[0.65] px-3 py-2 text-xs font-bold text-slate-300"
              >
                {rarity}: <span className="text-white">{counts.owned}/{counts.total}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <VariantTable variants={variants} />
    </div>
  );
}
