"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const cardListNavigationStateKey = "pokemonCardListNavigationState";

function storedCardListPath() {
  try {
    const rawValue = window.sessionStorage.getItem(cardListNavigationStateKey);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as { path?: unknown };
    if (typeof parsedValue.path === "string" && parsedValue.path.startsWith("/cards")) {
      return parsedValue.path;
    }
  } catch {
    return null;
  }

  return null;
}

export function CardListBackLink() {
  const [href, setHref] = useState("/cards");

  useEffect(() => {
    setHref(storedCardListPath() ?? "/cards");
  }, []);

  return (
    <Link href={href} className="btn-primary inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-black transition">
      ← Back to Card List
    </Link>
  );
}
