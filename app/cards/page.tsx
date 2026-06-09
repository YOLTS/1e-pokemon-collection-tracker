import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { StatCard } from "@/components/StatCard";
import { VariantTable } from "@/components/VariantTable";
import { summarizeVariants } from "@/lib/collection";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CardsPageProps = {
  searchParams: {
    set?: string;
  };
};

export default async function CardsPage({ searchParams }: CardsPageProps) {
  noStore();

  const sets = await prisma.pokemonSet.findMany({
    orderBy: { displayOrder: "asc" },
  });

  const selectedSlug = searchParams.set ?? "all";
  const selectedSet = sets.find((set) => set.slug === selectedSlug);

  const variants = await prisma.cardVariant.findMany({
    where: selectedSet
      ? {
          card: {
            setId: selectedSet.id,
          },
        }
      : {},
    orderBy: [
      { card: { set: { displayOrder: "asc" } } },
      { card: { displayOrder: "asc" } },
      { id: "asc" },
    ],
    include: {
      ownedItems: true,
      card: {
        include: {
          set: {
            select: {
              name: true,
              slug: true,
              symbol: true,
              color: true,
            },
          },
        },
      },
    },
  });

  const summary = summarizeVariants(variants);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-300">Variant inventory</p>
          <h1 className="mt-2 text-4xl font-black text-white">Cards</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Manage master-set candidate variants, owned raw or graded copies, condition details, purchase prices, and placeholder values.
          </p>
        </div>
        <form className="flex flex-col gap-2 sm:flex-row sm:items-center" action="/cards">
          <label className="text-sm font-bold text-slate-400" htmlFor="set">
            Set
          </label>
          <select
            id="set"
            name="set"
            defaultValue={selectedSlug}
            className="h-11 rounded-md border border-white/15 bg-slate-950 px-3 text-sm font-semibold text-white shadow-soft"
          >
            <option value="all">All seeded cards</option>
            {sets.map((set) => (
              <option key={set.id} value={set.slug}>
                {set.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-11 rounded-md bg-emerald-300 px-4 text-sm font-black text-slate-950 transition hover:bg-white"
          >
            View
          </button>
        </form>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="View"
          value={selectedSet?.name ?? "All sets"}
          helper={selectedSet ? `${selectedSet.totalCards} checklist cards` : "Seeded sample variants"}
          tone="cyan"
        />
        <StatCard label="Variants" value={String(summary.totalVariants)} />
        <StatCard label="Owned" value={String(summary.ownedVariants)} tone="green" />
        <StatCard label="Missing" value={String(summary.missingVariants)} tone="rose" />
        <StatCard label="Remaining cost" value={formatCurrency(summary.estimatedRemainingCost)} tone="amber" />
      </section>

      {variants.length > 0 ? (
        <VariantTable variants={variants} showSet={!selectedSet} />
      ) : (
        <section className="rounded-lg border border-white/10 bg-white/[0.05] p-8 text-center shadow-soft backdrop-blur">
          <p className="font-semibold text-slate-400">No sample cards have been seeded for this set yet.</p>
          <Link href="/sets" className="mt-4 inline-flex text-sm font-bold text-emerald-300 hover:text-white">
            Back to sets
          </Link>
        </section>
      )}
    </div>
  );
}
