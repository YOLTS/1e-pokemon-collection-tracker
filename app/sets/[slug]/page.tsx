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

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <div>
          <Link href="/sets" className="text-sm font-bold text-emerald-300 hover:text-white">
            Back to sets
          </Link>
          <div className="mt-4 flex items-center gap-4">
            <div
              className="grid size-14 place-items-center rounded-lg text-base font-black text-slate-950"
              style={{ backgroundColor: set.color }}
              title={set.symbolLabel}
            >
              {set.symbol}
            </div>
            <div>
              <h1 className="text-4xl font-black text-white">{set.name}</h1>
              <p className="mt-1 text-slate-400">
                {set.releaseYear} - {set.totalCards} original checklist cards - {set.series}
              </p>
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

      <VariantTable variants={variants} />
    </div>
  );
}
