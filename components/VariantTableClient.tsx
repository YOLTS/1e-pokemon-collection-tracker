"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

function rarityClass(rarity: string) {
  return rarityTone[rarity] ?? "border-cyan-300/15 bg-white/10 text-slate-200";
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

      <div className="overflow-x-auto rounded-b-lg">
        <table className="min-w-[1180px] divide-y divide-cyan-300/10 text-left text-sm">
          <thead className="bg-cyan-300/[0.05] text-xs font-black uppercase tracking-wide text-slate-400">
            <tr>
              {showSet ? <th className="px-4 py-3">Set</th> : null}
              <th className="px-4 py-3">No.</th>
              <th className="px-4 py-3">Card</th>
              <th className="px-4 py-3">Variant</th>
              <th className="px-4 py-3">Owned</th>
              <th className="px-4 py-3">Condition</th>
              <th className="px-4 py-3">Grading</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3">Notes</th>
              <th className="sticky right-0 bg-slate-950/95 px-4 py-3 text-right shadow-[-16px_0_24px_rgba(2,6,23,0.7)]">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cyan-300/10">
            {filteredVariants.map((variant) => {
              const owned = hasOwnedCopy(variant);
              const primaryCopy = getPrimaryCopy(variant);

              return (
                <tr key={variant.id} className="align-top transition hover:bg-cyan-300/[0.055] hover:shadow-[inset_3px_0_0_rgba(34,211,238,0.65)]">
                  {showSet ? (
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className="inline-flex items-center gap-2 font-bold text-white">
                        <span
                          className="grid size-7 place-items-center rounded-md text-[10px] font-black text-slate-950 ring-1 ring-white/20"
                          style={{ backgroundColor: variant.card.set.color }}
                        >
                          {variant.card.set.symbol}
                        </span>
                        {variant.card.set.name}
                      </span>
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap px-4 py-4 font-mono text-slate-300">
                    {variant.card.cardNumber}
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-black text-white">{variant.card.name}</div>
                    <span
                      className={`mt-2 inline-flex rounded-md border px-2 py-1 text-xs font-black ${rarityClass(variant.card.rarity)}`}
                    >
                      {variant.card.rarity}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-300">
                    <div>{formatEnumLabel(variant.edition)}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatEnumLabel(variant.finish)}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-md border px-2 py-1 text-xs font-black ${
                        owned
                          ? "border-cyan-300/[0.35] bg-cyan-400/15 text-cyan-100 shadow-glow"
                          : "border-fuchsia-300/30 bg-fuchsia-400/[0.12] text-fuchsia-200"
                      }`}
                    >
                      {owned ? "Owned" : "Missing"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-300">
                    {formatEnumLabel(primaryCopy?.condition)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-300">
                    {primaryCopy
                      ? `${formatEnumLabel(primaryCopy.gradingCompany)}${primaryCopy.grade ? ` ${primaryCopy.grade}` : ""}`
                      : "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-white">
                    {formatCurrency(variant.estimatedValue)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-slate-300">
                    {primaryCopy?.purchasePrice ? formatCurrency(primaryCopy.purchasePrice) : "-"}
                  </td>
                  <td className="min-w-56 max-w-sm px-4 py-4 text-slate-400">
                    <span className="line-clamp-3">{primaryCopy?.notes || variant.notes || "-"}</span>
                  </td>
                  <td className="sticky right-0 bg-slate-950/95 px-4 py-4 text-right shadow-[-16px_0_24px_rgba(2,6,23,0.7)]">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/cards/${variant.id}`}
                        className="btn-secondary whitespace-nowrap rounded-md px-3 py-2 text-xs font-black transition"
                      >
                        Details
                      </Link>
                      <form action={toggleOwnedAction}>
                        <input type="hidden" name="variantId" value={variant.id} />
                        <input type="hidden" name="setSlug" value={variant.card.set.slug} />
                        <input type="hidden" name="owned" value={String(!owned)} />
                        <button
                          type="submit"
                          className="btn-primary whitespace-nowrap rounded-md px-3 py-2 text-xs font-black transition"
                        >
                          {owned ? "Mark missing" : "Mark owned"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filteredVariants.length === 0 ? (
        <div className="p-8 text-center text-sm font-semibold text-slate-400">
          No cards match the current filters.
        </div>
      ) : null}
    </section>
  );
}
