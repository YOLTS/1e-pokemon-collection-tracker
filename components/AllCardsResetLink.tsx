"use client";

import Link from "next/link";

const cardListNavigationStateKey = "pokemonCardListNavigationState";

export function clearCardListNavigationState() {
  try {
    window.sessionStorage.removeItem(cardListNavigationStateKey);
  } catch {
    // Reset navigation still works without session storage access.
  }
}

export function AllCardsResetLink() {
  return (
    <Link
      href="/cards"
      className="btn-secondary inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-black transition"
      onClick={clearCardListNavigationState}
    >
      All cards
    </Link>
  );
}
