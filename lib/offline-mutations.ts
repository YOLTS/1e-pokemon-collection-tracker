"use client";

import {
  buildOfflineIntelligence,
  buildOfflineSetMetrics,
  getOfflineMarketPrice,
  getOfflinePrimaryCopy,
  summarizeOfflineVariants,
  type OfflineCollectionItem,
  type OfflineRecentItem,
  type OfflineSnapshot,
  type OfflineVariant,
} from "@/lib/offline-snapshot";

export const OFFLINE_MUTATION_QUEUE_SCHEMA_VERSION = 2;

export type OfflineMutationType =
  | "SET_OWNED"
  | "UPDATE_MARKET_PRICE"
  | "UPDATE_CARD_DETAILS"
  | "UPDATE_NOTES";

export type OfflineMutationStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED";

export type SetOwnedMutationPayload = {
  variantId: number;
  setSlug: string;
  owned: boolean;
  primaryCollectionItemId?: number | string | null;
  oldStatus?: string | null;
  newStatus: "OWNED" | "MISSING";
};

export type UpdateMarketPriceMutationPayload = {
  variantId: number;
  setSlug: string;
  oldEstimatedValue: number;
  newEstimatedValue: number;
  oldMarketPrice: number | null;
  newMarketPrice: number;
  marketPriceSource: "MANUAL_APP_EDIT";
  marketPriceStatus: "MANUAL";
};

export type UpdateCardDetailsMutationPayload = {
  variantId: number;
  setSlug: string;
  collectionItemId?: number | string | null;
  condition?: string;
  gradingCompany?: string;
  grade?: string | null;
  purchasePrice?: number | null;
  notes?: string;
  estimatedValue?: number;
};

export type UpdateNotesMutationPayload = {
  variantId: number;
  setSlug: string;
  collectionItemId?: number | string | null;
  notes: string;
};

export type OfflineMutationPayload =
  | SetOwnedMutationPayload
  | UpdateMarketPriceMutationPayload
  | UpdateCardDetailsMutationPayload
  | UpdateNotesMutationPayload;

export type OfflineMutation<TPayload extends OfflineMutationPayload = OfflineMutationPayload> = {
  localMutationId: string;
  type: OfflineMutationType;
  payload: TPayload;
  clientMutationSource?: "OFFLINE_UI";
  createdAt: string;
  updatedAt: string;
  baseSnapshotGeneratedAt: string | null;
  baseServerUpdatedAt: string | null;
  status: OfflineMutationStatus;
  retryCount: number;
  lastAttemptAt: string | null;
  lastError: string | null;
};

export type NewOfflineMutation<TPayload extends OfflineMutationPayload = OfflineMutationPayload> = {
  localMutationId?: string;
  type: OfflineMutationType;
  payload: TPayload;
  baseSnapshotGeneratedAt?: string | null;
  baseServerUpdatedAt?: string | null;
  debugContext?: string;
};

export type OfflineSyncResult = {
  localMutationId: string;
  type: OfflineMutationType;
  status: "APPLIED" | "ALREADY_APPLIED" | "FAILED" | "CONFLICT";
  syncedAt: string;
  serverResult?: unknown;
  error?: string | null;
};

export type OfflineMetadata = {
  schemaVersion: typeof OFFLINE_MUTATION_QUEUE_SCHEMA_VERSION;
  lastSnapshotAt: string | null;
  lastSuccessfulSyncAt: string | null;
  syncStatus: "IDLE" | "SYNCING" | "FAILED";
  lastError: string | null;
};

function cloneSnapshot(snapshot: OfflineSnapshot): OfflineSnapshot {
  if (typeof structuredClone === "function") {
    return structuredClone(snapshot);
  }

  return JSON.parse(JSON.stringify(snapshot)) as OfflineSnapshot;
}

function findVariant(snapshot: OfflineSnapshot, variantId: number) {
  const variant = snapshot.variants.find((candidate) => candidate.id === variantId);
  if (!variant) {
    throw new Error(`Offline variant ${variantId} was not found in the local snapshot.`);
  }

  return variant;
}

