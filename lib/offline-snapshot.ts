export const OFFLINE_SNAPSHOT_SCHEMA_VERSION = 1;

export type OfflineSet = {
  id: number;
  name: string;
  slug: string;
  series: string;
  era: string;
  language: string;
  releaseYear: number;
  totalCards: number;
  firstEdition: boolean;
  symbol: string;
  symbolLabel: string;
  color: string;
  displayOrder: number;
};

export type OfflineCard = {
  id: number;
  setId: number;
  cardNumber: string;
  name: string;
  rarity: string;
  category: string;
  displayOrder: number;
  artist: string | null;
  imageUrlSmall: string | null;
  imageUrlLarge: string | null;
  imageSource: string | null;
  imageMatchStatus: string;
};

export type OfflineCollectionItem = {
  id: number;
  variantId: number;
  status: string;
  condition: string;
  gradingCompany: string;
  grade: string | null;
  purchasePrice: number | null;
  acquiredAt: string | null;
  acquisitionSource: string;
  storageLocation: string;
  notes: string;
  isPrimaryCopy: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OfflineVariant = {
  id: number;
  cardId: number;
  slug: string;
  edition: string;
  finish: string;
  language: string;
  isMasterSetCandidate: boolean;
  estimatedValue: number;
  targetBuyPrice: number | null;
  marketPrice: number | null;
  marketPriceSource: string | null;
  marketPriceStatus: string;
  marketPriceBucket: string | null;
  marketPriceUpdatedAt: string | null;
  notes: string;
  card: OfflineCard & {
    set: Pick<OfflineSet, "name" | "slug" | "symbol" | "symbolLabel" | "color" | "releaseYear">;
  };
  ownedItems: OfflineCollectionItem[];
};

export type OfflineSummary = {
  totalVariants: number;
  ownedVariants: number;
  missingVariants: number;
  completion: number;
  estimatedCollectionValue: number;
  estimatedRemainingCost: number;
  pricedVariants: number;
  pricedOwnedVariants: number;
  pricedMissingVariants: number;
};

export type OfflineSetMetric = {
  set: OfflineSet;
  owned: number;
  total: number;
  missing: number;
  completion: number;
  ownedValue: number;
  remainingValue: number;
  priced: number;
  holoOwned: number;
  holoTotal: number;
};

export type OfflineRecentItem = {
  id: number;
  createdAt: string;
  condition: string;
  gradingCompany: string;
  variantId: number;
  cardName: string;
  cardNumber: string;
  setName: string;
  marketPrice: number | null;
};

export type OfflineSnapshot = {
  schemaVersion: typeof OFFLINE_SNAPSHOT_SCHEMA_VERSION;
  generatedAt: string;
  source: "NEON_POSTGRES";
  counts: {
    sets: number;
    cards: number;
    variants: number;
    collectionItems: number;
  };
  sets: OfflineSet[];
  cards: OfflineCard[];
  variants: OfflineVariant[];
  dashboard: {
    summary: OfflineSummary;
    setMetrics: OfflineSetMetric[];
    recentItems: OfflineRecentItem[];
    intelligence: {
      nextMilestone: number;
      cardsToMilestone: number;
      leadingSets: Array<{
        name: string;
        slug: string;
        owned: number;
        missing: number;
        total: number;
        completion: number;
      }>;
      closestSet: {
        name: string;
        slug: string;
        owned: number;
        missing: number;
        total: number;
        completion: number;
      } | null;
      rarestOwned: Array<{
        id: number;
        name: string;
        cardNumber: string;
        rarity: string;
        setName: string;
        setSlug: string;
        marketPrice: number | null;
      }>;
    };
  };
};

export function hasOfflineOwnedCopy(variant: OfflineVariant) {
  return variant.ownedItems.some((item) => item.status === "OWNED");
}

export function getOfflinePrimaryCopy(variant: OfflineVariant) {
  return (
    variant.ownedItems.find((item) => item.status === "OWNED" && item.isPrimaryCopy) ??
    variant.ownedItems.find((item) => item.status === "OWNED") ??
    null
  );
}

export function getOfflineMarketPrice(variant: Pick<OfflineVariant, "estimatedValue" | "marketPrice">) {
  return variant.marketPrice !== null ? variant.marketPrice : variant.estimatedValue > 0 ? variant.estimatedValue : null;
}

export function summarizeOfflineVariants(variants: OfflineVariant[]): OfflineSummary {
  const masterVariants = variants.filter((variant) => variant.isMasterSetCandidate);
  const ownedVariants = masterVariants.filter(hasOfflineOwnedCopy);
  const missingVariants = masterVariants.filter((variant) => !hasOfflineOwnedCopy(variant));
  const pricedVariants = masterVariants.filter((variant) => getOfflineMarketPrice(variant) !== null);
  const pricedOwnedVariants = ownedVariants.filter((variant) => getOfflineMarketPrice(variant) !== null);
  const pricedMissingVariants = missingVariants.filter((variant) => getOfflineMarketPrice(variant) !== null);

  return {
    totalVariants: masterVariants.length,
    ownedVariants: ownedVariants.length,
    missingVariants: missingVariants.length,
    completion: masterVariants.length === 0 ? 0 : (ownedVariants.length / masterVariants.length) * 100,
    estimatedCollectionValue: ownedVariants.reduce((total, variant) => total + (getOfflineMarketPrice(variant) ?? 0), 0),
    estimatedRemainingCost: missingVariants.reduce((total, variant) => total + (getOfflineMarketPrice(variant) ?? 0), 0),
    pricedVariants: pricedVariants.length,
    pricedOwnedVariants: pricedOwnedVariants.length,
    pricedMissingVariants: pricedMissingVariants.length,
  };
}

const rarityOrder = [
  "Rare Holo",
  "Rare",
  "Uncommon",
  "Common",
  "Promo",
];

function rarityRank(rarity: string) {
  const index = rarityOrder.findIndex((knownRarity) => knownRarity.toLowerCase() === rarity.toLowerCase());
  return index === -1 ? rarityOrder.length : index;
}

export function buildOfflineSetMetrics(sets: OfflineSet[], variants: OfflineVariant[]): OfflineSetMetric[] {
  return sets.map((set) => {
    const setVariants = variants.filter((variant) => variant.card.set.slug === set.slug);
    const summary = summarizeOfflineVariants(setVariants);
    const holoVariants = setVariants.filter((variant) => variant.finish === "HOLO");
    const holoOwned = holoVariants.filter(hasOfflineOwnedCopy).length;

    return {
      set,
      owned: summary.ownedVariants,
      total: summary.totalVariants,
      missing: summary.missingVariants,
      completion: summary.completion,
      ownedValue: summary.estimatedCollectionValue,
      remainingValue: summary.estimatedRemainingCost,
      priced: summary.pricedVariants,
      holoOwned,
      holoTotal: holoVariants.length,
    };
  });
}

export function buildOfflineIntelligence(variants: OfflineVariant[], setMetrics: OfflineSetMetric[]) {
  const masterVariants = variants.filter((variant) => variant.isMasterSetCandidate);
  const ownedVariants = masterVariants.filter(hasOfflineOwnedCopy);
  const owned = ownedVariants.length;
  const total = masterVariants.length;
  const completion = total ? (owned / total) * 100 : 0;
  const milestoneTargets = [10, 25, 50, 75, 90, 100];
  const nextMilestone = milestoneTargets.find((target) => target > completion) ?? 100;
  const milestoneCardTarget = Math.ceil((total * nextMilestone) / 100);

  const leadingSets = [...setMetrics]
    .sort((a, b) => b.completion - a.completion || b.owned - a.owned || a.missing - b.missing)
    .slice(0, 3)
    .map(({ set, owned: setOwned, missing, total: setTotal, completion: setCompletion }) => ({
      name: set.name,
      slug: set.slug,
      owned: setOwned,
      missing,
      total: setTotal,
      completion: setCompletion,
    }));

  const closestSetMetric = [...setMetrics]
    .filter((set) => set.owned > 0 && set.missing > 0)
    .sort((a, b) => a.missing - b.missing || b.completion - a.completion)[0];

  const rarestOwned = [...ownedVariants]
    .sort(
      (a, b) =>
        rarityRank(a.card.rarity) - rarityRank(b.card.rarity) ||
        (getOfflineMarketPrice(b) ?? -1) - (getOfflineMarketPrice(a) ?? -1) ||
        a.card.name.localeCompare(b.card.name),
    )
    .slice(0, 3)
    .map((variant) => ({
      id: variant.id,
      name: variant.card.name,
      cardNumber: variant.card.cardNumber,
      rarity: variant.card.rarity,
      setName: variant.card.set.name,
      setSlug: variant.card.set.slug,
      marketPrice: getOfflineMarketPrice(variant),
    }));

  return {
    nextMilestone,
    cardsToMilestone: Math.max(milestoneCardTarget - owned, 0),
    leadingSets,
    closestSet: closestSetMetric
      ? {
          name: closestSetMetric.set.name,
          slug: closestSetMetric.set.slug,
          owned: closestSetMetric.owned,
          missing: closestSetMetric.missing,
          total: closestSetMetric.total,
          completion: closestSetMetric.completion,
        }
      : null,
    rarestOwned,
  };
}
