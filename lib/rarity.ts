const rarityOrder: Record<string, number> = {
  "Rare Secret": 0,
  "Rare Shining": 1,
  "Rare Holo": 2,
  Holo: 3,
  Rare: 4,
  Uncommon: 5,
  Common: 6,
  Energy: 7,
};

export function rarityRank(rarity: string) {
  return rarityOrder[rarity] ?? 99;
}

export function rarityToken(rarity: string) {
  return rarity.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function compareRarity(a: string, b: string) {
  return rarityRank(a) - rarityRank(b) || a.localeCompare(b);
}
