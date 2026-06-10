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
  holoOwned,
  holoTotal,
}: SetProgressCardProps) {
  return (
    <Link
      href={`/sets/${set.slug}`}
      className="neon-panel neon-panel-hover group rounded-lg p-5"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 opacity-70" />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="rounded-xl border border-cyan-300/15 bg-slate-950/55 p-2 shadow-glow">
            <div
              className="grid size-14 place-items-center rounded-lg text-base font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.24)] ring-1 ring-white/25"
              style={{ backgroundColor: set.color }}
              title={set.symbolLabel}
            >
              {set.symbol}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-200/80">1st Edition archive</p>
            <h2 className="mt-1 text-xl font-black text-white">{set.name}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {set.releaseYear} - {set.totalCards} checklist cards
            </p>
          </div>
        </div>
        <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-xs font-black text-cyan-100 shadow-glow">
          {owned}/{total || 0}
        </span>
      </div>
      <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-950/80 shadow-inner shadow-black/50 ring-1 ring-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.4)] transition-all duration-500"
          style={{ width: `${Math.max(0, Math.min(100, completion))}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <p className="font-semibold text-cyan-100">{formatPercent(completion)} complete</p>
        <p className="font-semibold text-slate-500">{missing} missing</p>
      </div>
      <div className="neon-divider mt-5" />
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Owned value</p>
          <p className="mt-1 font-black text-white">{formatCurrency(ownedValue)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Remaining</p>
          <p className="mt-1 font-black text-white">{formatCurrency(remainingValue)}</p>
        </div>
        {holoTotal !== undefined && holoOwned !== undefined ? (
          <div className="col-span-2 rounded-md border border-fuchsia-300/25 bg-fuchsia-400/10 px-3 py-2 text-xs font-bold text-fuchsia-100 shadow-magenta">
            Holo progress: {holoOwned}/{holoTotal}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
