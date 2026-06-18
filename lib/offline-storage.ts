"use client";

import {
  OFFLINE_SNAPSHOT_SCHEMA_VERSION,
  type OfflineSnapshot,
} from "@/lib/offline-snapshot";
import type {
  NewOfflineMutation,
  OfflineMutation,
  OfflineMutationStatus,
  OfflineSyncResult,
  SetOwnedMutationPayload,
  UpdateMarketPriceMutationPayload,
} from "@/lib/offline-mutations";

export const OFFLINE_DATABASE_NAME = "pokemon-collection-offline";
export const OFFLINE_DATABASE_VERSION = 2;
const snapshotStore = "snapshots";
const metadataStore = "metadata";
const pendingMutationsStore = "pendingMutations";
const syncResultsStore = "syncResults";
const latestSnapshotKey = "latest";

function createPendingMutationsStore(database: IDBDatabase) {
  const store = database.createObjectStore(pendingMutationsStore, {
    keyPath: "localMutationId",
  });
  store.createIndex("status", "status", { unique: false });
  store.createIndex("createdAt", "createdAt", { unique: false });
}

function openOfflineDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DATABASE_NAME, OFFLINE_DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(snapshotStore)) {
        database.createObjectStore(snapshotStore);
      }
      if (!database.objectStoreNames.contains(metadataStore)) {
        database.createObjectStore(metadataStore);
      }
      if (!database.objectStoreNames.contains(pendingMutationsStore)) {
        createPendingMutationsStore(database);
      }
      if (!database.objectStoreNames.contains(syncResultsStore)) {
        database.createObjectStore(syncResultsStore, {
          keyPath: "localMutationId",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(request.error ?? new Error("Offline database could not be opened."));
    };
  });
}

function normalizeIndexedDBError(error: unknown) {
  if (error instanceof DOMException && error.name === "VersionError") {
    return new Error(
      `Offline storage needs the latest app update. Close and reopen the app while online, then try offline mode again. (${error.message})`,
    );
  }

  return error;
}

async function withOfflineDatabase<T>(callback: (database: IDBDatabase) => Promise<T>) {
  try {
    const database = await openOfflineDatabase();
    try {
      return await callback(database);
    } finally {
      database.close();
    }
  } catch (error) {
    throw normalizeIndexedDBError(error);
  }
}

function createLocalMutationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function isOfflineMutation(value: unknown): value is OfflineMutation {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<OfflineMutation>;

  return (
    typeof candidate.localMutationId === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.payload === "object" &&
    candidate.payload !== null &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.retryCount === "number"
  );
}

function isUnresolvedMutation(mutation: OfflineMutation) {
  return mutation.status === "PENDING" || mutation.status === "SYNCING" || mutation.status === "FAILED";
}

function isSetOwnedMutationForVariant(mutation: OfflineMutation, variantId: number) {
  return (
    mutation.type === "SET_OWNED" &&
    isUnresolvedMutation(mutation) &&
    typeof mutation.payload === "object" &&
    mutation.payload !== null &&
    "variantId" in mutation.payload &&
    mutation.payload.variantId === variantId
  );
}

function isMarketPriceMutationForVariant(mutation: OfflineMutation, variantId: number) {
  return (
    mutation.type === "UPDATE_MARKET_PRICE" &&
    isUnresolvedMutation(mutation) &&
    typeof mutation.payload === "object" &&
    mutation.payload !== null &&
    "variantId" in mutation.payload &&
    mutation.payload.variantId === variantId
  );
}

export function isSupportedOfflineSnapshot(value: unknown): value is OfflineSnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<OfflineSnapshot>;

  return (
    candidate.schemaVersion === OFFLINE_SNAPSHOT_SCHEMA_VERSION &&
    typeof candidate.generatedAt === "string" &&
    Array.isArray(candidate.sets) &&
    Array.isArray(candidate.cards) &&
    Array.isArray(candidate.variants) &&
    typeof candidate.dashboard === "object" &&
    candidate.dashboard !== null &&
    typeof candidate.dashboard.summary === "object" &&
    candidate.dashboard.summary !== null &&
    Array.isArray(candidate.dashboard.setMetrics) &&
    Array.isArray(candidate.dashboard.recentItems)
  );
}

export async function saveOfflineSnapshot(snapshot: OfflineSnapshot) {
  if (!isSupportedOfflineSnapshot(snapshot)) {
    throw new Error("Unsupported offline snapshot schema.");
  }

  return withOfflineDatabase(async (database) => {
    const transaction = database.transaction(snapshotStore, "readwrite");
    transaction.objectStore(snapshotStore).put(snapshot, latestSnapshotKey);
    await transactionComplete(transaction);
  });
}

