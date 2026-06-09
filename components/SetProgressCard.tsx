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
      className="group rounded-lg border border-white/10 bg-white/[0.05] p-5 shadow-soft backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300/40 hover:bg-white/[0.08]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div
            className="mb-4 grid size-12 place-items-center rounded-lg text-sm font-black text-slate-950"
            style={{ backgroundColor: set.color }}
            title={set.symbolLabel}
          >
            {set.symbol}
          </div>
          <h2 className="text-xl font-black text-white">{set.name}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {set.releaseYear} - {set.totalCards} checklist cards
          </p>
        </div>
        <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-bold text-slate-300">
          {owned}/{total || 0}
        </span>
      </div>
      <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-400 transition-all duration-500"
          style={{ width: `${Math.max(0, Math.min(100, completion))}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <p className="font-semibold text-slate-300">{formatPercent(completion)} complete</p>
        <p className="font-semibold text-slate-500">{missing} missing</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Owned value</p>
          <p className="mt-1 font-black text-white">{formatCurrency(ownedValue)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Remaining</p>
          <p className="mt-1 font-black text-white">{formatCurrency(remainingValue)}</p>
        </div>
        {holoTotal !== undefined && holoOwned !== undefined ? (
          <div className="col-span-2 rounded-md border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-xs font-bold text-violet-200">
            Holo progress: {holoOwned}/{holoTotal}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
