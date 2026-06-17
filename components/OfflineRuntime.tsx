"use client";

import { useEffect } from "react";
import { fetchAndSaveOfflineSnapshot } from "@/lib/offline-storage";

let offlineShellWarmed = false;

function warmOfflineShell() {
  if (offlineShellWarmed || typeof document === "undefined") {
    return;
  }

  offlineShellWarmed = true;
  const iframe = document.createElement("iframe");
  iframe.src = "/offline?warm=1";
  iframe.title = "Offline shell warmup";
  iframe.tabIndex = -1;
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "absolute";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.border = "0";
  iframe.style.left = "-9999px";

  const removeIframe = () => iframe.remove();
  iframe.addEventListener("load", () => window.setTimeout(removeIframe, 1500), { once: true });
  window.setTimeout(removeIframe, 10000);
  document.body.appendChild(iframe);
}

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
        const snapshot = await fetchAndSaveOfflineSnapshot();
        try {
          window.localStorage.setItem(
            "pokemonOfflineSnapshotDebug",
            JSON.stringify({
              savedAt: new Date().toISOString(),
              schemaVersion: snapshot.schemaVersion,
              generatedAt: snapshot.generatedAt,
              sets: snapshot.counts.sets,
              cards: snapshot.counts.cards,
              variants: snapshot.counts.variants,
            }),
          );
        } catch {
          // Snapshot storage in IndexedDB succeeded; local debug metadata is optional.
        }
        warmOfflineShell();
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
