"use client";

import { useEffect } from "react";
import { fetchAndSaveOfflineSnapshot } from "@/lib/offline-storage";

export function OfflineRuntime() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed.", error);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshSnapshot() {
      if (cancelled || !navigator.onLine) {
        return;
      }

      try {
        await fetchAndSaveOfflineSnapshot();
      } catch (error) {
        console.warn("Offline snapshot refresh failed.", error);
      }
    }

    refreshSnapshot();
    window.addEventListener("online", refreshSnapshot);

    return () => {
      cancelled = true;
      window.removeEventListener("online", refreshSnapshot);
    };
  }, []);

  return null;
}
