"use client";

import { useEffect } from "react";
import { fetchAndSaveOfflineSnapshot, warmOwnedCardThumbnailCache } from "@/lib/offline-storage";

let offlineShellWarmed = false;
const serviceWorkerReloadFlag = "pokemonServiceWorkerControlReloaded";
const serviceWorkerDebugKey = "pokemonServiceWorkerDebug";

function writeServiceWorkerDebug(extra: Record<string, unknown>) {
  try {
    window.localStorage.setItem(
      serviceWorkerDebugKey,
      JSON.stringify({
        checkedAt: new Date().toISOString(),
        supported: "serviceWorker" in navigator,
        controlled: Boolean(navigator.serviceWorker?.controller),
        controllerScriptURL: navigator.serviceWorker?.controller?.scriptURL ?? null,
        ...extra,
      }),
    );
  } catch {
    // Service worker diagnostics are best-effort only.
  }
}

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

function offlineUrlFor(pathname: string, search: string) {
  const cardMatch = pathname.match(/^\/cards\/(\d+)\/?$/);
  if (cardMatch) {
    return `/offline?card=${encodeURIComponent(cardMatch[1])}`;
  }

  if (pathname === "/cards" || pathname === "/cards/") {
    return "/offline?view=cards";
  }

  const setMatch = pathname.match(/^\/sets\/([^/]+)\/?$/);
  if (setMatch) {
    return `/offline?set=${encodeURIComponent(decodeURIComponent(setMatch[1]))}`;
  }

  if (pathname === "/sets" || pathname === "/sets/") {
    return "/offline?view=sets";
  }

  if (pathname === "/" || pathname === "/offline" || pathname === "/offline/") {
    return `/offline${search}`;
  }

  return null;
}

export function OfflineRuntime() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      writeServiceWorkerDebug({ supported: false });
      return;
    }

    let cancelled = false;

    async function registerServiceWorker() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;

        if (cancelled) {
          return;
        }

        writeServiceWorkerDebug({
          scope: registration.scope,
          activeState: registration.active?.state ?? null,
          installingState: registration.installing?.state ?? null,
          waitingState: registration.waiting?.state ?? null,
        });
      } catch (error) {
        writeServiceWorkerDebug({
          error: error instanceof Error ? error.message : "Unknown service worker registration error",
        });
        console.warn("Service worker registration failed.", error);
      }
    }

    function handleControllerChange() {
      writeServiceWorkerDebug({ event: "controllerchange" });
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    registerServiceWorker();

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshSnapshot() {
      if (cancelled || !navigator.onLine) {
        return;
      }

      try {
        const snapshot = await fetchAndSaveOfflineSnapshot();
        warmOwnedCardThumbnailCache(snapshot)
          .then((result) => {
            try {
              window.localStorage.setItem(
                "pokemonOfflineImageCacheDebug",
                JSON.stringify({
                  checkedAt: new Date().toISOString(),
                  attempted: result.attempted,
                  failed: result.failed,
                  failures: result.failures,
                }),
              );
            } catch {
              // Image cache diagnostics are best-effort only.
            }
          })
          .catch((error) => {
            console.warn("Offline thumbnail cache warmup failed.", error);
          });
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
        if (
          "serviceWorker" in navigator &&
          !navigator.serviceWorker.controller &&
          window.localStorage.getItem(serviceWorkerReloadFlag) !== "true"
        ) {
          writeServiceWorkerDebug({ action: "reload-to-claim-control" });
          window.localStorage.setItem(serviceWorkerReloadFlag, "true");
          window.location.reload();
          return;
        }
        writeServiceWorkerDebug({ action: "snapshot-saved", snapshotGeneratedAt: snapshot.generatedAt });
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

  useEffect(() => {
    function handleOfflineNavigation(event: MouseEvent) {
      if (navigator.onLine || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) {
        return;
      }

      const offlineUrl = offlineUrlFor(url.pathname, url.search);
      if (!offlineUrl) {
        return;
      }

      event.preventDefault();
      window.location.assign(offlineUrl);
    }

    document.addEventListener("click", handleOfflineNavigation, true);

    return () => {
      document.removeEventListener("click", handleOfflineNavigation, true);
    };
  }, []);

  return null;
}