function localOwnedItemId(variantId: number) {
  return `local-owned:${variantId}`;
}

function localDetailsItemId(variantId: number) {
  return `local-details:${variantId}`;
}

function sameCollectionItemId(left: number | string, right: number | string | null | undefined) {
  return right !== null && right !== undefined && String(left) === String(right);
}

function nowIso() {
  return new Date().toISOString();
}

function createLocalCollectionItem(
  variantId: number,
  id: string,
  createdAt: string,
  changes: Partial<OfflineCollectionItem> = {},
): OfflineCollectionItem {
  return {
    id,
    variantId,
    status: "MISSING",
    condition: "NOT_ASSESSED",
    gradingCompany: "RAW",
    grade: null,
    purchasePrice: null,
    acquiredAt: null,
    acquisitionSource: "UNKNOWN",
    storageLocation: "Binder",
    notes: "",
    isPrimaryCopy: true,
    createdAt,
    updatedAt: createdAt,
    ...changes,
  };
}

function findPrimaryOrPayloadItem(
  variant: OfflineVariant,
  collectionItemId: number | string | null | undefined,
) {
  return (
    variant.ownedItems.find((item) => sameCollectionItemId(item.id, collectionItemId)) ??
    getOfflinePrimaryCopy(variant) ??
    variant.ownedItems.find((item) => item.isPrimaryCopy) ??
    null
  );
}

