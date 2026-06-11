import { compareRarity, rarityRank } from "@/lib/rarity";

type IntelligenceVariant = {
  id: number;
  isMasterSetCandidate: boolean;
  estimatedValue: number;
  ownedItems: Array<{ status: string }>;
  card: {
    name: string;
    cardNumber: string;
    rarity: string;
    set: { name: string; slug: string };
  };
};

export type SetIntelligenceMetric = {
  name: string;
  slug: string;
  owned: number;
  missing: number;
  total: number;
  completion: number;
};

function isOwned(variant: IntelligenceVariant) {
  return variant.ownedItems.some((item) => item.status === "OWNED");
}

export function buildRarityIntelligence(variants: IntelligenceVariant[]) {
  const masterVariants = variants.filter((variant) => variant.isMasterSetCandidate);
  const grouped = new Map<string, { rarity: string; owned: number; total: number }>();

  for (const variant of masterVariants) {
    const current = grouped.get(variant.card.rarity) ?? {
      rarity: variant.card.rarity,
      owned: 0,
      total: 0,
    };
    current.total += 1;
    if (isOwned(variant)) current.owned += 1;
    grouped.set(variant.card.rarity, current);
  }

  return Array.from(grouped.values())
    .sort((a, b) => compareRarity(a.rarity, b.rarity))
    .map((group) => ({
      ...group,
      missing: group.total - group.owned,
      completion: group.total ? (group.owned / group.total) * 100 : 0,
    }));
}

export function buildCollectionIntelligence(
  variants: IntelligenceVariant[],
  setMetrics: SetIntelligenceMetric[],
) {
  const masterVariants = variants.filter((variant) => variant.isMasterSetCandidate);
  const ownedVariants = masterVariants.filter(isOwned);
  const rarityStats = buildRarityIntelligence(masterVariants);
  const owned = ownedVariants.length;
  const total = masterVariants.length;
  const completion = total ? (owned / total) * 100 : 0;
  const milestoneTargets = [10, 25, 50, 75, 90, 100];
  const nextMilestone = milestoneTargets.find((target) => target > completion) ?? 100;
  const milestoneCardTarget = Math.ceil((total * nextMilestone) / 100);

  const rankedSets = [...setMetrics].sort(
    (a, b) => b.completion - a.completion || b.owned - a.owned || a.missing - b.missing,
  );
  const closestSets = setMetrics
    .filter((set) => set.owned > 0 && set.missing > 0)
    .sort((a, b) => a.missing - b.missing || b.completion - a.completion);

  const rarestOwned = [...ownedVariants]
    .sort(
      (a, b) =>
        rarityRank(a.card.rarity) - rarityRank(b.card.rarity) ||
        b.estimatedValue - a.estimatedValue ||
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
      estimatedValue: variant.estimatedValue,
    }));

  return {
    completion,
    nextMilestone,
    cardsToMilestone: Math.max(milestoneCardTarget - owned, 0),
    leadingSets: rankedSets.slice(0, 3),
    closestSet: closestSets[0] ?? null,
    rarestOwned,
    rarityStats,
  };
}
