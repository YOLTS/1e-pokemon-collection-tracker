import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { updateVariantDetails } from "@/app/actions";
import { CardArtwork } from "@/components/CardArtwork";
import { CARD_CONDITION } from "@/lib/domain";
import { formatEnumLabel, getMarketPrice, getPrimaryCopy, hasOwnedCopy } from "@/lib/collection";
import { formatCurrency, formatMarketPrice } from "@/lib/format";
import { rarityToken } from "@/lib/rarity";
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
  const gradingLabel = primaryCopy
    ? `${formatEnumLabel(primaryCopy.gradingCompany)}${primaryCopy.grade ? ` ${primaryCopy.grade}` : ""}`
    : "Not graded";

  return (
    <div className="card-detail-page space-y-6">
      <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Card navigation">
        <Link href={`/sets/${variant.card.set.slug}`} className="text-sm font-bold text-cyan-300 transition hover:text-white">
          Back to {variant.card.set.name}
        </Link>
        <Link href="/cards" className="btn-secondary inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-black transition">
          All cards
        </Link>
      </nav>

      {searchParams.saved ? (
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-100 shadow-glow">
          Card details saved.
        </div>
      ) : null}

      <section className={`card-detail-showcase neon-panel overflow-hidden rounded-lg ${owned ? "is-owned" : "is-missing"}`}>
        <div className="card-detail-artwork-stage">
          <div className="card-detail-catalog-mark">
            <span>{variant.card.set.releaseYear}</span>
            <span>{variant.card.set.symbol}</span>
          </div>
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
            preferLarge
            priority
            className="card-detail-artwork mx-auto w-full max-w-sm"
          />
          <p className="mt-5 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
            Select artwork for full archival view
          </p>
        </div>

        <div className="card-detail-record">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Collector archive record</p>
              <p className="mt-2 text-sm font-bold uppercase tracking-widest text-slate-500">
                {variant.card.set.name} / No. {variant.card.cardNumber}
              </p>
              <h1 className="mt-2 text-4xl font-black leading-none text-white sm:text-5xl">{variant.card.name}</h1>
              <p className="mt-4 max-w-xl text-base font-semibold text-slate-400">
                {formatEnumLabel(variant.edition)} edition · {formatEnumLabel(variant.finish)} · English vintage archive
              </p>
            </div>
            <span className={`ownership-badge ${owned ? "is-owned" : "is-missing"}`}>
              <span className="ownership-badge-dot" aria-hidden="true" />
              {owned ? "In collection" : "Missing"}
            </span>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3 border-y border-white/[0.08] py-4">
            <span className={`rarity-badge rarity-${rarityToken(variant.card.rarity)}`}>{variant.card.rarity}</span>
            <span className="card-detail-token">{formatEnumLabel(variant.finish)}</span>
            <span className="card-detail-token">{formatEnumLabel(variant.edition)}</span>
          </div>

          <dl className="card-detail-metrics mt-7 grid gap-px overflow-hidden rounded-lg sm:grid-cols-2">
            <div><dt>Condition</dt><dd>{formatEnumLabel(primaryCopy?.condition)}</dd></div>
            <div><dt>Grading</dt><dd>{gradingLabel}</dd></div>
            <div>
              <dt>Estimated market value</dt>
              <dd>{formatMarketPrice(getMarketPrice(variant))}</dd>
            </div>
            <div><dt>Acquisition cost</dt><dd>{primaryCopy?.purchasePrice ? formatCurrency(primaryCopy.purchasePrice) : "Not recorded"}</dd></div>
          </dl>

          <div className="card-detail-provenance mt-7">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Collection notes</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {editableNotes || (owned ? "No collector notes have been recorded for this copy." : "This card has not yet been added to the collection.")}
            </p>
          </div>
        </div>
      </section>

      <form action={updateVariantDetails} className="card-detail-ledger neon-panel rounded-lg p-5 sm:p-6">
          <input type="hidden" name="variantId" value={variant.id} />
          <input type="hidden" name="setSlug" value={variant.card.set.slug} />

          <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Private collection ledger</p>
              <h2 className="mt-1 text-2xl font-black text-white">Condition, value and provenance</h2>
              <p className="mt-2 text-sm text-slate-400">Maintain the mutable record for this collectible without altering its imported identity.</p>
            </div>
            <button
              type="submit"
              className="btn-primary rounded-md px-4 py-3 text-sm font-black transition"
            >
              Save changes
            </button>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="grid content-start gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Condition</span>
              <select
                name="condition"
                defaultValue={primaryCopy?.condition ?? CARD_CONDITION.NOT_ASSESSED}
                className="field-control mt-1 h-11 w-full rounded-md px-3 text-sm font-semibold text-white outline-none transition"
              >
                {conditionOptions.map((condition) => (
                  <option key={condition} value={condition}>
                    {formatEnumLabel(condition)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Manual estimated value</span>
              <input
                name="estimatedValue"
                type="number"
                min="0"
                step="0.01"
                defaultValue={variant.estimatedValue || ""}
                className="field-control mt-1 h-11 w-full rounded-md px-3 text-sm font-semibold text-white outline-none transition"
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
                className="field-control mt-1 h-11 w-full rounded-md px-3 text-sm font-semibold text-white outline-none transition"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Current status</span>
              <div className="field-control mt-1 flex h-11 items-center rounded-md px-3 text-sm font-bold text-white">
                {owned ? "Owned" : "Missing"}
              </div>
            </label>
            </div>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Collector notes and provenance</span>
              <textarea
                name="notes"
                rows={8}
                defaultValue={editableNotes}
                className="field-control mt-1 min-h-52 w-full rounded-md px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600"
                placeholder="Condition details, acquisition context, binder notes"
              />
            </label>
          </div>
      </form>
    </div>
  );
}
