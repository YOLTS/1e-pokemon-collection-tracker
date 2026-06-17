"use client";

import {
  OFFLINE_SNAPSHOT_SCHEMA_VERSION,
  type OfflineSnapshot,
} from "@/lib/offline-snapshot";

const databaseName = "pokemon-collection-offline";
const databaseVersion = 1;
const snapshotStore = "snapshots";
const latestSnapshotKey = "latest";

function openOfflineDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(snapshotStore)) {
        database.createObjectStore(snapshotStore);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
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
