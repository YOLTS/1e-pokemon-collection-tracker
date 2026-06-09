import type { Card, CardVariant, CollectionItem, PokemonSet } from "@prisma/client";
import { toggleVariantOwned } from "@/app/actions";
import { VariantTableClient } from "@/components/VariantTableClient";

export type VariantRow = CardVariant & {
  card: Card & {
    set: Pick<PokemonSet, "name" | "slug" | "symbol" | "color">;
  };
  ownedItems: CollectionItem[];
};

type VariantTableProps = {
  variants: VariantRow[];
  showSet?: boolean;
};

export function VariantTable({ variants, showSet = false }: VariantTableProps) {
  return (
    <VariantTableClient
      variants={variants}
      showSet={showSet}
      toggleOwnedAction={toggleVariantOwned}
    />
  );
}
