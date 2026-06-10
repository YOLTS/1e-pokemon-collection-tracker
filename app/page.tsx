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
  const ownedRate = `${summary.ownedVariants} owned / ${summary.missingVariants} missing`;
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
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cyan-300/15 px-5 py-4 sm:px-6">
            <div>
              <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">
                Master Set Portfolio Console
              </p>
              <h1 className="mt-1 text-xl font-black text-white sm:text-2xl">
                English 1st Edition Vintage Collection
              </h1>
            </div>
            <div className="rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-sm font-black uppercase tracking-wide text-amber-100">
              {Math.round(summary.completion)}% complete
            </div>
          </div>

          <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[18rem_1fr] lg:items-center">
            <div className="flex justify-center lg:justify-start">
              <div className="rounded-lg border border-cyan-300/20 bg-slate-950/[0.58] p-5 shadow-glow">
                <ProgressDonut value={summary.completion} label="complete" />
                <p className="mt-4 text-center text-sm font-bold text-slate-300">{ownedRate}</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-[1fr_0.82fr]">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-cyan-100/80">
                  Collection status
                </p>
                <div className="neon-divider mt-3 max-w-sm" />
                <dl className="mt-4 space-y-3 text-sm font-black uppercase tracking-wide">
                  {[
                    ["Owned", summary.ownedVariants],
                    ["Missing", summary.missingVariants],
                    ["Total targets", summary.totalVariants],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[9rem_1fr_auto] items-center gap-3">
                      <dt className="text-slate-300">{label}</dt>
                      <dd className="h-px bg-gradient-to-r from-cyan-300/45 via-fuchsia-300/25 to-transparent" />
                      <dd className="text-white">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-widest text-amber-100/80">
                  Collection value
                </p>
                <div className="neon-divider mt-3 max-w-sm" />
                <dl className="mt-4 space-y-3 text-sm font-black uppercase tracking-wide">
                  <div className="grid grid-cols-[9rem_1fr_auto] items-center gap-3">
                    <dt className="text-slate-300">Collected</dt>
                    <dd className="h-px bg-gradient-to-r from-emerald-300/45 via-cyan-300/25 to-transparent" />
                    <dd className="text-emerald-100">{formatCurrency(summary.estimatedCollectionValue)}</dd>
                  </div>
                  <div className="grid grid-cols-[9rem_1fr_auto] items-center gap-3">
                    <dt className="text-slate-300">Remaining</dt>
                    <dd className="h-px bg-gradient-to-r from-amber-300/45 via-fuchsia-300/25 to-transparent" />
                    <dd className="text-amber-100">{formatCurrency(summary.estimatedRemainingCost)}</dd>
                  </div>
                  <div className="rounded-md border border-cyan-300/12 bg-cyan-300/[0.06] px-3 py-2 text-xs normal-case tracking-normal text-cyan-100/80">
                    Future featured card artwork can occupy this compact module without displacing collection data.
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="border-t border-cyan-300/15 px-5 py-4 sm:px-6">
            <p className="text-xs font-black uppercase tracking-widest text-slate-300">
              Recent collection activity
            </p>
            <div className="mt-3 grid gap-2 text-sm font-bold text-slate-300 sm:grid-cols-2">
              {heroActivity.map((activity) => (
                <p key={activity} className="rounded-md border border-white/5 bg-white/[0.035] px-3 py-2">
                  <span className="text-cyan-200">+ </span>
                  {activity}
                </p>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-cyan-300/15 px-5 py-4 sm:px-6">
            <Link href="/sets" className="btn-primary rounded-md px-4 py-2.5 text-sm font-black transition">
              Review Sets
            </Link>
            <Link href="/cards" className="btn-secondary rounded-md px-4 py-2.5 text-sm font-black transition">
              Manage Cards
            </Link>
            <Link href="/cards" className="btn-secondary rounded-md px-4 py-2.5 text-sm font-black transition">
              View Collection
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Completion" value={`${Math.round(summary.completion)}%`} helper={ownedRate} tone="cyan" />
        <StatCard label="Collection value" value={formatCurrency(summary.estimatedCollectionValue)} helper="From market values in the spreadsheet" tone="green" />
        <StatCard label="Remaining cost" value={formatCurrency(summary.estimatedRemainingCost)} helper="Missing-card market value total" tone="amber" />
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
            {sets.slice(0, 6).map((set) => {
              const setVariants = set.cards.flatMap((card) => card.variants);
              const setSummary = summarizeVariants(setVariants);
              const holoVariants = setVariants.filter((variant) => variant.finish === "HOLO");
              const holoOwned = holoVariants.filter((variant) =>
                variant.ownedItems.some((item) => item.status === "OWNED"),
              ).length;

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
                  holoTotal={holoVariants.length}
                />
              );
            })}
          </div>
        </div>

        <section className="neon-panel rounded-lg p-5">
          <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Activity stream</p>
          <h2 className="mt-1 text-xl font-black text-white">Recent additions</h2>
          <div className="neon-divider mt-4" />
          <div className="mt-4 space-y-3">
            {recentItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-cyan-300/10 bg-slate-950/[0.55] p-4 transition hover:border-cyan-300/30 hover:bg-cyan-300/5">
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
    </div>
  );
}
