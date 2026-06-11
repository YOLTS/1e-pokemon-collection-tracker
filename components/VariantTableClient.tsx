"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CardArtwork } from "@/components/CardArtwork";
import { formatCurrency } from "@/lib/format";

type OwnedItemRow = {
  id: number;
  status: string;
  condition: string;
  gradingCompany: string;
  grade: string | null;
  purchasePrice: number | null;
  notes: string;
  isPrimaryCopy: boolean;
};

type VariantRow = {
  id: number;
  slug: string;
  edition: string;
  finish: string;
  estimatedValue: number;
  notes: string;
  card: {
    cardNumber: string;
    name: string;
    rarity: string;
    imageUrlSmall: string | null;
    imageUrlLarge: string | null;
    imageSource: string | null;
    imageMatchStatus: string;
    set: {
      name: string;
      slug: string;
      symbol: string;
      color: string;
    };
  };
  ownedItems: OwnedItemRow[];
};

type VariantTableClientProps = {
  variants: VariantRow[];
  showSet?: boolean;
  toggleOwnedAction: (formData: FormData) => void | Promise<void>;
};

type OwnedFilter = "all" | "owned" | "missing";
type SortKey = "checklist" | "name" | "rarity" | "owned" | "value";

const rarityTone: Record<string, string> = {
  "Rare Holo": "border-fuchsia-300/[0.35] bg-fuchsia-400/15 text-fuchsia-100 shadow-magenta",
  Rare: "border-cyan-300/[0.35] bg-cyan-400/15 text-cyan-100 shadow-glow",
  Uncommon: "border-sky-300/30 bg-sky-400/[0.12] text-sky-100",
  Common: "border-slate-300/20 bg-slate-300/10 text-slate-300",
  Energy: "border-amber-300/[0.35] bg-amber-400/15 text-amber-100 shadow-amber",
  "Rare Secret": "border-amber-300/40 bg-gradient-to-r from-amber-300/20 to-fuchsia-400/15 text-amber-100 shadow-amber",
  "Rare Shining": "border-pink-300/40 bg-pink-400/15 text-pink-100 shadow-magenta",
};

const rarityEdge: Record<string, string> = {
  "Rare Holo": "from-fuchsia-300 via-pink-400 to-amber-300",
  Rare: "from-cyan-300 via-sky-400 to-blue-400",
  Uncommon: "from-sky-300 via-blue-400 to-indigo-400",
  Common: "from-slate-300 via-slate-400 to-slate-600",
  Energy: "from-amber-300 via-orange-400 to-rose-400",
  "Rare Secret": "from-amber-200 via-fuchsia-300 to-cyan-300",
  "Rare Shining": "from-pink-300 via-fuchsia-300 to-cyan-300",
};

function rarityClass(rarity: string) {
  return rarityTone[rarity] ?? "border-cyan-300/15 bg-white/10 text-slate-200";
}

function rarityEdgeClass(rarity: string) {
  return rarityEdge[rarity] ?? "from-cyan-300 via-fuchsia-300 to-amber-300";
}

function cardNumberValue(cardNumber: string) {
  const [number] = cardNumber.split("/");
  return Number(number) || 0;
}

function hasOwnedCopy(variant: VariantRow) {
  return variant.ownedItems.some((item) => item.status === "OWNED");
}

function getPrimaryCopy(variant: VariantRow) {
  return (
    variant.ownedItems.find((item) => item.status === "OWNED" && item.isPrimaryCopy) ??
    variant.ownedItems.find((item) => item.status === "OWNED") ??
    null
  );
}

