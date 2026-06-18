"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CardArtwork } from "@/components/CardArtwork";
import {
  clearPendingMutationDebugStores,
  enqueueLatestMarketPriceMutation,
  enqueueLatestSetOwnedMutation,
  listAllPendingMutationDebugRecords,
  listOfflineMutationDebugEvents,
  listPendingMutations,
  loadOfflineSnapshot,
} from "@/lib/offline-storage";
import { syncPendingOfflineMutations } from "@/lib/offline-sync";
import { applyLocalMutationAndPersist, type OfflineMutation } from "@/lib/offline-mutations";
import {
  getOfflineMarketPrice,
  getOfflinePrimaryCopy,
  hasOfflineOwnedCopy,
  type OfflineSetMetric,
  type OfflineSnapshot,
  type OfflineVariant,
} from "@/lib/offline-snapshot";
import { formatCurrency, formatMarketPrice, formatPercent } from "@/lib/format";
import { ProgressDonut } from "@/components/ProgressDonut";
import { compareRarity, rarityToken } from "@/lib/rarity";

type OfflineView =
  | { name: "dashboard" }
  | { name: "sets" }
  | { name: "set"; slug: string }
  | { name: "cards" }
  | { name: "card"; id: number };

type OfflineLoadStatus = "loading" | "ready" | "empty" | "error";
type ManualSyncStatus = "idle" | "syncing" | "synced" | "failed";
type OwnedFilter = "all" | "owned" | "missing";
type SortKey = "checklist" | "name" | "rarity" | "owned" | "value";

type OfflineDebugInfo = {
  currentPath: string;
  snapshotLoaded: boolean;
  schemaVersion: string;
  generatedAt: string;
  sets: number;
  cards: number;
  variants: number;
  status: OfflineLoadStatus;
  serviceWorkerControlled: boolean;
  serviceWorkerDebug: string;
  error?: string;
};

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

function cardNumberValue(cardNumber: string) {
  const [number] = cardNumber.split("/");
  return Number(number) || 0;
}

