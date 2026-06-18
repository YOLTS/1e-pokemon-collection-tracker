"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { listPendingMutations } from "@/lib/offline-storage";
import { syncPendingOfflineMutations } from "@/lib/offline-sync";

type BannerSyncStatus = "idle" | "syncing" | "synced" | "failed";

export function OfflineSyncBanner() {
  const pathname = usePathname();
  const [online, setOnline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<BannerSyncStatus>("idle");
  const [message, setMessage] = useState("");

  const refreshPendingCount = useCallback(async () => {
    if (typeof navigator === "undefined") {
      return 0;
    }

    const isOnline = navigator.onLine;
    setOnline(isOnline);

    if (!isOnline) {
      setPendingCount(0);
      return 0;
    }

    try {
      const pendingMutations = await listPendingMutations();
      setPendingCount(pendingMutations.length);
      return pendingMutations.length;
    } catch {
      setPendingCount(0);
      return 0;
    }
  }, []);

  useEffect(() => {
    refreshPendingCount().catch(() => undefined);

    function handleOnline() {
      refreshPendingCount().catch(() => undefined);
    }

    function handleOffline() {
      setOnline(false);
      setPendingCount(0);
    }

    function handleFocus() {
      refreshPendingCount().catch(() => undefined);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshPendingCount().catch(() => undefined);
      }
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshPendingCount]);

  useEffect(() => {
    if (syncStatus !== "synced" || pendingCount > 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSyncStatus("idle");
      setMessage("");
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [pendingCount, syncStatus]);

  async function handleSync() {
    if (isSyncing || !online || pendingCount === 0) {
      return;
    }

    setIsSyncing(true);
    setSyncStatus("syncing");
    setMessage("Syncing...");

    try {
      const result = await syncPendingOfflineMutations();
      const nextPendingCount = await refreshPendingCount();

      if (result.status === "synced" && nextPendingCount === 0) {
        setSyncStatus("synced");
        setMessage(result.snapshotRefreshError ? "Synced just now - snapshot refresh will retry later" : "Synced just now");
      } else {
        setSyncStatus("failed");
        setMessage("Sync failed - changes still saved locally");
      }
    } catch {
      await refreshPendingCount().catch(() => undefined);
      setSyncStatus("failed");
      setMessage("Sync failed - changes still saved locally");
    } finally {
      setIsSyncing(false);
    }
  }

  if (pathname?.startsWith("/offline") || !online || (pendingCount === 0 && syncStatus !== "synced")) {
    return null;
  }

  return (
    <aside className="relative z-40 border-b border-amber-300/20 bg-amber-300/10 px-4 py-3 text-amber-50 shadow-[0_12px_36px_rgba(0,0,0,0.24)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-black">
          {pendingCount > 0
            ? pendingCount === 1
              ? "1 local change pending sync"
              : `${pendingCount} local changes pending sync`
            : message || "Synced just now"}
          {message && pendingCount > 0 ? <span className="ml-2 font-bold text-amber-100/80">{message}</span> : null}
        </div>
        {pendingCount > 0 ? (
          <button
            type="button"
            className="btn-primary rounded-md px-3 py-2 text-xs font-black"
            disabled={isSyncing}
            onClick={() => {
              handleSync().catch(() => undefined);
            }}
          >
            {isSyncing || syncStatus === "syncing" ? "Syncing..." : "Sync pending changes"}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
