"use client";

import { useEffect, useMemo, useState } from "react";
import { CardArtwork } from "@/components/CardArtwork";
import { loadOfflineSnapshot } from "@/lib/offline-storage";
import {
  getOfflineMarketPrice,
  getOfflinePrimaryCopy,
  hasOfflineOwnedCopy,
  type OfflineSnapshot,
  type OfflineVariant,
} from "@/lib/offline-snapshot";
import { formatCurrency, formatMarketPrice } from "@/lib/format";

type OfflineView =
  | { name: "dashboard" }
  | { name: "sets" }
  | { name: "set"; slug: string }
  | { name: "cards" }
  | { name: "card"; id: number };

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

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function initialView(): OfflineView {
  if (typeof window === "undefined") {
    return { name: "dashboard" };
  }

  const path = window.location.pathname;
  const cardMatch = path.match(/^\/cards\/(\d+)/);
  if (cardMatch) {
    return { name: "card", id: Number(cardMatch[1]) };
  }

  const setMatch = path.match(/^\/sets\/([^/]+)/);
  if (setMatch) {
    return { name: "set", slug: decodeURIComponent(setMatch[1]) };
  }

  if (path.startsWith("/cards")) {
    return { name: "cards" };
  }

  if (path.startsWith("/sets")) {
    return { name: "sets" };
  }

  return { name: "dashboard" };
}