export async function loadOfflineSnapshot() {
  return withOfflineDatabase(async (database) => {
    return await new Promise<OfflineSnapshot | null>((resolve, reject) => {
      const transaction = database.transaction(snapshotStore, "readonly");
      const request = transaction.objectStore(snapshotStore).get(latestSnapshotKey);

      request.onsuccess = () => {
        const snapshot = request.result;
        resolve(isSupportedOfflineSnapshot(snapshot) ? snapshot : null);
      };
      request.onerror = () => reject(request.error);
    });
  });
}

export async function fetchAndSaveOfflineSnapshot() {
  const response = await fetch("/api/offline-snapshot", {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Offline snapshot request failed with ${response.status}.`);
  }

  const snapshot = (await response.json()) as unknown;
  if (!isSupportedOfflineSnapshot(snapshot)) {
    throw new Error("Offline snapshot response used an unsupported schema.");
  }

  await saveOfflineSnapshot(snapshot);
  return snapshot;
}

export async function enqueueMutation(newMutation: NewOfflineMutation) {
  const now = new Date().toISOString();
  const mutation: OfflineMutation = {
    localMutationId: newMutation.localMutationId ?? createLocalMutationId(),
    type: newMutation.type,
    payload: newMutation.payload,
    createdAt: now,
    updatedAt: now,
    baseSnapshotGeneratedAt: newMutation.baseSnapshotGeneratedAt ?? null,
    baseServerUpdatedAt: newMutation.baseServerUpdatedAt ?? null,
    status: "PENDING",
    retryCount: 0,
    lastAttemptAt: null,
    lastError: null,
  };

  await withOfflineDatabase(async (database) => {
    const transaction = database.transaction(pendingMutationsStore, "readwrite");
    transaction.objectStore(pendingMutationsStore).put(mutation);
    await transactionComplete(transaction);
  });

  return mutation;
}

export async function enqueueLatestSetOwnedMutation(
  newMutation: NewOfflineMutation<SetOwnedMutationPayload>,
) {
  const now = new Date().toISOString();
  const matchingVariantId = newMutation.payload.variantId;

  return withOfflineDatabase(async (database) => {
    return await new Promise<OfflineMutation>((resolve, reject) => {
      const transaction = database.transaction(pendingMutationsStore, "readwrite");
      const store = transaction.objectStore(pendingMutationsStore);
      const request = store.getAll();
      let mutation: OfflineMutation | null = null;

      request.onsuccess = () => {
        const matchingMutations = request.result
          .filter(isOfflineMutation)
          .filter((existingMutation) => isSetOwnedMutationForVariant(existingMutation, matchingVariantId))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const existingMutation = matchingMutations[0] ?? null;

        mutation = {
          localMutationId:
            newMutation.localMutationId ?? existingMutation?.localMutationId ?? createLocalMutationId(),
          type: "SET_OWNED",
          payload: newMutation.payload,
          createdAt: existingMutation?.createdAt ?? now,
          updatedAt: now,
          baseSnapshotGeneratedAt:
            newMutation.baseSnapshotGeneratedAt ?? existingMutation?.baseSnapshotGeneratedAt ?? null,
          baseServerUpdatedAt:
            newMutation.baseServerUpdatedAt ?? existingMutation?.baseServerUpdatedAt ?? null,
          status: "PENDING",
          retryCount: 0,
          lastAttemptAt: null,
          lastError: null,
        };

        matchingMutations.forEach((matchingMutation) => {
          if (matchingMutation.localMutationId !== mutation?.localMutationId) {
            store.delete(matchingMutation.localMutationId);
          }
        });
        store.put(mutation);
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => {
        if (mutation) {
          resolve(mutation);
        }
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  });
}

export async function enqueueLatestMarketPriceMutation(
  newMutation: NewOfflineMutation<UpdateMarketPriceMutationPayload>,
) {
  const now = new Date().toISOString();
  const matchingVariantId = newMutation.payload.variantId;

  return withOfflineDatabase(async (database) => {
    return await new Promise<OfflineMutation>((resolve, reject) => {
      const transaction = database.transaction(pendingMutationsStore, "readwrite");
      const store = transaction.objectStore(pendingMutationsStore);
      const request = store.getAll();
      let mutation: OfflineMutation | null = null;

      request.onsuccess = () => {
        const matchingMutations = request.result
          .filter(isOfflineMutation)
          .filter((existingMutation) => isMarketPriceMutationForVariant(existingMutation, matchingVariantId))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const existingMutation = matchingMutations[0] ?? null;

        mutation = {
          localMutationId:
            newMutation.localMutationId ?? existingMutation?.localMutationId ?? createLocalMutationId(),
          type: "UPDATE_MARKET_PRICE",
          payload: newMutation.payload,
          createdAt: existingMutation?.createdAt ?? now,
          updatedAt: now,
          baseSnapshotGeneratedAt:
            newMutation.baseSnapshotGeneratedAt ?? existingMutation?.baseSnapshotGeneratedAt ?? null,
          baseServerUpdatedAt:
            newMutation.baseServerUpdatedAt ?? existingMutation?.baseServerUpdatedAt ?? null,
          status: "PENDING",
          retryCount: 0,
          lastAttemptAt: null,
          lastError: null,
        };

        matchingMutations.forEach((matchingMutation) => {
          if (matchingMutation.localMutationId !== mutation?.localMutationId) {
            store.delete(matchingMutation.localMutationId);
          }
        });
        store.put(mutation);
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => {
        if (mutation) {
          resolve(mutation);
        }
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  });
}

export async function listPendingMutations() {
  return withOfflineDatabase(async (database) => {
    const transaction = database.transaction(pendingMutationsStore, "readonly");
    const request = transaction.objectStore(pendingMutationsStore).getAll();
    const mutations = await requestResult(request);

    return mutations
      .filter(isOfflineMutation)
      .filter(isUnresolvedMutation)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });
}

export async function clearPendingMutationDebugStores() {
  return withOfflineDatabase(async (database) => {
    const transaction = database.transaction([pendingMutationsStore, syncResultsStore], "readwrite");
    transaction.objectStore(pendingMutationsStore).clear();
    transaction.objectStore(syncResultsStore).clear();
    await transactionComplete(transaction);
  });
}

async function updateMutationStatus(
  localMutationId: string,
  status: OfflineMutationStatus,
  changes: Partial<Pick<OfflineMutation, "retryCount" | "lastAttemptAt" | "lastError">> = {},
) {
  return withOfflineDatabase(async (database) => {
    return await new Promise<OfflineMutation>((resolve, reject) => {
      const transaction = database.transaction(pendingMutationsStore, "readwrite");
      const store = transaction.objectStore(pendingMutationsStore);
      const request = store.get(localMutationId);
      let updated: OfflineMutation | null = null;

      request.onsuccess = () => {
        const existing = request.result;
        if (!isOfflineMutation(existing)) {
          transaction.abort();
          reject(new Error(`Offline mutation ${localMutationId} was not found.`));
          return;
        }

        updated = {
          ...existing,
          ...changes,
          status,
          updatedAt: new Date().toISOString(),
        };

        store.put(updated);
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => {
        if (updated) {
          resolve(updated);
        }
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  });
}

export async function markMutationSyncing(localMutationId: string) {
  return updateMutationStatus(localMutationId, "SYNCING", {
    lastAttemptAt: new Date().toISOString(),
    lastError: null,
  });
}

export async function markMutationSynced(localMutationId: string, syncResult?: OfflineSyncResult) {
  return withOfflineDatabase(async (database) => {
    return await new Promise<OfflineMutation>((resolve, reject) => {
      const transaction = database.transaction([pendingMutationsStore, syncResultsStore], "readwrite");
      const pendingStore = transaction.objectStore(pendingMutationsStore);
      const request = pendingStore.get(localMutationId);
      let updated: OfflineMutation | null = null;

      request.onsuccess = () => {
        const existing = request.result;
        if (!isOfflineMutation(existing)) {
          transaction.abort();
          reject(new Error(`Offline mutation ${localMutationId} was not found.`));
          return;
        }

        const now = new Date().toISOString();
        updated = {
          ...existing,
          status: "SYNCED",
          updatedAt: now,
          lastAttemptAt: existing.lastAttemptAt ?? now,
          lastError: null,
        };

        pendingStore.put(updated);
        if (syncResult) {
          transaction.objectStore(syncResultsStore).put(syncResult);
        }
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => {
        if (updated) {
          resolve(updated);
        }
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  });
}

export async function markMutationFailed(localMutationId: string, error: string) {
  return withOfflineDatabase(async (database) => {
    return await new Promise<OfflineMutation>((resolve, reject) => {
      const transaction = database.transaction(pendingMutationsStore, "readwrite");
      const store = transaction.objectStore(pendingMutationsStore);
      const request = store.get(localMutationId);
      let updated: OfflineMutation | null = null;

      request.onsuccess = () => {
        const existing = request.result;
        if (!isOfflineMutation(existing)) {
          transaction.abort();
          reject(new Error(`Offline mutation ${localMutationId} was not found.`));
          return;
        }

        const now = new Date().toISOString();
        updated = {
          ...existing,
          status: "FAILED",
          updatedAt: now,
          retryCount: existing.retryCount + 1,
          lastAttemptAt: now,
          lastError: error,
        };

        store.put(updated);
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => {
        if (updated) {
          resolve(updated);
        }
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  });
}
