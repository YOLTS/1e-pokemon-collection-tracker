import type { Card, CardVariant, CollectionItem, PokemonSet } from "@prisma/client";
import { toggleVariantOwned } from "@/app/actions";
import { VariantTableClient } from "@/components/VariantTableClient";

export type VariantRow = CardVariant & {
  card: Card & {
    set: Pick<PokemonSet, "name" | "slug" | "symbol" | "color">;
  };
  ownedItems: CollectionItem[];
  priceSnapshots?: Array<{
    marketPrice: number;
    source: string;
    capturedAt: Date;
  }>;
};

export type PricingDebugSummary = {
  pricedCards: number;
  highestPricedCard: string | null;
  highestPricedValue: number | null;
};

type VariantTableProps = {
  variants: VariantRow[];
  showSet?: boolean;
  pricingDebug?: PricingDebugSummary;
};

export function VariantTable({ variants, showSet = false, pricingDebug }: VariantTableProps) {
  return (
    <VariantTableClient
      variants={variants}
      showSet={showSet}
      pricingDebug={pricingDebug}
      toggleOwnedAction={toggleVariantOwned}
    />
  );
}
