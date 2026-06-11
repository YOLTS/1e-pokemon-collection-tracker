import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { CollectionIntelligence } from "@/components/CollectionIntelligence";
import { ProgressDonut } from "@/components/ProgressDonut";
import { SetProgressCard } from "@/components/SetProgressCard";
import { StatCard } from "@/components/StatCard";
import { formatEnumLabel, summarizeVariants } from "@/lib/collection";
import { formatCurrency } from "@/lib/format";
import { buildCollectionIntelligence } from "@/lib/collection-intelligence";
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
      include: {
        ownedItems: true,
        card: { include: { set: { select: { name: true, slug: true } } } },
      },
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
  const setMetrics = sets.map((set) => {
    const setVariants = set.cards.flatMap((card) => card.variants);
    const setSummary = summarizeVariants(setVariants);
    const holoVariants = setVariants.filter((variant) => variant.finish === "HOLO");
    const holoOwned = holoVariants.filter((variant) =>
      variant.ownedItems.some((item) => item.status === "OWNED"),
    ).length;

    return { set, setVariants, setSummary, holoOwned, holoTotal: holoVariants.length };
  });
  const activeSets = setMetrics.filter(({ setSummary }) => setSummary.ownedVariants > 0).length;
  const holoOwned = setMetrics.reduce((total, metric) => total + metric.holoOwned, 0);
  const holoTotal = setMetrics.reduce((total, metric) => total + metric.holoTotal, 0);
  const leadingSet = [...setMetrics].sort((a, b) => b.setSummary.completion - a.setSummary.completion)[0];
  const intelligence = buildCollectionIntelligence(
    variants,
    setMetrics.map(({ set, setSummary }) => ({
      name: set.name,
      slug: set.slug,
      owned: setSummary.ownedVariants,
      missing: setSummary.missingVariants,
      total: setSummary.totalVariants,
      completion: setSummary.completion,
    })),
  );
  const heroActivity = [
    recentItems[0]
      ? `${recentItems[0].variant.card.name} marked owned`
      : `${summary.ownedVariants} owned cards tracked`,
    recentItems[1]
      ? `${recentItems[1].variant.card.name} added`
      : `${summary.missingVariants} cards remaining`,
    `${sets.length} vintage sets indexed`,
    `${summary.totalVariants} master targets loaded`,
  ];

  return (
    <div className="space-y-8">
      <section className="neon-panel command-hero rounded-lg p-0">
        <div className="relative overflow-hidden rounded-lg">
          <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-cyan-300 via-fuchsia-300 to-amber-300 opacity-80" />
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-cyan-300/15 px-5 py-4 sm:px-7">
            <div>
              <p className="neon-eyebrow text-base font-black uppercase tracking-widest">
                Master Set Portfolio Console
              </p>
              <h1 className="mt-1.5 text-3xl font-black text-white sm:text-4xl">
                1st Edition Vintage Collection
              </h1>
            </div>
            <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 text-lg font-black uppercase tracking-wide text-amber-100 shadow-amber">
              {Math.round(summary.completion)}% complete
            </div>
          </div>

          <div className="grid gap-5 px-5 py-5 sm:gap-8 sm:px-7 sm:py-6 lg:grid-cols-[19rem_1fr] lg:items-center">
            <div className="flex justify-center lg:justify-start">
              <div className="rounded-lg border border-cyan-300/25 bg-slate-950/[0.68] p-2.5 shadow-[0_24px_70px_rgba(0,0,0,0.38),0_0_48px_rgba(34,211,238,0.14)] sm:p-4">
                <ProgressDonut value={summary.completion} label="complete" />
              </div>
            </div>

            <div className="grid gap-6 sm:gap-8 md:grid-cols-[1fr_0.95fr]">
              <div>
                <p className="text-xl font-black uppercase tracking-widest text-cyan-100/90">
                  Collection status
                </p>
                <div className="neon-divider mt-3 max-w-lg" />
                <dl className="mt-4 space-y-3 text-xl font-black uppercase tracking-wide sm:mt-5 sm:space-y-5 sm:text-2xl">
                  {[
                    ["Owned", summary.ownedVariants],
                    ["Missing", summary.missingVariants],
                    ["Total targets", summary.totalVariants],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 sm:grid-cols-[11rem_1fr_auto] sm:gap-4">
                      <dt className="text-slate-200">{label}</dt>
                      <dd className="h-px bg-gradient-to-r from-cyan-300/45 via-fuchsia-300/25 to-transparent" />
                      <dd className="text-2xl text-white sm:text-3xl">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <p className="text-xl font-black uppercase tracking-widest text-amber-100/90">
                  Collection value
                </p>
                <div className="neon-divider mt-3 max-w-lg" />
                <dl className="mt-4 space-y-3 text-xl font-black uppercase tracking-wide sm:mt-5 sm:space-y-5 sm:text-2xl">
                  <div className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 sm:grid-cols-[11rem_1fr_auto] sm:gap-4">
                    <dt className="text-slate-200">Collected</dt>
                    <dd className="h-px bg-gradient-to-r from-emerald-300/45 via-cyan-300/25 to-transparent" />
                    <dd className="text-2xl text-emerald-100 sm:text-3xl">{formatCurrency(summary.estimatedCollectionValue)}</dd>
                  </div>
                  <div className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 sm:grid-cols-[11rem_1fr_auto] sm:gap-4">
                    <dt className="text-slate-200">Remaining</dt>
                    <dd className="h-px bg-gradient-to-r from-amber-300/45 via-fuchsia-300/25 to-transparent" />
                    <dd className="text-2xl text-amber-100 sm:text-3xl">{formatCurrency(summary.estimatedRemainingCost)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-sm normal-case tracking-normal text-slate-400">
                    <span>Portfolio basis</span>
                    <span className="font-bold text-cyan-100/80">Spreadsheet market estimates</span>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="border-t border-cyan-300/15 px-5 py-2 sm:px-7">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
              Recent collection activity
            </p>
            <div className="mt-1 grid gap-1.5 text-xs font-bold text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
              {heroActivity.map((activity) => (
                <p key={activity} className="truncate rounded-md border border-cyan-300/10 bg-slate-950/[0.36] px-2.5 py-1 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07]">
                  <span className="mr-1 text-cyan-200">+ </span>
                  {activity}
                </p>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-cyan-300/15 px-5 py-3.5 sm:px-7">
            <Link href="/sets" className="btn-primary rounded-md px-5 py-2.5 text-base font-black transition">
              Review Sets
            </Link>
            <Link href="/cards" className="btn-secondary rounded-md px-5 py-2.5 text-base font-black transition">
              Manage Cards
            </Link>
            <Link href="/cards" className="btn-secondary rounded-md px-5 py-2.5 text-base font-black transition">
              View Collection
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active sets" value={`${activeSets}/${sets.length}`} helper="Sets with at least one owned card" tone="cyan" />
        <StatCard label="Holo progress" value={`${holoOwned}/${holoTotal}`} helper="Rare holo targets collected" tone="rose" />
        <StatCard label="Leading set" value={leadingSet?.set.name ?? "None"} helper={leadingSet ? `${Math.round(leadingSet.setSummary.completion)}% complete` : "No set progress yet"} tone="amber" />
        <StatCard label="Recent additions" value={String(recentItems.length)} helper="Latest owned inventory records" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Display vault</p>
              <h2 className="mt-1 text-xl font-black text-white">Set progress</h2>
            </div>
            <Link href="/sets" className="text-sm font-bold text-cyan-300 hover:text-white">
              View all
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {setMetrics.slice(0, 6).map(({ set, setSummary, holoOwned, holoTotal }) => {
              return (
                <SetProgressCard
                  key={set.id}
                  set={set}
                  owned={setSummary.ownedVariants}
                  total={setSummary.totalVariants}
                  completion={setSummary.completion}
                  missing={setSummary.missingVariants}
                  ownedValue={setSummary.estimatedCollectionValue}
                  remainingValue={setSummary.estimatedRemainingCost}
                  holoOwned={holoOwned}
                  holoTotal={holoTotal}
                />
              );
            })}
          </div>
        </div>

        <section className="neon-panel neon-panel-hover activity-panel rounded-lg p-5">
          <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Activity stream</p>
          <h2 className="mt-1 text-xl font-black text-white">Recent additions</h2>
          <div className="neon-divider mt-4" />
          <div className="mt-4 space-y-3">
            {recentItems.map((item) => (
              <div key={item.id} className="interaction-card rounded-lg border border-cyan-300/10 bg-slate-950/[0.55] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black text-white">{item.variant.card.name}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {item.variant.card.set.name} {item.variant.card.cardNumber}
                    </p>
                  </div>
                  <span className="rounded-md border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-xs font-black text-cyan-200">
                    {formatEnumLabel(item.gradingCompany)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-400">
                  {formatEnumLabel(item.condition)} - {formatCurrency(item.variant.estimatedValue)}
                </p>
              </div>
            ))}
            {recentItems.length === 0 ? (
              <p className="rounded-lg border border-cyan-300/10 bg-slate-950/[0.55] p-4 text-sm font-semibold text-slate-400">
                No owned cards yet.
              </p>
            ) : null}
          </div>
        </section>
      </section>

      <CollectionIntelligence
        nextMilestone={intelligence.nextMilestone}
        cardsToMilestone={intelligence.cardsToMilestone}
        leadingSets={intelligence.leadingSets}
        closestSet={intelligence.closestSet}
        rarestOwned={intelligence.rarestOwned}
      />
    </div>
  );
}
