import { PrismaClient as PostgresClient } from "../prisma/generated/postgres-client";
import { PrismaClient as SqliteClient } from "../prisma/generated/sqlite-source-client";
import {
  assertCountsMatch,
  compareCounts,
  configureSqliteSourceUrl,
  postgresCounts,
  requireNeonUrl,
  sqliteCounts,
  tableNames,
  type TableName,
} from "./sqlite-neon-migration-shared";

configureSqliteSourceUrl();
requireNeonUrl();

const source = new SqliteClient();
const destination = new PostgresClient();

async function resetSequence(tableName: TableName) {
  await destination.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), COALESCE(MAX("id"), 1), MAX("id") IS NOT NULL) FROM "${tableName}"`,
  );
}

async function main() {
  const sourceCounts = await sqliteCounts(source);
  const existingDestinationCounts = await postgresCounts(destination);

  if (Object.values(existingDestinationCounts).some((count) => count !== 0)) {
    console.table(compareCounts(sourceCounts, existingDestinationCounts));
    throw new Error("Destination Neon database must be empty before import.");
  }

  const [pokemonSets, cards, cardVariants, collectionItems, priceSnapshots, saleRecords] = await Promise.all([
    source.pokemonSet.findMany({ orderBy: { id: "asc" } }),
    source.card.findMany({ orderBy: { id: "asc" } }),
    source.cardVariant.findMany({ orderBy: { id: "asc" } }),
    source.collectionItem.findMany({ orderBy: { id: "asc" } }),
    source.priceSnapshot.findMany({ orderBy: { id: "asc" } }),
    source.saleRecord.findMany({ orderBy: { id: "asc" } }),
  ]);

  await destination.$transaction(
    async (transaction) => {
      await transaction.pokemonSet.createMany({ data: pokemonSets });
      await transaction.card.createMany({ data: cards });
      await transaction.cardVariant.createMany({ data: cardVariants });
      await transaction.collectionItem.createMany({ data: collectionItems });
      await transaction.priceSnapshot.createMany({ data: priceSnapshots });
      await transaction.saleRecord.createMany({ data: saleRecords });
    },
    { maxWait: 20_000, timeout: 120_000 },
  );

  for (const tableName of tableNames) {
    await resetSequence(tableName);
  }

  const destinationCounts = await postgresCounts(destination);
  console.log("SQLite to Neon import complete");
  console.table(compareCounts(sourceCounts, destinationCounts));
  assertCountsMatch(sourceCounts, destinationCounts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([source.$disconnect(), destination.$disconnect()]);
  });
