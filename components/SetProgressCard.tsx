import Link from "next/link";
import type { PokemonSet } from "@prisma/client";
import { formatPercent } from "@/lib/format";

type SetProgressCardProps = {
  set: Pick<PokemonSet, "name" | "slug" | "symbol" | "symbolLabel" | "totalCards" | "releaseYear" | "color">;
  owned: number;
  total: number;
  completion: number;
};

export function SetProgressCard({ set, owned, total, completion }: SetProgressCardProps) {
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
      <p className="mt-3 text-sm font-semibold text-slate-300">{formatPercent(completion)} complete</p>
    </Link>
  );
}
