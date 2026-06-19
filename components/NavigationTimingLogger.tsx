"use client";

import { useEffect } from "react";
import {
  detailNavigationTransitionKey,
  enableNavigationDebugFromUrl,
  getNavigationTransitionElapsedMs,
  getNavigationType,
  readNavigationTransition,
  recordNavigationDebug,
} from "@/lib/navigation-debug";

type NavigationTimingLoggerProps = {
  event: string;
  route: string;
  serverTiming?: Record<string, unknown>;
};

export function NavigationTimingLogger({ event, route, serverTiming }: NavigationTimingLoggerProps) {
  useEffect(() => {
    enableNavigationDebugFromUrl();

    recordNavigationDebug(`${event}:usable`, {
      route,
      serverTiming: serverTiming ?? null,
      detailTransition: readNavigationTransition(detailNavigationTransitionKey),
      detailTransitionMs: getNavigationTransitionElapsedMs(detailNavigationTransitionKey),
      navigationType: getNavigationType(),
    });
  }, [event, route, serverTiming]);

  return null;
}

