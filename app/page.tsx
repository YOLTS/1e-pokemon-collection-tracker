import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { ProgressDonut } from "@/components/ProgressDonut";
import { SetProgressCard } from "@/components/SetProgressCard";
import { StatCard } from "@/components/StatCard";
import { formatEnumLabel, summarizeVariants } from "@/lib/collection";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  noStore();

  const [sets, variants, recentItems] = await Promise.all([
    prisma.pokemonSet.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        cards: {
          include: {
            variants: {
              include: { ownedItems: true },
            },
          },
        },
      },
    }),
    prisma.cardVariant.findMany({
      where: { isMasterSetCandidate: true },
      include: { ownedItems: true },
    }),
    prisma.collectionItem.findMany({
      where: { status: "OWNED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        variant: {
          include: {
            card: {
              include: { set: true },
            },
          },
        },
      },
    }),
  ]);

  const summary = summarizeVariants(variants);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.05] p-6 shadow-soft backdrop-blur sm:p-8">
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-300">Master set portfolio</p>
          <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">
            English 1st Edition vintage tracker
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
            Track master-set progress, owned inventory, graded and raw copies, placeholder values, and future-ready pricing data across the WOTC vintage era.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/sets"
              className="rounded-md bg-emerald-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-white"
            >
              Review sets
            </Link>
            <Link
              href="/cards"
              className="rounded-md border border-white/15 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
            >
              Manage cards
            </Link>
          </div>
        </div>

        <section className="flex items-center justify-center rounded-lg border border-white/10 bg-slate-950/70 p-6 shadow-soft backdrop-blur">
          <ProgressDonut value={summary.completion} label="complete" />
        </section>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Owned cards" value={String(summary.ownedVariants)} tone="green" />
        <StatCard label="Missing cards" value={String(summary.missingVariants)} tone="rose" />
        <StatCard label="Master targets" value={String(summary.totalVariants)} tone="cyan" />
        <StatCard label="Collection value" value={formatCurrency(summary.estimatedCollectionValue)} tone="green" />
        <StatCard label="Remaining cost" value={formatCurrency(summary.estimatedRemainingCost)} tone="amber" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-white">Set progress</h2>
            <Link href="/sets" className="text-sm font-bold text-emerald-300 hover:text-white">
              View all
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sets.slice(0, 6).map((set) => {
              const setVariants = set.cards.flatMap((card) => card.variants);
              const setSummary = summarizeVariants(setVariants);

              return (
                <SetProgressCard
                  key={set.id}
                  set={set}
                  owned={setSummary.ownedVariants}
                  total={setSummary.totalVariants}
                  completion={setSummary.completion}
                />
              );
            })}
          </div>
        </div>

        <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5 shadow-soft backdrop-blur">
          <h2 className="text-xl font-black text-white">Recent additions</h2>
          <div className="mt-4 space-y-3">
            {recentItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black text-white">{item.variant.card.name}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {item.variant.card.set.name} {item.variant.card.cardNumber}
                    </p>
                  </div>
                  <span className="rounded-md bg-emerald-400/15 px-2 py-1 text-xs font-black text-emerald-300">
                    {formatEnumLabel(item.gradingCompany)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-400">
                  {formatEnumLabel(item.condition)} - {formatCurrency(item.variant.estimatedValue)}
                </p>
              </div>
            ))}
            {recentItems.length === 0 ? (
              <p className="rounded-lg border border-white/10 bg-slate-950/50 p-4 text-sm font-semibold text-slate-400">
                No owned cards yet.
              </p>
            ) : null}
          </div>
        </section>
      </section>
    </div>
  );
}
