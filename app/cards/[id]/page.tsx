import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { updateVariantDetails } from "@/app/actions";
import { StatCard } from "@/components/StatCard";
import { CARD_CONDITION } from "@/lib/domain";
import { formatEnumLabel, getPrimaryCopy, hasOwnedCopy } from "@/lib/collection";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CardDetailPageProps = {
  params: {
    id: string;
  };
  searchParams: {
    saved?: string;
  };
};

const conditionOptions = Object.values(CARD_CONDITION);

export default async function CardDetailPage({ params, searchParams }: CardDetailPageProps) {
  noStore();

  const variantId = Number(params.id);
  if (!Number.isInteger(variantId)) {
    notFound();
  }

  const variant = await prisma.cardVariant.findUnique({
    where: { id: variantId },
    include: {
      ownedItems: true,
      card: {
        include: {
          set: {
            select: {
              name: true,
              slug: true,
              symbol: true,
              color: true,
              releaseYear: true,
            },
          },
        },
      },
    },
  });

  if (!variant) {
    notFound();
  }

  const owned = hasOwnedCopy(variant);
  const primaryCopy = getPrimaryCopy(variant);
  const editableNotes = primaryCopy?.notes || variant.notes;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href={`/sets/${variant.card.set.slug}`} className="text-sm font-bold text-emerald-300 hover:text-white">
            Back to {variant.card.set.name}
          </Link>
          <div className="mt-4 flex items-center gap-4">
            <div
              className="grid size-14 place-items-center rounded-lg text-base font-black text-slate-950"
              style={{ backgroundColor: variant.card.set.color }}
            >
              {variant.card.set.symbol}
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
                {variant.card.set.name} - {variant.card.cardNumber}
              </p>
              <h1 className="mt-1 text-4xl font-black text-white">{variant.card.name}</h1>
              <p className="mt-2 text-slate-400">
                {formatEnumLabel(variant.edition)} - {formatEnumLabel(variant.finish)} - {variant.card.rarity}
              </p>
            </div>
          </div>
        </div>
        <Link
          href="/cards"
          className="inline-flex items-center justify-center rounded-md border border-white/15 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
        >
          All cards
        </Link>
      </div>

      {searchParams.saved ? (
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200">
          Card details saved.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Owned status" value={owned ? "Owned" : "Missing"} tone={owned ? "green" : "rose"} />
        <StatCard label="Condition" value={formatEnumLabel(primaryCopy?.condition)} />
        <StatCard label="Estimated value" value={formatCurrency(variant.estimatedValue)} tone="cyan" />
        <StatCard
          label="Purchase price"
          value={primaryCopy?.purchasePrice ? formatCurrency(primaryCopy.purchasePrice) : "-"}
          tone="amber"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.05] p-5 shadow-soft backdrop-blur">
          <h2 className="text-lg font-black text-white">Imported card identity</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-bold text-slate-500">Set</dt>
              <dd className="mt-1 text-white">{variant.card.set.name}</dd>
            </div>
            <div>
              <dt className="font-bold text-slate-500">Card number</dt>
              <dd className="mt-1 font-mono text-white">{variant.card.cardNumber}</dd>
            </div>
            <div>
              <dt className="font-bold text-slate-500">Rarity</dt>
              <dd className="mt-1 text-white">{variant.card.rarity}</dd>
            </div>
            <div>
              <dt className="font-bold text-slate-500">Edition</dt>
              <dd className="mt-1 text-white">{formatEnumLabel(variant.edition)}</dd>
            </div>
          </dl>
        </div>

        <form action={updateVariantDetails} className="rounded-lg border border-white/10 bg-white/[0.05] p-5 shadow-soft backdrop-blur">
          <input type="hidden" name="variantId" value={variant.id} />
          <input type="hidden" name="setSlug" value={variant.card.set.slug} />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-white">Collector details</h2>
              <p className="mt-1 text-sm text-slate-400">
                Update mutable collection fields without changing spreadsheet-imported card identity.
              </p>
            </div>
            <button
              type="submit"
              className="rounded-md bg-emerald-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-white"
            >
              Save changes
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Condition</span>
              <select
                name="condition"
                defaultValue={primaryCopy?.condition ?? CARD_CONDITION.NOT_ASSESSED}
                className="mt-1 h-11 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-semibold text-white outline-none focus:border-emerald-300"
              >
                {conditionOptions.map((condition) => (
                  <option key={condition} value={condition}>
                    {formatEnumLabel(condition)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Estimated value</span>
              <input
                name="estimatedValue"
                type="number"
                min="0"
                step="0.01"
                defaultValue={variant.estimatedValue || ""}
                className="mt-1 h-11 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-semibold text-white outline-none focus:border-emerald-300"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Purchase price</span>
              <input
                name="purchasePrice"
                type="number"
                min="0"
                step="0.01"
                defaultValue={primaryCopy?.purchasePrice ?? ""}
                className="mt-1 h-11 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-semibold text-white outline-none focus:border-emerald-300"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Current status</span>
              <div className="mt-1 flex h-11 items-center rounded-md border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white">
                {owned ? "Owned" : "Missing"}
              </div>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Notes</span>
            <textarea
              name="notes"
              rows={6}
              defaultValue={editableNotes}
              className="mt-1 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300"
              placeholder="Condition details, acquisition context, binder notes"
            />
          </label>
        </form>
      </section>
    </div>
  );
}
