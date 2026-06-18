"use client";

import {
  OFFLINE_SNAPSHOT_SCHEMA_VERSION,
  type OfflineSnapshot,
} from "@/lib/offline-snapshot";
import {
  type NewOfflineMutation,
  type OfflineMutation,
  type OfflineMutationStatus,
  type OfflineSyncResult,
} from "@/lib/offline-mutations";

const databaseName = "pokemon-collection-offline";
const databaseVersion = 2;
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
    const request = indexedDB.open(databaseName, databaseVersion);

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
    request.onerror = () => reject(request.error);
  });
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

  const database = await openOfflineDatabase();
  try {
    const transaction = database.transaction(snapshotStore, "readwrite");
    transaction.objectStore(snapshotStore).put(snapshot, latestSnapshotKey);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function loadOfflineSnapshot() {
  const database = await openOfflineDatabase();
  try {
    return await new Promise<OfflineSnapshot | null>((resolve, reject) => {
      const transaction = database.transaction(snapshotStore, "readonly");
      const request = transaction.objectStore(snapshotStore).get(latestSnapshotKey);

      request.onsuccess = () => {
        const snapshot = request.result;
        resolve(isSupportedOfflineSnapshot(snapshot) ? snapshot : null);
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
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

  const database = await openOfflineDatabase();
  try {
    const transaction = database.transaction(pendingMutationsStore, "readwrite");
    transaction.objectStore(pendingMutationsStore).put(mutation);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }

  return mutation;
}

export async function listPendingMutations() {
  const database = await openOfflineDatabase();
  try {
    const transaction = database.transaction(pendingMutationsStore, "readonly");
    const request = transaction.objectStore(pendingMutationsStore).getAll();
    const mutations = await requestResult(request);

    return mutations
      .filter(isOfflineMutation)
      .filter((mutation) => mutation.status === "PENDING" || mutation.status === "SYNCING" || mutation.status === "FAILED")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } finally {
    database.close();
  }
}

async function updateMutationStatus(
  localMutationId: string,
  status: OfflineMutationStatus,
  changes: Partial<Pick<OfflineMutation, "retryCount" | "lastAttemptAt" | "lastError">> = {},
) {
  const database = await openOfflineDatabase();
  try {
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
  } finally {
    database.close();
  }
}

export async function markMutationSyncing(localMutationId: string) {
  return updateMutationStatus(localMutationId, "SYNCING", {
    lastAttemptAt: new Date().toISOString(),
    lastError: null,
  });
}

export async function markMutationSynced(localMutationId: string, syncResult?: OfflineSyncResult) {
  const database = await openOfflineDatabase();
  try {
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
  } finally {
    database.close();
  }
}

export async function markMutationFailed(localMutationId: string, error: string) {
  const database = await openOfflineDatabase();
  try {
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
  } finally {
    database.close();
  }
}
