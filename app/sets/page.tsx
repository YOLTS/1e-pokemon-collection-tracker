import { unstable_noStore as noStore } from "next/cache";
import { SetProgressCard } from "@/components/SetProgressCard";
import { StatCard } from "@/components/StatCard";
import { summarizeVariants } from "@/lib/collection";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SetsPage() {
  noStore();

  const sets = await prisma.pokemonSet.findMany({
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
  });

  const allVariants = sets.flatMap((set) => set.cards.flatMap((card) => card.variants));
  const allSummary = summarizeVariants(allVariants);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-300">Vintage set catalog</p>
          <h1 className="mt-2 text-4xl font-black text-white">English 1st Edition sets</h1>
          <p className="mt-3 max-w-3xl text-slate-400">
            All 10 vintage sets that include 1st Edition English cards are modeled here. Base Set, Jungle, and Fossil currently include seeded sample card variants.
          </p>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tracked sets" value={String(sets.length)} tone="cyan" />
        <StatCard label="Seeded targets" value={String(allSummary.totalVariants)} />
        <StatCard label="Owned targets" value={String(allSummary.ownedVariants)} tone="green" />
        <StatCard label="Remaining cost" value={formatCurrency(allSummary.estimatedRemainingCost)} tone="amber" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sets.map((set) => {
          const setVariants = set.cards.flatMap((card) => card.variants);
          const summary = summarizeVariants(setVariants);

          return (
            <SetProgressCard
              key={set.id}
              set={set}
              owned={summary.ownedVariants}
              total={summary.totalVariants}
              completion={summary.completion}
            />
          );
        })}
      </section>
    </div>
  );
}
