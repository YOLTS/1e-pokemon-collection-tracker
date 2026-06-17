import { PrismaClient as PostgresClient } from "../prisma/generated/postgres-client";
import { PrismaClient as SqliteClient } from "../prisma/generated/sqlite-source-client";
import {
  assertCountsMatch,
  compareCounts,
  configureSqliteSourceUrl,
  postgresCounts,
  requireNeonUrl,
  sqliteCounts,
} from "./sqlite-neon-migration-shared";

configureSqliteSourceUrl();
requireNeonUrl();

const source = new SqliteClient();
const destination = new PostgresClient();

async function main() {
  const sourceCounts = await sqliteCounts(source);
  const destinationCounts = await postgresCounts(destination);
  const comparison = compareCounts(sourceCounts, destinationCounts);

  console.log("SQLite to Neon row-count verification");
  console.table(comparison);
  assertCountsMatch(sourceCounts, destinationCounts);
  console.log("Row counts match.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([source.$disconnect(), destination.$disconnect()]);
  });