export function OfflineModeClient() {
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null>(null);
  const [view, setView] = useState<OfflineView>({ name: "dashboard" });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [online, setOnline] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState("");

  useEffect(() => {
    setView(initialView());
    setOnline(navigator.onLine);

    function handleOnline() {
      setOnline(true);
    }

    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    loadOfflineSnapshot()
      .then((loadedSnapshot) => {
        setSnapshot(loadedSnapshot);
        setStatus(loadedSnapshot ? "ready" : "empty");
      })
      .catch(() => setStatus("error"));

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  function navigate(nextView: OfflineView) {
    setBlockedMessage("");
    setView(nextView);
  }

  function blockEdit() {
    setBlockedMessage("Connection required. Offline card show mode is read-only.");
  }

  const filteredVariants = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    return snapshot.variants.filter((variant) => {
      if (view.name === "set" && variant.card.set.slug !== view.slug) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
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
    });
  }, [query, snapshot, view]);

  if (status === "loading") {
    return (
      <section className="neon-panel rounded-lg p-6 text-slate-300">
        Loading offline snapshot...
      </section>
    );
  }

  if (status === "empty" || !snapshot) {
    return (
      <section className="neon-panel rounded-lg p-6">
        <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Offline card show mode</p>
        <h1 className="mt-2 text-3xl font-black text-white">No offline snapshot yet</h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          Open the collection while online once, then this device will save a read-only snapshot for card show browsing.
        </p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="neon-panel rounded-lg p-6">
        <h1 className="text-3xl font-black text-white">Offline snapshot unavailable</h1>
        <p className="mt-3 text-slate-400">The saved snapshot could not be read on this device.</p>
      </section>
    );
  }

  const selectedCard = view.name === "card" ? snapshot.variants.find((variant) => variant.id === view.id) : null;
  const selectedSet = view.name === "set" ? snapshot.sets.find((set) => set.slug === view.slug) : null;

  return (
    <div className="space-y-6">
      <section className="neon-panel rounded-lg p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Offline card show mode</p>
            <h1 className="mt-1 text-3xl font-black text-white">Cached collection snapshot</h1>
            <p className="mt-2 text-sm text-slate-400">
              Showing read-only data cached {formatTimestamp(snapshot.generatedAt)}. Live edits require a connection.
            </p>
          </div>
          <div className={`rounded-md border px-3 py-2 text-sm font-black ${online ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`}>
            {online ? "Online available" : "Offline snapshot"}
          </div>
        </div>
        {blockedMessage ? (
          <p className="mt-4 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-100">
            {blockedMessage}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary rounded-md px-3 py-2 text-xs font-black" onClick={() => navigate({ name: "dashboard" })}>
            Dashboard
          </button>
          <button type="button" className="btn-secondary rounded-md px-3 py-2 text-xs font-black" onClick={() => navigate({ name: "sets" })}>
            Sets
          </button>
          <button type="button" className="btn-secondary rounded-md px-3 py-2 text-xs font-black" onClick={() => navigate({ name: "cards" })}>
            Cards
          </button>
        </div>
      </section>

      {view.name === "dashboard" ? (
        <OfflineDashboard snapshot={snapshot} navigate={navigate} />
      ) : null}

      {view.name === "sets" ? (
        <OfflineSets snapshot={snapshot} navigate={navigate} />
      ) : null}

      {view.name === "cards" || view.name === "set" ? (
        <OfflineCards
          title={selectedSet ? selectedSet.name : "All cards"}
          query={query}
          setQuery={setQuery}
          variants={filteredVariants}
          navigate={navigate}
          blockEdit={blockEdit}
        />
      ) : null}

      {view.name === "card" && selectedCard ? (
        <OfflineCardDetail variant={selectedCard} blockEdit={blockEdit} />
      ) : null}
    </div>
  );
}

function OfflineDashboard({
  snapshot,
  navigate,
}: {
  snapshot: OfflineSnapshot;
  navigate: (view: OfflineView) => void;
}) {
  const summary = snapshot.dashboard.summary;

  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <OfflineStat label="Owned" value={String(summary.ownedVariants)} />
        <OfflineStat label="Missing" value={String(summary.missingVariants)} />
        <OfflineStat label="Collected value" value={formatCurrency(summary.estimatedCollectionValue)} />
        <OfflineStat label="Remaining cost" value={formatCurrency(summary.estimatedRemainingCost)} />
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {snapshot.dashboard.setMetrics.slice(0, 6).map((metric) => (
          <button
            key={metric.set.slug}
            type="button"
            className="neon-panel neon-panel-hover rounded-lg p-5 text-left"
            onClick={() => navigate({ name: "set", slug: metric.set.slug })}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-black text-white">{metric.set.name}</h2>
              <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-xs font-black text-cyan-100">
                {metric.owned}/{metric.total}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-400">
              {Math.round(metric.completion)}% complete - {metric.missing} missing
            </p>
            <p className="mt-3 text-sm font-bold text-amber-100">Remaining {formatCurrency(metric.remainingValue)}</p>
          </button>
        ))}
      </section>
    </>
  );
}

function OfflineSets({
  snapshot,
  navigate,
}: {
  snapshot: OfflineSnapshot;
  navigate: (view: OfflineView) => void;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {snapshot.dashboard.setMetrics.map((metric) => (
        <button
          key={metric.set.slug}
          type="button"
          className="neon-panel neon-panel-hover rounded-lg p-5 text-left"
          onClick={() => navigate({ name: "set", slug: metric.set.slug })}
        >
          <h2 className="text-xl font-black text-white">{metric.set.name}</h2>
          <p className="mt-2 text-sm font-semibold text-slate-400">
            {metric.owned}/{metric.total} owned - {Math.round(metric.completion)}% complete
          </p>
          <p className="mt-3 text-sm text-slate-400">
            Owned {formatCurrency(metric.ownedValue)} - Remaining {formatCurrency(metric.remainingValue)}
          </p>
        </button>
      ))}
    </section>
  );
}

function OfflineCards({
  title,
  query,
  setQuery,
  variants,
  navigate,
  blockEdit,
}: {
  title: string;
  query: string;
  setQuery: (query: string) => void;
  variants: OfflineVariant[];
  navigate: (view: OfflineView) => void;
  blockEdit: () => void;
}) {
  return (
    <section className="neon-panel overflow-hidden rounded-lg">
      <div className="border-b border-cyan-300/10 bg-slate-950/[0.62] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Read-only cards</p>
            <h2 className="mt-1 text-xl font-black text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">Showing {variants.length} cached cards</p>
          </div>
          <label className="block lg:min-w-80">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, number, set, notes"
              className="field-control mt-1 h-10 w-full rounded-md px-3 text-sm text-white outline-none transition placeholder:text-slate-600"
            />
          </label>
        </div>
      </div>
      <div className="collection-grid grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {variants.map((variant) => {
          const owned = hasOfflineOwnedCopy(variant);
          const primaryCopy = getOfflinePrimaryCopy(variant);
          return (
            <article
              key={variant.id}
              className={`collection-card relative flex min-h-[24rem] flex-col overflow-hidden rounded-lg border p-4 ${
                owned ? "border-cyan-300/25 bg-cyan-300/[0.055]" : "border-white/[0.08] bg-slate-950/[0.48]"
              }`}
            >
              <div className="grid grid-cols-[7rem_1fr] gap-4">
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
                <div>
                  <p className="font-mono text-xs font-bold text-cyan-100/65">#{variant.card.cardNumber}</p>
                  <h3 className="mt-2 text-xl font-black leading-tight text-white">{variant.card.name}</h3>
                  <p className="mt-2 text-sm font-semibold text-slate-400">{variant.card.set.name}</p>
                  <p className="mt-3 text-sm font-black text-amber-100">{formatMarketPrice(getOfflineMarketPrice(variant))}</p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-white/[0.07] py-3 text-sm">
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-wide text-slate-600">Status</dt>
                  <dd className="mt-1 font-semibold text-slate-300">{owned ? "Owned" : "Missing"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-wide text-slate-600">Condition</dt>
                  <dd className="mt-1 font-semibold text-slate-300">{formatEnumLabel(primaryCopy?.condition)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-wide text-slate-600">Paid</dt>
                  <dd className="mt-1 font-semibold text-slate-300">{primaryCopy?.purchasePrice ? formatCurrency(primaryCopy.purchasePrice) : "-"}</dd>
                </div>
              </dl>
              <div className="mt-auto flex gap-2 pt-4">
                <button type="button" className="btn-primary flex-1 rounded-md px-3 py-2 text-xs font-black" onClick={() => navigate({ name: "card", id: variant.id })}>
                  View details
                </button>
                <button type="button" className="btn-secondary flex-1 rounded-md px-3 py-2 text-xs font-black" onClick={blockEdit}>
                  Edit online
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function OfflineCardDetail({ variant, blockEdit }: { variant: OfflineVariant; blockEdit: () => void }) {
  const owned = hasOfflineOwnedCopy(variant);
  const primaryCopy = getOfflinePrimaryCopy(variant);
  const notes = primaryCopy?.notes || variant.notes;

  return (
    <section className="card-detail-showcase neon-panel overflow-hidden rounded-lg">
      <div className="card-detail-artwork-stage">
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
      </div>
      <div className="card-detail-record">
        <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Read-only cached card</p>
        <p className="mt-2 text-sm font-bold uppercase tracking-widest text-slate-500">
          {variant.card.set.name} / No. {variant.card.cardNumber}
        </p>
        <h1 className="mt-2 text-4xl font-black leading-none text-white sm:text-5xl">{variant.card.name}</h1>
        <dl className="card-detail-metrics mt-7 grid gap-px overflow-hidden rounded-lg sm:grid-cols-2">
          <div><dt>Status</dt><dd>{owned ? "In collection" : "Missing"}</dd></div>
          <div><dt>Condition</dt><dd>{formatEnumLabel(primaryCopy?.condition)}</dd></div>
          <div><dt>Estimated market value</dt><dd>{formatMarketPrice(getOfflineMarketPrice(variant))}</dd></div>
          <div><dt>Acquisition cost</dt><dd>{primaryCopy?.purchasePrice ? formatCurrency(primaryCopy.purchasePrice) : "Not recorded"}</dd></div>
        </dl>
        <div className="card-detail-provenance mt-7">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Collection notes</p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {notes || (owned ? "No collector notes have been recorded for this copy." : "This card has not yet been added to the collection.")}
          </p>
        </div>
        <button type="button" className="btn-secondary mt-6 rounded-md px-4 py-3 text-sm font-black" onClick={blockEdit}>
          Edits require connection
        </button>
      </div>
    </section>
  );
}

function OfflineStat({ label, value }: { label: string; value: string }) {
  return (
    <section className="neon-panel rounded-lg p-5">
      <p className="text-sm font-semibold text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </section>
  );
}
