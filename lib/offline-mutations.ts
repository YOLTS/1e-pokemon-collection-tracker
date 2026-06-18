"use client";

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
  primaryCollectionItemId?: number | null;
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
  collectionItemId?: number | null;
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
  collectionItemId?: number | null;
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
