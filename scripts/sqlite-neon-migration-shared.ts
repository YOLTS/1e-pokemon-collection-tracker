const tableNames = [
  "PokemonSet",
  "Card",
  "CardVariant",
  "CollectionItem",
  "PriceSnapshot",
  "SaleRecord",
] as const;

export type TableName = (typeof tableNames)[number];
export type Counts = Record<TableName, number>;

export { tableNames };

export function requireNeonUrl() {
  if (!process.env.NEON_DATABASE_URL?.startsWith("postgres")) {
    throw new Error("NEON_DATABASE_URL must point to the destination Neon PostgreSQL database.");
  }
}

export function configureSqliteSourceUrl() {
  process.env.SQLITE_SOURCE_URL ??= "file:./dev.db";
}

export async function sqliteCounts(source: {
  pokemonSet: { count: () => Promise<number> };
  card: { count: () => Promise<number> };
  cardVariant: { count: () => Promise<number> };
  collectionItem: { count: () => Promise<number> };
  priceSnapshot: { count: () => Promise<number> };
  saleRecord: { count: () => Promise<number> };
}): Promise<Counts> {
  const [PokemonSet, Card, CardVariant, CollectionItem, PriceSnapshot, SaleRecord] = await Promise.all([
    source.pokemonSet.count(),
    source.card.count(),
    source.cardVariant.count(),
    source.collectionItem.count(),
    source.priceSnapshot.count(),
    source.saleRecord.count(),
  ]);

  return { PokemonSet, Card, CardVariant, CollectionItem, PriceSnapshot, SaleRecord };
}

export async function postgresCounts(destination: {
  pokemonSet: { count: () => Promise<number> };
  card: { count: () => Promise<number> };
  cardVariant: { count: () => Promise<number> };
  collectionItem: { count: () => Promise<number> };
  priceSnapshot: { count: () => Promise<number> };
  saleRecord: { count: () => Promise<number> };
}): Promise<Counts> {
  const [PokemonSet, Card, CardVariant, CollectionItem, PriceSnapshot, SaleRecord] = await Promise.all([
    destination.pokemonSet.count(),
    destination.card.count(),
    destination.cardVariant.count(),
    destination.collectionItem.count(),
    destination.priceSnapshot.count(),
    destination.saleRecord.count(),
  ]);

  return { PokemonSet, Card, CardVariant, CollectionItem, PriceSnapshot, SaleRecord };
}

export function compareCounts(sourceCounts: Counts, destinationCounts: Counts) {
  return tableNames.map((tableName) => ({
    tableName,
    sqlite: sourceCounts[tableName],
    neon: destinationCounts[tableName],
    matches: sourceCounts[tableName] === destinationCounts[tableName],
  }));
}

export function assertCountsMatch(sourceCounts: Counts, destinationCounts: Counts) {
  const mismatches = compareCounts(sourceCounts, destinationCounts).filter((row) => !row.matches);
  if (mismatches.length > 0) {
    throw new Error(`SQLite and Neon row counts differ: ${JSON.stringify(mismatches)}`);
  }
}
