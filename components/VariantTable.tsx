import type { Card, CardVariant, CollectionItem, PokemonSet } from "@prisma/client";
import { toggleVariantOwned } from "@/app/actions";
import { formatEnumLabel, getPrimaryCopy, hasOwnedCopy } from "@/lib/collection";
import { formatCurrency } from "@/lib/format";

export type VariantRow = CardVariant & {
  card: Card & {
    set: Pick<PokemonSet, "name" | "slug" | "symbol" | "color">;
  };
  ownedItems: CollectionItem[];
};

type VariantTableProps = {
  variants: VariantRow[];
  showSet?: boolean;
};

export function VariantTable({ variants, showSet = false }: VariantTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] shadow-soft backdrop-blur">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/[0.04] text-xs font-black uppercase tracking-wide text-slate-400">
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
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {variants.map((variant) => {
              const owned = hasOwnedCopy(variant);
              const primaryCopy = getPrimaryCopy(variant);

              return (
                <tr key={variant.id} className="align-top transition hover:bg-white/[0.05]">
                  {showSet ? (
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className="font-bold text-white">{variant.card.set.name}</span>
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap px-4 py-4 font-mono text-slate-300">
                    {variant.card.cardNumber}
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-black text-white">{variant.card.name}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-400">{variant.card.rarity}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-300">
                    <div>{formatEnumLabel(variant.edition)}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatEnumLabel(variant.finish)}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs font-black ${
                        owned
                          ? "bg-emerald-400/15 text-emerald-300"
                          : "bg-rose-400/15 text-rose-300"
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
                  <td className="min-w-52 px-4 py-4 text-slate-400">
                    {primaryCopy?.notes || variant.notes || "-"}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <form action={toggleVariantOwned}>
                      <input type="hidden" name="variantId" value={variant.id} />
                      <input type="hidden" name="setSlug" value={variant.card.set.slug} />
                      <input type="hidden" name="owned" value={String(!owned)} />
                      <button
                        type="submit"
                        className="whitespace-nowrap rounded-md border border-white/15 px-3 py-2 text-xs font-black text-white transition hover:border-emerald-300 hover:bg-emerald-300 hover:text-slate-950"
                      >
                        {owned ? "Mark missing" : "Mark owned"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {variants.length === 0 ? (
        <div className="p-8 text-center text-sm font-semibold text-slate-400">
          No card variants have been seeded for this set yet.
        </div>
      ) : null}
    </div>
  );
}