function recomputeRecentItems(variants: OfflineVariant[]): OfflineRecentItem[] {
  return variants
    .flatMap((variant) =>
      variant.ownedItems
        .filter((item) => item.status === "OWNED")
        .map((item) => ({
          id: item.id,
          createdAt: item.createdAt,
          condition: item.condition,
          gradingCompany: item.gradingCompany,
          variantId: variant.id,
          cardName: variant.card.name,
          cardNumber: variant.card.cardNumber,
          setName: variant.card.set.name,
          marketPrice: getOfflineMarketPrice(variant),
        })),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
}

export function recomputeSnapshotDashboard(snapshot: OfflineSnapshot) {
  const updatedSnapshot = cloneSnapshot(snapshot);
  const setMetrics = buildOfflineSetMetrics(updatedSnapshot.sets, updatedSnapshot.variants);

  updatedSnapshot.counts = {
    sets: updatedSnapshot.sets.length,
    cards: updatedSnapshot.cards.length,
    variants: updatedSnapshot.variants.length,
    collectionItems: updatedSnapshot.variants.reduce(
      (total, variant) => total + variant.ownedItems.length,
      0,
    ),
  };
  updatedSnapshot.dashboard = {
    ...updatedSnapshot.dashboard,
    summary: summarizeOfflineVariants(updatedSnapshot.variants),
    setMetrics,
    recentItems: recomputeRecentItems(updatedSnapshot.variants),
    intelligence: buildOfflineIntelligence(updatedSnapshot.variants, setMetrics),
  };

  return updatedSnapshot;
}

export function applySetOwned(snapshot: OfflineSnapshot, payload: SetOwnedMutationPayload) {
  const updatedSnapshot = cloneSnapshot(snapshot);
  const variant = findVariant(updatedSnapshot, payload.variantId);
  const existingPrimary =
    variant.ownedItems.find((item) => sameCollectionItemId(item.id, payload.primaryCollectionItemId)) ??
    variant.ownedItems.find((item) => item.isPrimaryCopy) ??
    null;
  const updatedAt = nowIso();

  if (payload.owned) {
    if (existingPrimary) {
      existingPrimary.status = "OWNED";
      existingPrimary.isPrimaryCopy = true;
      existingPrimary.updatedAt = updatedAt;
    } else {
      variant.ownedItems.unshift(
        createLocalCollectionItem(payload.variantId, localOwnedItemId(payload.variantId), updatedAt, {
          status: "OWNED",
          notes: "Added from quick toggle.",
        }),
      );
    }
  } else if (existingPrimary?.status === "OWNED") {
    existingPrimary.status = "MISSING";
    existingPrimary.isPrimaryCopy = true;
    existingPrimary.updatedAt = updatedAt;
  }

  return recomputeSnapshotDashboard(updatedSnapshot);
}

export function applyUpdateMarketPrice(
  snapshot: OfflineSnapshot,
  payload: UpdateMarketPriceMutationPayload,
) {
  const updatedSnapshot = cloneSnapshot(snapshot);
  const variant = findVariant(updatedSnapshot, payload.variantId);

  variant.estimatedValue = payload.newEstimatedValue;
  variant.marketPrice = payload.newMarketPrice;
  variant.marketPriceSource = payload.marketPriceSource;
  variant.marketPriceStatus = payload.marketPriceStatus;
  variant.marketPriceUpdatedAt = nowIso();

  return recomputeSnapshotDashboard(updatedSnapshot);
}

export function applyUpdateCardDetails(
  snapshot: OfflineSnapshot,
  payload: UpdateCardDetailsMutationPayload,
) {
  const updatedSnapshot = cloneSnapshot(snapshot);
  const variant = findVariant(updatedSnapshot, payload.variantId);
  const primaryCopy = findPrimaryOrPayloadItem(variant, payload.collectionItemId);
  const updatedAt = nowIso();

  if (payload.estimatedValue !== undefined) {
    variant.estimatedValue = payload.estimatedValue;
    variant.marketPrice = payload.estimatedValue;
    variant.marketPriceSource = "MANUAL_APP_EDIT";
    variant.marketPriceStatus = "MANUAL";
    variant.marketPriceUpdatedAt = updatedAt;
  }

  if (primaryCopy) {
    if (payload.condition !== undefined) {
      primaryCopy.condition = payload.condition;
    }
    if (payload.gradingCompany !== undefined) {
      primaryCopy.gradingCompany = payload.gradingCompany;
    }
    if (payload.grade !== undefined) {
      primaryCopy.grade = payload.grade;
    }
    if (payload.purchasePrice !== undefined) {
      primaryCopy.purchasePrice = payload.purchasePrice;
    }
    if (payload.notes !== undefined) {
      primaryCopy.notes = payload.notes;
    }
    primaryCopy.isPrimaryCopy = true;
    primaryCopy.updatedAt = updatedAt;
  } else {
    variant.ownedItems.unshift(
      createLocalCollectionItem(payload.variantId, localDetailsItemId(payload.variantId), updatedAt, {
        condition: payload.condition ?? "NOT_ASSESSED",
        gradingCompany: payload.gradingCompany ?? "RAW",
        grade: payload.grade ?? null,
        purchasePrice: payload.purchasePrice ?? null,
        notes: payload.notes ?? "",
      }),
    );
  }

  if (payload.notes !== undefined && primaryCopy?.status !== "OWNED") {
    variant.notes = payload.notes;
  }

  return recomputeSnapshotDashboard(updatedSnapshot);
}

export async function applyLocalMutationAndPersist(mutation: OfflineMutation) {
  const { loadOfflineSnapshot, saveOfflineSnapshot } = await import("@/lib/offline-storage");
  const snapshot = await loadOfflineSnapshot();
  if (!snapshot) {
    throw new Error("No offline snapshot is available for local mutation application.");
  }

  let updatedSnapshot: OfflineSnapshot;

  switch (mutation.type) {
    case "SET_OWNED":
      updatedSnapshot = applySetOwned(snapshot, mutation.payload as SetOwnedMutationPayload);
      break;
    case "UPDATE_MARKET_PRICE":
      updatedSnapshot = applyUpdateMarketPrice(snapshot, mutation.payload as UpdateMarketPriceMutationPayload);
      break;
    case "UPDATE_CARD_DETAILS":
      updatedSnapshot = applyUpdateCardDetails(snapshot, mutation.payload as UpdateCardDetailsMutationPayload);
      break;
    case "UPDATE_NOTES":
      updatedSnapshot = applyUpdateCardDetails(snapshot, mutation.payload as UpdateNotesMutationPayload);
      break;
    default: {
      const exhaustiveCheck: never = mutation.type;
      throw new Error(`Unsupported offline mutation type: ${exhaustiveCheck}`);
    }
  }

  await saveOfflineSnapshot(updatedSnapshot);
  return updatedSnapshot;
}
