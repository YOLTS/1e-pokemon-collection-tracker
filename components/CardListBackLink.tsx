"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  backNavigationTransitionKey,
  recordNavigationDebug,
  writeNavigationTransition,
} from "@/lib/navigation-debug";

const cardListNavigationStateKey = "pokemonCardListNavigationState";
const defaultTarget = {
  href: "/cards",
  label: "← Back to Card List",
};

type StoredNavigationTarget = {
  href: string;
  label: string;
};

function storedNavigationTarget(): StoredNavigationTarget | null {
  try {
    const rawValue = window.sessionStorage.getItem(cardListNavigationStateKey);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as {
      path?: unknown;
      sourceLabel?: unknown;
    };

    if (typeof parsedValue.path === "string" && parsedValue.path.startsWith("/cards")) {
      return { href: parsedValue.path, label: defaultTarget.label };
    }

    if (typeof parsedValue.path === "string" && parsedValue.path.startsWith("/sets/")) {
      const sourceLabel =
        typeof parsedValue.sourceLabel === "string" && parsedValue.sourceLabel.length > 0
          ? parsedValue.sourceLabel
          : "Set";

      return {
        href: parsedValue.path,
        label: `← Back to ${sourceLabel}`,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function initialNavigationTarget() {
  return typeof window === "undefined" ? defaultTarget : storedNavigationTarget() ?? defaultTarget;
}

export function CardListBackLink() {
  const [target, setTarget] = useState(initialNavigationTarget);

  useEffect(() => {
    setTarget(storedNavigationTarget() ?? defaultTarget);
  }, []);

  function handleBackClick() {
    writeNavigationTransition(backNavigationTransitionKey, {
      targetPath: target.href,
      label: target.label,
    });
    recordNavigationDebug("back:navigate-start", {
      targetPath: target.href,
      label: target.label,
    });
  }

  return (
    <Link
      href={target.href}
      className="btn-primary inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-black transition"
      onClick={handleBackClick}
    >
      {target.label}
    </Link>
  );
}
