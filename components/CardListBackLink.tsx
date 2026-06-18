"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const cardListNavigationStateKey = "pokemonCardListNavigationState";

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
      return { href: parsedValue.path, label: "← Back to Card List" };
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

export function CardListBackLink() {
  const [href, setHref] = useState("/cards");
  const [label, setLabel] = useState("← Back to Card List");

  useEffect(() => {
    const target = storedNavigationTarget();
    setHref(target?.href ?? "/cards");
    setLabel(target?.label ?? "← Back to Card List");
  }, []);

  return (
    <Link href={href} className="btn-primary inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-black transition">
      {label}
    </Link>
  );
}
