import Link from "next/link";
import { formatCurrency, formatPercent } from "@/lib/format";
import { rarityToken } from "@/lib/rarity";
import type { SetIntelligenceMetric } from "@/lib/collection-intelligence";

type RarityMetric = {
  rarity: string;
  owned: number;
  missing: number;
  total: number;
  completion: number;
};

type CollectionIntelligenceProps = {
  nextMilestone: number;
  cardsToMilestone: number;
  leadingSets: SetIntelligenceMetric[];
  closestSet: SetIntelligenceMetric | null;
  rarestOwned: Array<{
    id: number;
    name: string;
    cardNumber: string;
    rarity: string;
    setName: string;
    setSlug: string;
    estimatedValue: number;
  }>;
};

export function CollectionIntelligence({
  nextMilestone,
  cardsToMilestone,
  leadingSets,
  closestSet,
  rarestOwned,
}: CollectionIntelligenceProps) {
  return (
    <section className="intelligence-panel neon-panel rounded-lg p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-cyan-300/10 pb-4">
        <div>
          <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Archive intelligence</p>
          <h2 className="mt-1 text-2xl font-black text-white">Collection briefing</h2>
        </div>
        <p className="text-sm font-semibold text-slate-400">Derived from your live master checklist</p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1fr_1.15fr]">
        <div className="intelligence-block">
          <p className="intelligence-label">Next milestone</p>
          <p className="mt-2 text-4xl font-black text-white">{nextMilestone}%</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {cardsToMilestone === 0
              ? "Master collection milestone achieved."
              : `${cardsToMilestone} more ${cardsToMilestone === 1 ? "card" : "cards"} needed to reach the next portfolio threshold.`}
          </p>
          {closestSet ? (
            <Link href={`/sets/${closestSet.slug}`} className="intelligence-callout mt-4 block">
              <span>Closest finish</span>
              <strong>{closestSet.name}</strong>
              <small>{closestSet.missing} missing · {formatPercent(closestSet.completion)}</small>
            </Link>
          ) : null}
        </div>

        <div className="intelligence-block">
          <p className="intelligence-label">Most complete sets</p>
          <ol className="mt-3 space-y-2">
            {leadingSets.map((set, index) => (
              <li key={set.slug}>
                <Link href={`/sets/${set.slug}`} className="intelligence-ranking">
                  <span className="intelligence-rank">0{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-white">{set.name}</strong>
                    <small className="text-slate-500">{set.owned}/{set.total} owned</small>
                  </span>
                  <span className="font-black text-cyan-100">{formatPercent(set.completion)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>

        <div className="intelligence-block">
          <p className="intelligence-label">Notable owned cards</p>
          <div className="mt-3 space-y-2">
            {rarestOwned.map((card) => (
              <Link key={card.id} href={`/cards/${card.id}`} className="intelligence-card-row">
                <span className={`rarity-badge rarity-${rarityToken(card.rarity)}`}>{card.rarity}</span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm text-white">{card.name}</strong>
                  <small className="text-slate-500">{card.setName} · #{card.cardNumber}</small>
                </span>
                <span className="text-sm font-black text-slate-300">{formatCurrency(card.estimatedValue)}</span>
              </Link>
            ))}
            {rarestOwned.length === 0 ? <p className="text-sm text-slate-500">Owned-card intelligence will appear after your first addition.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SetRankings({ sets }: { sets: SetIntelligenceMetric[] }) {
  return (
    <section className="intelligence-panel neon-panel rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Completion intelligence</p>
          <h2 className="mt-1 text-xl font-black text-white">Set progress ranking</h2>
        </div>
        <p className="text-sm text-slate-500">Highest completion first</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {sets.slice(0, 3).map((set, index) => (
          <Link key={set.slug} href={`/sets/${set.slug}`} className="intelligence-ranking-card">
            <span className="intelligence-rank">0{index + 1}</span>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-white">{set.name}</strong>
              <small className="text-slate-500">{set.missing} remaining</small>
            </div>
            <span className="text-lg font-black text-cyan-100">{formatPercent(set.completion)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function RarityIntelligence({ rarities }: { rarities: RarityMetric[] }) {
  return (
    <section className="intelligence-panel neon-panel rounded-lg p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Ownership intelligence</p>
          <h2 className="mt-1 text-xl font-black text-white">Progress by rarity</h2>
        </div>
        <p className="text-sm text-slate-500">Owned versus remaining targets</p>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {rarities.map((rarity) => (
          <div key={rarity.rarity} className={`rarity-intelligence rarity-${rarityToken(rarity.rarity)}`}>
            <span className="rarity-progress-label text-xs font-black">{rarity.rarity}</span>
            <strong>{rarity.owned}/{rarity.total}</strong>
            <small>{formatPercent(rarity.completion)} · {rarity.missing} missing</small>
          </div>
        ))}
      </div>
    </section>
  );
}
