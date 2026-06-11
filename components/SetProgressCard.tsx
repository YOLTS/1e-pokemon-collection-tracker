import Link from "next/link";
import type { PokemonSet } from "@prisma/client";
import { formatCurrency, formatPercent } from "@/lib/format";

type SetProgressCardProps = {
  set: Pick<PokemonSet, "name" | "slug" | "symbol" | "symbolLabel" | "totalCards" | "releaseYear" | "color">;
  owned: number;
  total: number;
  completion: number;
  missing?: number;
  ownedValue?: number;
  remainingValue?: number;
  priced?: number;
  holoOwned?: number;
  holoTotal?: number;
};

export function SetProgressCard({
  set,
  owned,
  total,
  completion,
  missing = Math.max(total - owned, 0),
  ownedValue = 0,
  remainingValue = 0,
  priced,
  holoOwned,
  holoTotal,
}: SetProgressCardProps) {
  const visualCompletion = completion > 0 ? Math.max(2.5, Math.min(100, completion)) : 0;

  return (
    <Link
      href={`/sets/${set.slug}`}
      className="neon-panel neon-panel-hover group rounded-lg p-5"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 opacity-70" />
      <div className="flex min-h-8 items-start justify-between gap-4">
        <h2 className="text-xl font-black leading-tight text-white">{set.name}</h2>
        <span className="shrink-0 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-xs font-black text-cyan-100 shadow-glow">
          {owned}/{total || 0}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="shrink-0 rounded-lg border border-cyan-300/15 bg-slate-950/55 p-1.5 shadow-glow">
          <div
            className="grid size-12 place-items-center rounded-md text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.24)] ring-1 ring-white/25"
            style={{ backgroundColor: set.color }}
            title={set.symbolLabel}
          >
            {set.symbol}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-300">{set.releaseYear}</p>
          <p className="mt-0.5 text-sm text-slate-500">{set.totalCards} total cards</p>
        </div>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-950/80 shadow-inner shadow-black/50 ring-1 ring-white/10">
        <div
          className="h-full min-w-px rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.4)] transition-all duration-500"
          style={{ width: `${visualCompletion}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <p className="font-semibold text-cyan-100">{formatPercent(completion)} complete</p>
        <p className="font-semibold text-slate-500">{missing} missing</p>
      </div>
      <div className="neon-divider mt-4" />
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Priced owned</p>
          <p className="mt-1 font-black text-white">{formatCurrency(ownedValue)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Priced missing</p>
          <p className="mt-1 font-black text-white">{formatCurrency(remainingValue)}</p>
        </div>
        {priced !== undefined ? (
          <p className="col-span-2 text-xs font-semibold text-slate-500">{priced} / {total} cards priced</p>
        ) : null}
        {holoTotal !== undefined && holoOwned !== undefined ? (
          <div className="col-span-2 flex items-center justify-between rounded-md border border-fuchsia-300/20 bg-fuchsia-400/[0.07] px-3 py-2 text-xs font-bold text-fuchsia-100">
            <span>Holo progress</span>
            <span>{holoOwned}/{holoTotal}</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