function offlineGradingLabel(variant: OfflineVariant) {
  const primaryCopy = getOfflinePrimaryCopy(variant);
  if (!primaryCopy) {
    return "-";
  }

  return `${formatEnumLabel(primaryCopy.gradingCompany)}${primaryCopy.grade ? ` ${primaryCopy.grade}` : ""}`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "unknown time";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function initialView(): OfflineView {
  if (typeof window === "undefined") {
    return { name: "dashboard" };
  }

  const params = new URLSearchParams(window.location.search);
  const cardId = Number(params.get("card"));
  if (Number.isInteger(cardId) && cardId > 0) {
    return { name: "card", id: cardId };
  }

  const setSlug = params.get("set");
  if (setSlug) {
    return { name: "set", slug: setSlug };
  }

  const view = params.get("view");
  if (view === "cards") {
    return { name: "cards" };
  }

  if (view === "sets") {
    return { name: "sets" };
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
  const [status, setStatus] = useState<OfflineLoadStatus>("loading");
  const [online, setOnline] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState("");
  const [localMessage, setLocalMessage] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [syncStatus, setSyncStatus] = useState<ManualSyncStatus>("idle");
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingMutationCount, setPendingMutationCount] = useState(0);
  const [debugPendingMutations, setDebugPendingMutations] = useState<OfflineMutation[]>([]);
  const [debugRawPendingMutations, setDebugRawPendingMutations] = useState<OfflineMutation[]>([]);
  const [debugMessage, setDebugMessage] = useState("");
  const [debugPendingCountEvents, setDebugPendingCountEvents] = useState<string[]>([]);
  const [debugEnqueueEvents, setDebugEnqueueEvents] = useState<ReturnType<typeof listOfflineMutationDebugEvents>>([]);
  const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
  const [editingPriceVariantId, setEditingPriceVariantId] = useState<number | null>(null);
  const [currentPath, setCurrentPath] = useState("/");
  const [loadError, setLoadError] = useState("");
  const [serviceWorkerDebug, setServiceWorkerDebug] = useState("");
  const [serviceWorkerControlled, setServiceWorkerControlled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setCurrentPath(window.location.pathname);
    setView(initialView());
    setOnline(navigator.onLine);
    setServiceWorkerControlled(Boolean(navigator.serviceWorker?.controller));

    try {
      setServiceWorkerDebug(window.localStorage.getItem("pokemonServiceWorkerDebug") ?? "");
    } catch {
      setServiceWorkerDebug("Service worker debug storage unavailable.");
    }

    function handleOnline() {
      setOnline(true);
    }

    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    function handleControllerChange() {
      setServiceWorkerControlled(Boolean(navigator.serviceWorker?.controller));
      try {
        setServiceWorkerDebug(window.localStorage.getItem("pokemonServiceWorkerDebug") ?? "");
      } catch {
        setServiceWorkerDebug("Service worker debug storage unavailable.");
      }
    }

    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);

    async function refreshPendingMutationCountOnLoad() {
      try {
        const pendingMutations = await listPendingMutations();
        const rawPendingMutations = await listAllPendingMutationDebugRecords();
        if (!cancelled) {
          setPendingMutationCount(pendingMutations.length);
          setDebugPendingMutations(pendingMutations);
          setDebugRawPendingMutations(rawPendingMutations);
          setDebugPendingCountEvents((events) => [
            ...events,
            `${new Date().toISOString()} initial load count=${pendingMutations.length} raw=${rawPendingMutations.length}`,
          ].slice(-10));
          setDebugEnqueueEvents(listOfflineMutationDebugEvents());
        }
      } catch {
        if (!cancelled) {
          setPendingMutationCount(0);
          setDebugPendingCountEvents((events) => [
            ...events,
            `${new Date().toISOString()} initial load count failed`,
          ].slice(-10));
        }
      }
    }

    loadOfflineSnapshot()
      .then((loadedSnapshot) => {
        setSnapshot(loadedSnapshot);
        setStatus(loadedSnapshot ? "ready" : "empty");
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : "Unknown IndexedDB error");
        setStatus("error");
      });
    refreshPendingMutationCountOnLoad();

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  function navigate(nextView: OfflineView) {
    setBlockedMessage("");
    setLocalMessage("");
    if (syncStatus !== "syncing") {
      setSyncMessage("");
      setSyncStatus("idle");
    }
    setView(nextView);
  }

  function blockEdit() {
    setBlockedMessage("Connect to edit. Viewing local collection data.");
  }

  async function refreshPendingMutationCount() {
    const pendingMutations = await listPendingMutations();
    const rawPendingMutations = await listAllPendingMutationDebugRecords();
    setPendingMutationCount(pendingMutations.length);
    setDebugPendingMutations(pendingMutations);
    setDebugRawPendingMutations(rawPendingMutations);
    setDebugPendingCountEvents((events) => [
      ...events,
      `${new Date().toISOString()} refresh count=${pendingMutations.length} raw=${rawPendingMutations.length}`,
    ].slice(-10));
    setDebugEnqueueEvents(listOfflineMutationDebugEvents());
    return pendingMutations.length;
  }

  async function listPendingMutationsForDebug() {
    const pendingMutations = await listPendingMutations();
    const rawPendingMutations = await listAllPendingMutationDebugRecords();
    setDebugPendingMutations(pendingMutations);
    setDebugRawPendingMutations(rawPendingMutations);
    setDebugEnqueueEvents(listOfflineMutationDebugEvents());
    setDebugMessage(
      pendingMutations.length === 0 && rawPendingMutations.length === 0
        ? "No pending local mutations."
        : `${pendingMutations.length} active pending mutation${pendingMutations.length === 1 ? "" : "s"}; ${rawPendingMutations.length} raw pending row${rawPendingMutations.length === 1 ? "" : "s"}.`,
    );
  }

  async function clearPendingMutationsForDebug() {
    await clearPendingMutationDebugStores();
    setDebugPendingMutations([]);
    setDebugRawPendingMutations([]);
    setDebugMessage("Pending local mutations cleared. Snapshot was not changed.");
    await refreshPendingMutationCount();
  }

  async function toggleOfflineOwned(variant: OfflineVariant, owned: boolean) {
    if (!snapshot || editingVariantId !== null) {
      return;
    }

    const primaryCopy = getOfflinePrimaryCopy(variant);
    setBlockedMessage("");
    setLocalMessage("");
    setEditingVariantId(variant.id);

    try {
      const mutation = await enqueueLatestSetOwnedMutation({
        type: "SET_OWNED",
        debugContext: "OfflineModeClient.toggleOfflineOwned",
        baseSnapshotGeneratedAt: snapshot.generatedAt,
        payload: {
          variantId: variant.id,
          setSlug: variant.card.set.slug,
          owned,
          primaryCollectionItemId: primaryCopy?.id ?? null,
          oldStatus: primaryCopy?.status ?? null,
          newStatus: owned ? "OWNED" : "MISSING",
        },
      });
      const updatedSnapshot = await applyLocalMutationAndPersist(mutation);
      setSnapshot(updatedSnapshot);
      const pendingCount = await refreshPendingMutationCount();
      setLocalMessage(pendingCount === 1 ? "Saved locally · pending sync" : `${pendingCount} changes pending sync`);
    } catch (error) {
      await refreshPendingMutationCount().catch(() => undefined);
      setBlockedMessage(error instanceof Error ? error.message : "Local ownership edit could not be saved.");
    } finally {
      setEditingVariantId(null);
    }
  }

  async function updateOfflineMarketPrice(variant: OfflineVariant, value: number) {
    if (!snapshot || editingPriceVariantId !== null) {
      return;
    }

    setBlockedMessage("");
    setLocalMessage("");
    setEditingPriceVariantId(variant.id);

    try {
      const oldMarketPrice = getOfflineMarketPrice(variant);
      const mutation = await enqueueLatestMarketPriceMutation({
        type: "UPDATE_MARKET_PRICE",
        debugContext: "OfflineModeClient.updateOfflineMarketPrice",
        baseSnapshotGeneratedAt: snapshot.generatedAt,
        payload: {
          variantId: variant.id,
          setSlug: variant.card.set.slug,
          oldEstimatedValue: variant.estimatedValue,
          newEstimatedValue: value,
          oldMarketPrice,
          newMarketPrice: value,
          marketPriceSource: "MANUAL_APP_EDIT",
          marketPriceStatus: "MANUAL",
        },
      });
      const updatedSnapshot = await applyLocalMutationAndPersist(mutation);
      setSnapshot(updatedSnapshot);
      const pendingCount = await refreshPendingMutationCount();
      setLocalMessage(pendingCount === 1 ? "Saved locally · pending sync" : `${pendingCount} changes pending sync`);
    } catch (error) {
      await refreshPendingMutationCount().catch(() => undefined);
      setBlockedMessage(error instanceof Error ? error.message : "Local price edit could not be saved.");
    } finally {
      setEditingPriceVariantId(null);
    }
  }

  async function syncPendingMutations() {
    if (isSyncing || !online || !snapshot) {
      return;
    }

    setBlockedMessage("");
    setLocalMessage("");
    setSyncMessage("Syncing...");
    setSyncStatus("syncing");
    setIsSyncing(true);

    try {
      const result = await syncPendingOfflineMutations();
      if (result.freshSnapshot) {
        setSnapshot(result.freshSnapshot);
      }
      if (result.snapshotRefreshError) {
        setDebugMessage(`Sync succeeded, but snapshot refresh failed: ${result.snapshotRefreshError}`);
      }

      if (result.status === "synced") {
        setSyncMessage(result.message);
        setSyncStatus("synced");
      } else {
        setSyncMessage(result.message);
        setSyncStatus("failed");
      }
    } catch (error) {
      setSyncMessage("Sync failed - changes still saved locally");
      setSyncStatus("failed");
    } finally {
      await refreshPendingMutationCount().catch(() => undefined);
      setIsSyncing(false);
    }
  }

  const filteredVariants = useMemo(() => {
    if (!snapshot || !Array.isArray(snapshot.variants)) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    const setSlugExists =
      view.name !== "set" || snapshot.sets.some((set) => set.slug === view.slug);
    return snapshot.variants.filter((variant) => {
      const card = variant.card;
      const set = card?.set;

      if (!card || !set) {
        return false;
      }

      if (view.name === "set" && setSlugExists && set.slug !== view.slug) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        card.name,
        card.cardNumber,
        card.rarity,
        set.name,
        variant.notes,
        ...(Array.isArray(variant.ownedItems) ? variant.ownedItems.map((item) => item.notes) : []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [query, snapshot, view]);

  const debugInfo: OfflineDebugInfo = {
    currentPath,
    snapshotLoaded: Boolean(snapshot),
    schemaVersion: snapshot ? String(snapshot.schemaVersion) : "-",
    generatedAt: snapshot?.generatedAt ?? "-",
    sets: snapshot?.counts?.sets ?? snapshot?.sets?.length ?? 0,
    cards: snapshot?.counts?.cards ?? snapshot?.cards?.length ?? 0,
    variants: snapshot?.counts?.variants ?? snapshot?.variants?.length ?? 0,
    status,
    serviceWorkerControlled,
    serviceWorkerDebug,
    error: loadError || undefined,
  };

  if (status === "loading") {
    return (
      <section className="neon-panel rounded-lg p-6 text-slate-300">
        Loading offline snapshot...
        <OfflineDebugPanel
          debugInfo={debugInfo}
          pendingMutations={debugPendingMutations}
          rawPendingMutations={debugRawPendingMutations}
          pendingCountEvents={debugPendingCountEvents}
          enqueueEvents={debugEnqueueEvents}
          debugMessage={debugMessage}
          onListPendingMutations={listPendingMutationsForDebug}
          onClearPendingMutations={clearPendingMutationsForDebug}
        />
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="neon-panel rounded-lg p-6">
        <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Offline card show mode</p>
        <h1 className="mt-2 text-3xl font-black text-white">Offline snapshot unavailable</h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          Offline snapshot unavailable. Open the app online once before using offline mode.
        </p>
        {loadError ? <p className="mt-3 text-sm text-amber-100">{loadError}</p> : null}
        <OfflineDebugPanel
          debugInfo={debugInfo}
          pendingMutations={debugPendingMutations}
          rawPendingMutations={debugRawPendingMutations}
          pendingCountEvents={debugPendingCountEvents}
          enqueueEvents={debugEnqueueEvents}
          debugMessage={debugMessage}
          onListPendingMutations={listPendingMutationsForDebug}
          onClearPendingMutations={clearPendingMutationsForDebug}
        />
      </section>
    );
  }

  if (status === "empty" || !snapshot) {
    return (
      <section className="neon-panel rounded-lg p-6">
        <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Offline card show mode</p>
        <h1 className="mt-2 text-3xl font-black text-white">Offline snapshot unavailable</h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          Offline snapshot unavailable. Open the app online once before using offline mode.
        </p>
        <OfflineDebugPanel
          debugInfo={debugInfo}
          pendingMutations={debugPendingMutations}
          rawPendingMutations={debugRawPendingMutations}
          pendingCountEvents={debugPendingCountEvents}
          enqueueEvents={debugEnqueueEvents}
          debugMessage={debugMessage}
          onListPendingMutations={listPendingMutationsForDebug}
          onClearPendingMutations={clearPendingMutationsForDebug}
        />
      </section>
    );
  }

  const selectedCard = view.name === "card" ? snapshot.variants.find((variant) => variant.id === view.id) : null;
  const selectedSet = view.name === "set" ? snapshot.sets.find((set) => set.slug === view.slug) : null;
  const effectiveView: OfflineView =
    (view.name === "card" && !selectedCard) || (view.name === "set" && !selectedSet)
      ? { name: "cards" }
      : view;
  const routeFallbackMessage =
    effectiveView !== view
      ? "The cached snapshot could not match this route, so offline mode is showing the card list instead."
      : "";

  return (
    <div className="space-y-6">
      <section className="neon-panel rounded-lg px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-full border px-3 py-1 font-black ${online ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"}`}>
              Local data
            </span>
            <span className="font-semibold text-slate-300">Last synced {formatTimestamp(snapshot.generatedAt)}</span>
            {pendingMutationCount > 0 ? (
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 font-black text-amber-100">
                {pendingMutationCount === 1 ? "1 change pending sync" : `${pendingMutationCount} changes pending sync`}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {online && pendingMutationCount > 0 ? (
              <button
                type="button"
                className="btn-primary rounded-md px-3 py-2 text-xs font-black"
                disabled={isSyncing}
                onClick={() => {
                  syncPendingMutations().catch(() => undefined);
                }}
              >
                {isSyncing ? "Syncing..." : "Sync pending changes"}
              </button>
            ) : null}
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
        </div>
        {blockedMessage ? (
          <p className="mt-4 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-100">
            {blockedMessage}
          </p>
        ) : null}
        {localMessage ? (
          <p className="mt-4 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm font-bold text-emerald-100">
            {localMessage}
          </p>
        ) : null}
        {syncMessage ? (
          <p className={`mt-4 rounded-md border px-3 py-2 text-sm font-bold ${
            syncStatus === "failed"
              ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
              : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
          }`}>
            {syncMessage}
          </p>
        ) : null}
        {routeFallbackMessage ? (
          <p className="mt-4 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm font-bold text-cyan-100">
            {routeFallbackMessage}
          </p>
        ) : null}
        <OfflineDebugPanel
          debugInfo={debugInfo}
          pendingMutations={debugPendingMutations}
          rawPendingMutations={debugRawPendingMutations}
          pendingCountEvents={debugPendingCountEvents}
          enqueueEvents={debugEnqueueEvents}
          debugMessage={debugMessage}
          onListPendingMutations={listPendingMutationsForDebug}
          onClearPendingMutations={clearPendingMutationsForDebug}
        />
      </section>

      {effectiveView.name === "dashboard" ? (
        <OfflineDashboard snapshot={snapshot} navigate={navigate} />
      ) : null}

      {effectiveView.name === "sets" ? (
        <OfflineSets snapshot={snapshot} navigate={navigate} />
      ) : null}

      {effectiveView.name === "cards" || effectiveView.name === "set" ? (
        <OfflineCards
          title={effectiveView.name === "set" && selectedSet ? selectedSet.name : "All cards"}
          query={query}
          setQuery={setQuery}
          variants={filteredVariants}
          navigate={navigate}
          toggleOfflineOwned={toggleOfflineOwned}
          editingVariantId={editingVariantId}
        />
      ) : null}

      {effectiveView.name === "card" && selectedCard ? (
        <OfflineCardDetail
          variant={selectedCard}
          blockEdit={blockEdit}
          toggleOfflineOwned={toggleOfflineOwned}
          editingVariantId={editingVariantId}
          updateOfflineMarketPrice={updateOfflineMarketPrice}
          editingPriceVariantId={editingPriceVariantId}
        />
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
  const activeSets = snapshot.dashboard.setMetrics.filter((metric) => metric.owned > 0).length;
  const holoOwned = snapshot.dashboard.setMetrics.reduce((total, metric) => total + metric.holoOwned, 0);
  const holoTotal = snapshot.dashboard.setMetrics.reduce((total, metric) => total + metric.holoTotal, 0);
  const leadingSet = [...snapshot.dashboard.setMetrics].sort((a, b) => b.completion - a.completion)[0];

  return (
    <>
      <section className="neon-panel command-hero rounded-lg p-0">
        <div className="relative overflow-hidden rounded-lg">
          <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-cyan-300 via-fuchsia-300 to-amber-300 opacity-80" />
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-cyan-300/15 px-5 py-4 sm:px-7">
            <div>
              <p className="neon-eyebrow text-base font-black uppercase tracking-widest">Local portfolio console</p>
              <h1 className="mt-1.5 text-3xl font-black text-white sm:text-4xl">1st Edition Vintage Collection</h1>
            </div>
            <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 text-lg font-black uppercase tracking-wide text-amber-100 shadow-amber">
              {Math.round(summary.completion)}% complete
            </div>
          </div>

          <div className="grid gap-5 px-5 py-5 sm:gap-8 sm:px-7 sm:py-6 lg:grid-cols-[19rem_1fr] lg:items-center">
            <div className="flex justify-center lg:justify-start">
              <div className="rounded-lg border border-cyan-300/25 bg-slate-950/[0.68] p-2.5 shadow-[0_24px_70px_rgba(0,0,0,0.38),0_0_48px_rgba(34,211,238,0.14)] sm:p-4">
                <ProgressDonut value={summary.completion} label="complete" />
              </div>
            </div>

            <div className="grid gap-6 sm:gap-8 md:grid-cols-[1fr_0.95fr]">
              <div>
                <p className="text-xl font-black uppercase tracking-widest text-cyan-100/90">Collection status</p>
                <div className="neon-divider mt-3 max-w-lg" />
                <dl className="mt-4 space-y-3 text-xl font-black uppercase tracking-wide sm:mt-5 sm:space-y-5 sm:text-2xl">
                  {[
                    ["Owned", summary.ownedVariants],
                    ["Missing", summary.missingVariants],
                    ["Total targets", summary.totalVariants],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 sm:grid-cols-[11rem_1fr_auto] sm:gap-4">
                      <dt className="text-slate-200">{label}</dt>
                      <dd className="h-px bg-gradient-to-r from-cyan-300/45 via-fuchsia-300/25 to-transparent" />
                      <dd className="text-2xl text-white sm:text-3xl">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <p className="text-xl font-black uppercase tracking-widest text-amber-100/90">Collection value</p>
                <div className="neon-divider mt-3 max-w-lg" />
                <dl className="mt-4 space-y-3 text-xl font-black uppercase tracking-wide sm:mt-5 sm:space-y-5 sm:text-2xl">
                  <div className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 sm:grid-cols-[11rem_1fr_auto] sm:gap-4">
                    <dt className="text-slate-200">Collected</dt>
                    <dd className="h-px bg-gradient-to-r from-emerald-300/45 via-cyan-300/25 to-transparent" />
                    <dd className="text-2xl text-emerald-100 sm:text-3xl">{formatCurrency(summary.estimatedCollectionValue)}</dd>
                  </div>
                  <div className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 sm:grid-cols-[11rem_1fr_auto] sm:gap-4">
                    <dt className="text-slate-200">Remaining</dt>
                    <dd className="h-px bg-gradient-to-r from-amber-300/45 via-fuchsia-300/25 to-transparent" />
                    <dd className="text-2xl text-amber-100 sm:text-3xl">{formatCurrency(summary.estimatedRemainingCost)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-sm normal-case tracking-normal text-slate-400">
                    <span>{summary.pricedVariants} / {summary.totalVariants} cards priced</span>
                    <span className="font-bold text-cyan-100/80">Local snapshot</span>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <OfflineStat label="Active sets" value={`${activeSets}/${snapshot.sets.length}`} helper="Sets with at least one owned card" />
        <OfflineStat label="Holo progress" value={`${holoOwned}/${holoTotal}`} helper="Rare holo targets collected" />
        <OfflineStat label="Leading set" value={leadingSet?.set.name ?? "None"} helper={leadingSet ? `${Math.round(leadingSet.completion)}% complete` : "No set progress yet"} />
        <OfflineStat label="Recent additions" value={String(snapshot.dashboard.recentItems.length)} helper="Latest owned inventory records" />
      </section>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Display vault</p>
          <h2 className="mt-1 text-xl font-black text-white">Set progress</h2>
        </div>
        <button type="button" className="text-sm font-bold text-cyan-300 hover:text-white" onClick={() => navigate({ name: "sets" })}>
          View all
        </button>
      </div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {snapshot.dashboard.setMetrics.slice(0, 6).map((metric) => (
          <OfflineSetProgressButton key={metric.set.slug} metric={metric} navigate={navigate} />
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
        <OfflineSetProgressButton key={metric.set.slug} metric={metric} navigate={navigate} />
      ))}
    </section>
  );
}

function OfflineSetProgressButton({
  metric,
  navigate,
}: {
  metric: OfflineSetMetric;
  navigate: (view: OfflineView) => void;
}) {
  const visualCompletion = metric.completion > 0 ? Math.max(2.5, Math.min(100, metric.completion)) : 0;

  return (
    <button
      type="button"
      className="neon-panel neon-panel-hover group rounded-lg p-5 text-left"
      onClick={() => navigate({ name: "set", slug: metric.set.slug })}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 opacity-70" />
      <div className="flex min-h-8 items-start justify-between gap-4">
        <h2 className="text-xl font-black leading-tight text-white">{metric.set.name}</h2>
        <span className="shrink-0 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-xs font-black text-cyan-100 shadow-glow">
          {metric.owned}/{metric.total || 0}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="shrink-0 rounded-lg border border-cyan-300/15 bg-slate-950/55 p-1.5 shadow-glow">
          <div
            className="grid size-12 place-items-center rounded-md text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.24)] ring-1 ring-white/25"
            style={{ backgroundColor: metric.set.color }}
            title={metric.set.symbolLabel}
          >
            {metric.set.symbol}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-300">{metric.set.releaseYear}</p>
          <p className="mt-0.5 text-sm text-slate-500">{metric.set.totalCards} total cards</p>
        </div>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-950/80 shadow-inner shadow-black/50 ring-1 ring-white/10">
        <div
          className="h-full min-w-px rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.4)] transition-all duration-500"
          style={{ width: `${visualCompletion}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <p className="font-semibold text-cyan-100">{formatPercent(metric.completion)} complete</p>
        <p className="font-semibold text-slate-500">{metric.missing} missing</p>
      </div>
      <div className="neon-divider mt-4" />
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Priced owned</p>
          <p className="mt-1 font-black text-white">{formatCurrency(metric.ownedValue)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Priced missing</p>
          <p className="mt-1 font-black text-white">{formatCurrency(metric.remainingValue)}</p>
        </div>
        <p className="col-span-2 text-xs font-semibold text-slate-500">{metric.priced} / {metric.total} cards priced</p>
        <div className="col-span-2 flex items-center justify-between rounded-md border border-fuchsia-300/20 bg-fuchsia-400/[0.07] px-3 py-2 text-xs font-bold text-fuchsia-100">
          <span>Holo progress</span>
          <span>{metric.holoOwned}/{metric.holoTotal}</span>
        </div>
      </div>
    </button>
  );
}

function OfflineCards({
  title,
  query,
  setQuery,
  variants,
  navigate,
  toggleOfflineOwned,
  editingVariantId,
}: {
  title: string;
  query: string;
  setQuery: (query: string) => void;
  variants: OfflineVariant[];
  navigate: (view: OfflineView) => void;
  toggleOfflineOwned: (variant: OfflineVariant, owned: boolean) => void;
  editingVariantId: number | null;
}) {
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("checklist");

  const rarityOptions = useMemo(
    () => Array.from(new Set(variants.map((variant) => variant.card.rarity))).sort(compareRarity),
    [variants],
  );

  const displayedVariants = useMemo(() => {
    return variants
      .filter((variant) => {
        const owned = hasOfflineOwnedCopy(variant);
        const matchesOwned = ownedFilter === "all" || (ownedFilter === "owned" ? owned : !owned);
        const matchesRarity = rarityFilter === "all" || variant.card.rarity === rarityFilter;

        return matchesOwned && matchesRarity;
      })
      .sort((a, b) => {
        if (sortKey === "name") {
          return a.card.name.localeCompare(b.card.name);
        }

        if (sortKey === "rarity") {
          return (
            compareRarity(a.card.rarity, b.card.rarity) ||
            cardNumberValue(a.card.cardNumber) - cardNumberValue(b.card.cardNumber)
          );
        }

        if (sortKey === "owned") {
          return Number(hasOfflineOwnedCopy(b)) - Number(hasOfflineOwnedCopy(a));
        }

        if (sortKey === "value") {
          const aPrice = getOfflineMarketPrice(a);
          const bPrice = getOfflineMarketPrice(b);
          if (aPrice === null && bPrice !== null) return 1;
          if (aPrice !== null && bPrice === null) return -1;
          if (aPrice !== null && bPrice !== null) return bPrice - aPrice;
          return 0;
        }

        if (a.card.set.name !== b.card.set.name) {
          return a.card.set.name.localeCompare(b.card.set.name);
        }

        return cardNumberValue(a.card.cardNumber) - cardNumberValue(b.card.cardNumber);
      });
  }, [ownedFilter, rarityFilter, sortKey, variants]);

  const visibleOwned = displayedVariants.filter(hasOfflineOwnedCopy).length;

  return (
    <section className="neon-panel overflow-hidden rounded-lg">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 opacity-70" />
      <div className="border-b border-cyan-300/10 bg-slate-950/[0.62] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Local inventory console</p>
            <h2 className="mt-1 text-lg font-black text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Showing {displayedVariants.length} of {variants.length} cached cards, {visibleOwned} owned
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
        {displayedVariants.map((variant) => {
          const owned = hasOfflineOwnedCopy(variant);
          const primaryCopy = getOfflinePrimaryCopy(variant);
          const marketPrice = getOfflineMarketPrice(variant);
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
              <div className={`rarity-edge rarity-${rarityToken(variant.card.rarity)} ${owned ? "is-owned" : "is-missing"}`} />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Local archive record</p>
                  <p className="mt-1 truncate text-xs font-bold text-slate-400">{variant.card.set.name}</p>
                </div>
                <span className={`ownership-badge ${owned ? "is-owned" : "is-missing"}`}>
                  <span className="ownership-badge-dot" aria-hidden="true" />
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
                    <span className={`rarity-badge rarity-${rarityToken(variant.card.rarity)}`}>
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
                  <dd className="mt-1 font-semibold text-slate-300">{offlineGradingLabel(variant)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-wide text-slate-600">Market</dt>
                  <dd className={`mt-1 font-black ${marketPrice !== null ? "text-white" : "text-slate-600"}`}>
                    {formatMarketPrice(marketPrice)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-wide text-slate-600">Paid</dt>
                  <dd className="mt-1 font-semibold text-slate-300">{primaryCopy?.purchasePrice ? formatCurrency(primaryCopy.purchasePrice) : "-"}</dd>
                </div>
              </dl>
              <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-relaxed text-slate-500">
                {notes || (owned ? "No collector notes yet." : "Not yet added to the collection.")}
              </p>
              <div className="mt-auto flex gap-2 pt-4">
                <button type="button" className="btn-primary flex-1 rounded-md px-3 py-2 text-xs font-black" onClick={() => navigate({ name: "card", id: variant.id })}>
                  View details
                </button>
                <button
                  type="button"
                  className={`${owned ? "btn-secondary" : "btn-primary"} flex-1 rounded-md px-3 py-2 text-xs font-black`}
                  disabled={editingVariantId !== null}
                  onClick={() => toggleOfflineOwned(variant, !owned)}
                >
                  {editingVariantId === variant.id ? "Saving..." : owned ? "Mark missing" : "Mark owned"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {displayedVariants.length === 0 ? (
        <div className="p-8 text-center text-sm font-semibold text-slate-400">
          No cards match the current filters.
        </div>
      ) : null}
    </section>
  );
}

function OfflineCardDetail({
  variant,
  blockEdit,
  toggleOfflineOwned,
  editingVariantId,
  updateOfflineMarketPrice,
  editingPriceVariantId,
}: {
  variant: OfflineVariant;
  blockEdit: () => void;
  toggleOfflineOwned: (variant: OfflineVariant, owned: boolean) => void;
  editingVariantId: number | null;
  updateOfflineMarketPrice: (variant: OfflineVariant, value: number) => void;
  editingPriceVariantId: number | null;
}) {
  const owned = hasOfflineOwnedCopy(variant);
  const primaryCopy = getOfflinePrimaryCopy(variant);
  const notes = primaryCopy?.notes || variant.notes;
  const marketPrice = getOfflineMarketPrice(variant);

  function handlePriceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rawValue = String(formData.get("estimatedValue") ?? "").trim();
    const parsedValue = rawValue === "" ? 0 : Number(rawValue);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return;
    }

    updateOfflineMarketPrice(variant, parsedValue);
  }

  return (
    <div className="space-y-4">
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
          <p className="neon-eyebrow text-xs font-black uppercase tracking-widest">Local cached card</p>
          <p className="mt-2 text-sm font-bold uppercase tracking-widest text-slate-500">
            {variant.card.set.name} / No. {variant.card.cardNumber}
          </p>
          <h1 className="mt-2 text-4xl font-black leading-none text-white sm:text-5xl">{variant.card.name}</h1>
          <dl className="card-detail-metrics mt-7 grid gap-px overflow-hidden rounded-lg sm:grid-cols-2">
            <div><dt>Status</dt><dd>{owned ? "In collection" : "Missing"}</dd></div>
            <div><dt>Condition</dt><dd>{formatEnumLabel(primaryCopy?.condition)}</dd></div>
            <div><dt>Estimated market value</dt><dd>{formatMarketPrice(marketPrice)}</dd></div>
            <div><dt>Acquisition cost</dt><dd>{primaryCopy?.purchasePrice ? formatCurrency(primaryCopy.purchasePrice) : "Not recorded"}</dd></div>
          </dl>
          <div className="card-detail-provenance mt-7">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Collection notes</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {notes || (owned ? "No collector notes have been recorded for this copy." : "This card has not yet been added to the collection.")}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className={`${owned ? "btn-secondary" : "btn-primary"} rounded-md px-4 py-3 text-sm font-black`}
              disabled={editingVariantId !== null}
              onClick={() => toggleOfflineOwned(variant, !owned)}
            >
              {editingVariantId === variant.id ? "Saving..." : owned ? "Mark missing" : "Mark owned"}
            </button>
            <button type="button" className="btn-secondary rounded-md px-4 py-3 text-sm font-black" onClick={blockEdit}>
              Details require connection
            </button>
          </div>
        </div>
      </section>

      <form onSubmit={handlePriceSubmit} className="card-detail-ledger neon-panel rounded-lg p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="block sm:max-w-xs sm:flex-1">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Manual estimated value</span>
            <input
              name="estimatedValue"
              type="number"
              min="0"
              step="0.01"
              defaultValue={marketPrice ?? ""}
              className="field-control mt-1 h-11 w-full rounded-md px-3 text-sm font-semibold text-white outline-none transition"
            />
          </label>
          <button
            type="submit"
            className="btn-primary rounded-md px-4 py-3 text-sm font-black"
            disabled={editingPriceVariantId !== null}
          >
            {editingPriceVariantId === variant.id ? "Saving..." : "Save value"}
          </button>
        </div>
      </form>
    </div>
  );
}

function OfflineStat({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <section className="neon-panel rounded-lg p-5">
      <p className="text-sm font-semibold text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      {helper ? <p className="mt-2 text-xs font-semibold text-slate-500">{helper}</p> : null}
    </section>
  );
}

function OfflineDebugPanel({
  debugInfo,
  pendingMutations = [],
  rawPendingMutations = [],
  pendingCountEvents = [],
  enqueueEvents = [],
  debugMessage = "",
  onListPendingMutations,
  onClearPendingMutations,
}: {
  debugInfo: OfflineDebugInfo;
  pendingMutations?: OfflineMutation[];
  rawPendingMutations?: OfflineMutation[];
  pendingCountEvents?: string[];
  enqueueEvents?: ReturnType<typeof listOfflineMutationDebugEvents>;
  debugMessage?: string;
  onListPendingMutations?: () => Promise<void>;
  onClearPendingMutations?: () => Promise<void>;
}) {
  return (
    <details className="mt-4 rounded-md border border-white/[0.08] bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
      <summary className="cursor-pointer font-black uppercase tracking-widest text-slate-300">
        Offline debug
      </summary>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="font-bold text-slate-500">Snapshot loaded</dt>
          <dd>{debugInfo.snapshotLoaded ? "yes" : "no"}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">Status</dt>
          <dd>{debugInfo.status}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">SW controlled</dt>
          <dd>{debugInfo.serviceWorkerControlled ? "yes" : "no"}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">Schema version</dt>
          <dd>{debugInfo.schemaVersion}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">Generated at</dt>
          <dd>{debugInfo.generatedAt}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">Sets</dt>
          <dd>{debugInfo.sets}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">Cards / variants</dt>
          <dd>
            {debugInfo.cards} / {debugInfo.variants}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-bold text-slate-500">Current path</dt>
          <dd className="break-all">{debugInfo.currentPath}</dd>
        </div>
        {onListPendingMutations && onClearPendingMutations ? (
          <div className="sm:col-span-2">
            <dt className="font-bold text-slate-500">Pending mutation debug</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary rounded-md px-3 py-2 text-xs font-black"
                onClick={() => {
                  onListPendingMutations().catch(() => undefined);
                }}
              >
                List pending
              </button>
              <button
                type="button"
                className="btn-secondary rounded-md px-3 py-2 text-xs font-black"
                onClick={() => {
                  if (window.confirm("Clear pending local mutations only? Offline snapshot data will be kept.")) {
                    onClearPendingMutations().catch(() => undefined);
                  }
                }}
              >
                Clear pending
              </button>
            </dd>
            {debugMessage ? <dd className="mt-2 text-cyan-100">{debugMessage}</dd> : null}
            {pendingCountEvents.length > 0 ? (
              <dd className="mt-2 rounded-md border border-white/[0.08] bg-slate-950/80 p-2">
                <p className="font-bold text-slate-500">Pending count events</p>
                <ul className="mt-1 space-y-1">
                  {pendingCountEvents.map((event) => (
                    <li key={event}>{event}</li>
                  ))}
                </ul>
              </dd>
            ) : null}
            {pendingMutations.length > 0 ? (
              <dd className="mt-2 max-h-56 overflow-auto rounded-md border border-white/[0.08] bg-slate-950/80 p-2">
                <p className="mb-2 font-bold text-slate-500">Active pending mutations</p>
                <pre className="whitespace-pre-wrap break-all">
                  {JSON.stringify(
                    pendingMutations.map((mutation) => ({
                      localMutationId: mutation.localMutationId,
                      type: mutation.type,
                      status: mutation.status,
                      clientMutationSource: mutation.clientMutationSource ?? null,
                      variantId:
                        typeof mutation.payload === "object" &&
                        mutation.payload !== null &&
                        "variantId" in mutation.payload
                          ? mutation.payload.variantId
                          : null,
                      createdAt: mutation.createdAt,
                      updatedAt: mutation.updatedAt,
                      payload: mutation.payload,
                    })),
                    null,
                    2,
                  )}
                </pre>
              </dd>
            ) : null}
            {rawPendingMutations.length > 0 ? (
              <dd className="mt-2 max-h-56 overflow-auto rounded-md border border-white/[0.08] bg-slate-950/80 p-2">
                <p className="mb-2 font-bold text-slate-500">Raw pending store rows</p>
                <pre className="whitespace-pre-wrap break-all">
                  {JSON.stringify(
                    rawPendingMutations.map((mutation) => ({
                      localMutationId: mutation.localMutationId,
                      type: mutation.type,
                      status: mutation.status,
                      clientMutationSource: mutation.clientMutationSource ?? null,
                      variantId:
                        typeof mutation.payload === "object" &&
                        mutation.payload !== null &&
                        "variantId" in mutation.payload
                          ? mutation.payload.variantId
                          : null,
                      createdAt: mutation.createdAt,
                      updatedAt: mutation.updatedAt,
                      payload: mutation.payload,
                    })),
                    null,
                    2,
                  )}
                </pre>
              </dd>
            ) : null}
            {enqueueEvents.length > 0 ? (
              <dd className="mt-2 max-h-56 overflow-auto rounded-md border border-white/[0.08] bg-slate-950/80 p-2">
                <p className="mb-2 font-bold text-slate-500">Enqueue call log</p>
                <pre className="whitespace-pre-wrap break-all">{JSON.stringify(enqueueEvents, null, 2)}</pre>
              </dd>
            ) : null}
          </div>
        ) : null}
        {debugInfo.serviceWorkerDebug ? (
          <div className="sm:col-span-2">
            <dt className="font-bold text-slate-500">SW debug</dt>
            <dd className="break-all">{debugInfo.serviceWorkerDebug}</dd>
          </div>
        ) : null}
        {debugInfo.error ? (
          <div className="sm:col-span-2">
            <dt className="font-bold text-slate-500">Error</dt>
            <dd className="break-all text-amber-100">{debugInfo.error}</dd>
          </div>
        ) : null}
      </dl>
    </details>
  );
}