function formatEnumLabel(value?: string | null) {
  if (!value) {
    return "-";
  }

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function VariantTableClient({
  variants,
  showSet = false,
  toggleOwnedAction,
}: VariantTableClientProps) {
  const [query, setQuery] = useState("");
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("checklist");

  const rarityOptions = useMemo(
    () => Array.from(new Set(variants.map((variant) => variant.card.rarity))).sort(),
    [variants],
  );

  const filteredVariants = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return variants
      .filter((variant) => {
        const owned = hasOwnedCopy(variant);
        const matchesOwned =
          ownedFilter === "all" || (ownedFilter === "owned" ? owned : !owned);
        const matchesRarity =
          rarityFilter === "all" || variant.card.rarity === rarityFilter;
        const matchesQuery =
          normalizedQuery.length === 0 ||
          [
            variant.card.name,
            variant.card.cardNumber,
            variant.card.rarity,
            variant.card.set.name,
            variant.notes,
            ...variant.ownedItems.map((item) => item.notes),
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);

        return matchesOwned && matchesRarity && matchesQuery;
      })
      .sort((a, b) => {
        if (showSet && a.card.set.name !== b.card.set.name) {
          return a.card.set.name.localeCompare(b.card.set.name);
        }

        if (sortKey === "name") {
          return a.card.name.localeCompare(b.card.name);
        }

        if (sortKey === "rarity") {
          return (
            a.card.rarity.localeCompare(b.card.rarity) ||
            cardNumberValue(a.card.cardNumber) - cardNumberValue(b.card.cardNumber)
          );
        }

        if (sortKey === "owned") {
          return (
            Number(hasOwnedCopy(b)) - Number(hasOwnedCopy(a)) ||
            cardNumberValue(a.card.cardNumber) - cardNumberValue(b.card.cardNumber)
          );
        }

        if (sortKey === "value") {
          return (
            b.estimatedValue - a.estimatedValue ||
            cardNumberValue(a.card.cardNumber) - cardNumberValue(b.card.cardNumber)
          );
        }

        return cardNumberValue(a.card.cardNumber) - cardNumberValue(b.card.cardNumber);
      });
  }, [ownedFilter, query, rarityFilter, showSet, sortKey, variants]);

  const visibleOwned = filteredVariants.filter(hasOwnedCopy).length;

  return (
    <section className="neon-panel overflow-hidden rounded-lg">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 opacity-70" />
      <div className="border-b border-cyan-300/10 bg-slate-950/[0.62] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Inventory console</p>
            <h2 className="mt-1 text-lg font-black text-white">Card checklist</h2>
            <p className="mt-1 text-sm text-slate-400">
              Showing {filteredVariants.length} of {variants.length} cards, {visibleOwned} owned
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:min-w-[760px]">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, number, set, notes"
                className="field-control mt-1 h-10 w-full rounded-md px-3 text-sm text-white outline-none transition placeholder:text-slate-600"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Owned</span>
              <select
                value={ownedFilter}
                onChange={(event) => setOwnedFilter(event.target.value as OwnedFilter)}
                className="field-control mt-1 h-10 w-full rounded-md px-3 text-sm font-semibold text-white outline-none transition"
              >
                <option value="all">All cards</option>
                <option value="owned">Owned only</option>
                <option value="missing">Missing only</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Rarity</span>
              <select
                value={rarityFilter}
                onChange={(event) => setRarityFilter(event.target.value)}
                className="field-control mt-1 h-10 w-full rounded-md px-3 text-sm font-semibold text-white outline-none transition"
              >
                <option value="all">All rarities</option>
                {rarityOptions.map((rarity) => (
                  <option key={rarity} value={rarity}>
                    {rarity}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Sort</span>
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="field-control mt-1 h-10 w-full rounded-md px-3 text-sm font-semibold text-white outline-none transition"
              >
                <option value="checklist">Checklist order</option>
                <option value="name">Card name</option>
                <option value="rarity">Rarity</option>
                <option value="owned">Owned first</option>
                <option value="value">Value high-low</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="collection-grid grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredVariants.map((variant) => {
          const owned = hasOwnedCopy(variant);
          const primaryCopy = getPrimaryCopy(variant);
          const notes = primaryCopy?.notes || variant.notes;

          return (
            <article
              key={variant.id}
              className={`collection-card group relative flex min-h-[25rem] flex-col overflow-hidden rounded-lg border p-4 ${
                owned
                  ? "is-owned border-cyan-300/25 bg-cyan-300/[0.055]"
                  : "is-missing border-white/[0.08] bg-slate-950/[0.48]"
              }`}
            >
              <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${rarityEdgeClass(variant.card.rarity)} ${owned ? "opacity-90" : "opacity-40"}`} />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Archive record</p>
                  <p className="mt-1 truncate text-xs font-bold text-slate-400">{variant.card.set.name}</p>
                </div>
                <span
                  className={`inline-flex shrink-0 rounded-md border px-2 py-1 text-xs font-black ${
                    owned
                      ? "border-emerald-300/35 bg-emerald-400/15 text-emerald-100 shadow-[0_0_18px_rgba(52,211,153,0.12)]"
                      : "border-slate-400/20 bg-slate-400/[0.08] text-slate-400"
                  }`}
                >
                  {owned ? "Owned" : "Missing"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-[7.25rem_1fr] gap-4">
                <CardArtwork
                  name={variant.card.name}
                  cardNumber={variant.card.cardNumber}
                  setName={variant.card.set.name}
                  setSymbol={variant.card.set.symbol}
                  setColor={variant.card.set.color}
                  imageUrlSmall={variant.card.imageUrlSmall}
                  imageUrlLarge={variant.card.imageUrlLarge}
                  imageSource={variant.card.imageSource}
                  imageMatchStatus={variant.card.imageMatchStatus}
                  owned={owned}
                />

                <div className="flex min-w-0 flex-col py-1">
                  <p className="font-mono text-xs font-bold text-cyan-100/65">#{variant.card.cardNumber}</p>
                  <h3 className={`mt-2 text-xl font-black leading-tight ${owned ? "text-white" : "text-slate-200"}`}>{variant.card.name}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-black ${rarityClass(variant.card.rarity)}`}>
                      {variant.card.rarity}
                    </span>
                    <span className="inline-flex rounded-md border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-xs font-bold text-slate-400">
                      {formatEnumLabel(variant.finish)}
                    </span>
                  </div>
                  <p className="mt-auto pt-3 text-xs font-semibold text-slate-500">{formatEnumLabel(variant.edition)}</p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-4 gap-3 border-y border-white/[0.07] py-3 text-sm">
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-wide text-slate-600">Condition</dt>
                  <dd className="mt-1 font-semibold text-slate-300">{formatEnumLabel(primaryCopy?.condition)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-wide text-slate-600">Grading</dt>
                  <dd className="mt-1 font-semibold text-slate-300">
                    {primaryCopy
                      ? `${formatEnumLabel(primaryCopy.gradingCompany)}${primaryCopy.grade ? ` ${primaryCopy.grade}` : ""}`
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-wide text-slate-600">Value</dt>
                  <dd className="mt-1 font-black text-white">{formatCurrency(variant.estimatedValue)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-wide text-slate-600">Paid</dt>
                  <dd className="mt-1 font-semibold text-slate-300">
                    {primaryCopy?.purchasePrice ? formatCurrency(primaryCopy.purchasePrice) : "-"}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-relaxed text-slate-500">
                {notes || (owned ? "No collector notes yet." : "Not yet added to the collection.")}
              </p>

              <div className="mt-auto flex items-center gap-2 pt-4">
                <Link
                  href={`/cards/${variant.id}`}
                  className={`${owned ? "btn-primary" : "btn-secondary"} flex-1 whitespace-nowrap rounded-md px-3 py-2 text-center text-xs font-black transition`}
                >
                  View details
                </Link>
                <form action={toggleOwnedAction} className="flex-1">
                  <input type="hidden" name="variantId" value={variant.id} />
                  <input type="hidden" name="setSlug" value={variant.card.set.slug} />
                  <input type="hidden" name="owned" value={String(!owned)} />
                  <button
                    type="submit"
                    className={`w-full whitespace-nowrap rounded-md px-3 py-2 text-xs font-black transition ${owned ? "btn-secondary" : "btn-primary"}`}
                  >
                    {owned ? "Mark missing" : "Mark owned"}
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
      {filteredVariants.length === 0 ? (
        <div className="p-8 text-center text-sm font-semibold text-slate-400">
          No cards match the current filters.
        </div>
      ) : null}
    </section>
  );
}
