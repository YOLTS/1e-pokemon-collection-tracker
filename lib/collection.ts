import type { CardVariant, CollectionItem } from "@prisma/client";
import { OWNERSHIP_STATUS } from "@/lib/domain";

export type VariantWithOwnership = CardVariant & {
  ownedItems: CollectionItem[];
};

export function hasOwnedCopy(variant: VariantWithOwnership) {
  return variant.ownedItems.some((item) => item.status === OWNERSHIP_STATUS.OWNED);
}

export function getPrimaryCopy(variant: VariantWithOwnership) {
  return (
    variant.ownedItems.find((item) => item.status === OWNERSHIP_STATUS.OWNED && item.isPrimaryCopy) ??
    variant.ownedItems.find((item) => item.status === OWNERSHIP_STATUS.OWNED) ??
    null
  );
}

export function summarizeVariants(variants: VariantWithOwnership[]) {
  const masterVariants = variants.filter((variant) => variant.isMasterSetCandidate);
  const ownedVariants = masterVariants.filter(hasOwnedCopy);
  const missingVariants = masterVariants.filter((variant) => !hasOwnedCopy(variant));

  const estimatedCollectionValue = ownedVariants.reduce(
    (total, variant) => total + variant.estimatedValue,
    0,
  );
  const estimatedRemainingCost = missingVariants.reduce(
    (total, variant) => total + variant.estimatedValue,
    0,
  );

  return {
    totalVariants: masterVariants.length,
    ownedVariants: ownedVariants.length,
    missingVariants: missingVariants.length,
    completion:
      masterVariants.length === 0 ? 0 : (ownedVariants.length / masterVariants.length) * 100,
    estimatedCollectionValue,
    estimatedRemainingCost,
  };
}

export function formatEnumLabel(value?: string | null) {
  if (!value) {
    return "-";
  }

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
