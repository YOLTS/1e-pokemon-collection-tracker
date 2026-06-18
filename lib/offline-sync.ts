"use client";

import type { OfflineMutation, OfflineSyncResult } from "@/lib/offline-mutations";
import type { OfflineSnapshot } from "@/lib/offline-snapshot";
import {
  fetchAndSaveOfflineSnapshot,
  listPendingMutations,
  markMutationFailed,
  markMutationSynced,
  markMutationSyncing,
} from "@/lib/offline-storage";

export type ManualOfflineSyncResult = {
  status: "synced" | "failed";
  message: string;
  syncedCount: number;
  failedCount: number;
  pendingCount: number;
  freshSnapshot: OfflineSnapshot | null;
  snapshotRefreshError: string | null;
  mutationResults: OfflineSyncResult[];
};

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : "Manual sync failed.";
}

export async function syncPendingOfflineMutations(): Promise<ManualOfflineSyncResult> {
  let syncResultsHandled = false;
  let mutationsToSync: OfflineMutation[] = [];

  try {
    mutationsToSync = (await listPendingMutations()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    if (mutationsToSync.length === 0) {
      return {
        status: "synced",
        message: "Synced just now",
        syncedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        freshSnapshot: null,
        snapshotRefreshError: null,
        mutationResults: [],
      };
    }

    const syncingMutations = await Promise.all(
      mutationsToSync.map((mutation) => markMutationSyncing(mutation.localMutationId)),
    );

    const response = await fetch("/api/sync-mutations", {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mutations: syncingMutations }),
    });

    if (!response.ok) {
      throw new Error(`Sync request failed with ${response.status}.`);
    }

    const body = (await response.json()) as { results?: OfflineSyncResult[] };
    const mutationResults = Array.isArray(body.results) ? body.results : [];
    const resultsById = new Map(mutationResults.map((result) => [result.localMutationId, result]));

    await Promise.all(
      syncingMutations.map(async (mutation) => {
        const result = resultsById.get(mutation.localMutationId);

        if (!result) {
          await markMutationFailed(mutation.localMutationId, "Sync endpoint did not return a result.");
          return;
        }

        if (result.status === "APPLIED" || result.status === "ALREADY_APPLIED") {
          await markMutationSynced(mutation.localMutationId, result);
          return;
        }

        await markMutationFailed(mutation.localMutationId, result.error ?? `Sync returned ${result.status}.`);
      }),
    );
    syncResultsHandled = true;

    const failedResults = mutationResults.filter((result) => result.status === "FAILED" || result.status === "CONFLICT");
    const missingResults = syncingMutations.filter((mutation) => !resultsById.has(mutation.localMutationId));
    const successfulSync = failedResults.length === 0 && missingResults.length === 0;
    const pendingCount = (await listPendingMutations()).length;

    if (!successfulSync) {
      return {
        status: "failed",
        message: "Sync failed - changes still saved locally",
        syncedCount: syncingMutations.length - failedResults.length - missingResults.length,
        failedCount: failedResults.length + missingResults.length,
        pendingCount,
        freshSnapshot: null,
        snapshotRefreshError: null,
        mutationResults,
      };
    }

    let freshSnapshot: OfflineSnapshot | null = null;
    let snapshotRefreshError: string | null = null;

    try {
      freshSnapshot = await fetchAndSaveOfflineSnapshot();
    } catch (error) {
      snapshotRefreshError = normalizeError(error);
    }

    return {
      status: "synced",
      message: "Synced just now",
      syncedCount: syncingMutations.length,
      failedCount: 0,
      pendingCount,
      freshSnapshot,
      snapshotRefreshError,
      mutationResults,
    };
  } catch (error) {
    if (!syncResultsHandled) {
      await Promise.all(
        mutationsToSync.map((mutation) =>
          markMutationFailed(mutation.localMutationId, normalizeError(error)).catch(() => undefined),
        ),
      );
    }

    return {
      status: "failed",
      message: "Sync failed - changes still saved locally",
      syncedCount: 0,
      failedCount: mutationsToSync.length,
      pendingCount: (await listPendingMutations().catch(() => [])).length,
      freshSnapshot: null,
      snapshotRefreshError: null,
      mutationResults: [],
    };
  }
}
