"use client";

const enabledKey = "pokemonNavigationDebugEnabled";
const logKey = "pokemonNavigationDebugLog";
const maxLogEntries = 120;

export const detailNavigationTransitionKey = "pokemonNavigationDebugDetailTransition";
export const backNavigationTransitionKey = "pokemonNavigationDebugBackTransition";

type NavigationDebugEntry = {
  at: string;
  now: number | null;
  event: string;
  path: string | null;
  data: Record<string, unknown>;
};

function safeNow() {
  return typeof performance === "undefined" ? null : performance.now();
}

function currentPath() {
  if (typeof window === "undefined") {
    return null;
  }

  return `${window.location.pathname}${window.location.search}`;
}

export function enableNavigationDebugFromUrl() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("navDebug") === "1") {
    window.localStorage.setItem(enabledKey, "1");
    return true;
  }

  if (params.get("navDebug") === "0") {
    window.localStorage.removeItem(enabledKey);
    window.localStorage.removeItem(logKey);
    return false;
  }

  return isNavigationDebugEnabled();
}

export function isNavigationDebugEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(enabledKey) === "1";
  } catch {
    return false;
  }
}

export function recordNavigationDebug(event: string, data: Record<string, unknown> = {}) {
  if (!isNavigationDebugEnabled()) {
    return;
  }

  const entry: NavigationDebugEntry = {
    at: new Date().toISOString(),
    now: safeNow(),
    event,
    path: currentPath(),
    data,
  };

  console.info("[card-nav-debug]", event, entry);

  try {
    const existing = window.localStorage.getItem(logKey);
    const entries = existing ? (JSON.parse(existing) as NavigationDebugEntry[]) : [];
    entries.push(entry);
    window.localStorage.setItem(logKey, JSON.stringify(entries.slice(-maxLogEntries)));
  } catch {
    // Console logging still gives enough signal if localStorage is unavailable.
  }
}

export function writeNavigationTransition(key: string, data: Record<string, unknown>) {
  if (!isNavigationDebugEnabled() || typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({
        startedAt: safeNow(),
        at: new Date().toISOString(),
        path: currentPath(),
        ...data,
      }),
    );
  } catch {
    // Navigation timing is best-effort debug data.
  }
}

export function readNavigationTransition(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(key);
    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getNavigationTransitionElapsedMs(key: string) {
  const transition = readNavigationTransition(key);
  const startedAt = transition?.startedAt;
  const now = safeNow();

  if (typeof startedAt !== "number" || now === null) {
    return null;
  }

  return Math.round(now - startedAt);
}

export function getNavigationType() {
  if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
    return null;
  }

  const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return navigationEntry?.type ?? null;
}

