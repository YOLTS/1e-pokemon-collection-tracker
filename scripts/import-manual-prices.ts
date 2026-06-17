import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { PRICE_SOURCE } from "../lib/domain";

const prisma = new PrismaClient();
const importSource = PRICE_SOURCE.MANUAL_SPREADSHEET;
const applyChanges = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run") || !applyChanges;

type ExistingCard = {
  id: number;
  cardNumber: string;
  name: string;
  set: { name: string };
  variants: Array<{
    id: number;
    edition: string;
    isMasterSetCandidate: boolean;
  }>;
};

type ImportRow = {
  sheetName: string;
  rowNumber: number;
  setName: string;
  cardNumber: string;
  cardName: string;
  marketPrice: number | null;
};

type MatchedRow = ImportRow & {
  variantId: number;
};

type UnmatchedRow = ImportRow & {
  reason: string;
};

type SheetReport = {
  sheetName: string;
  rowsRead: number;
  matched: number;
  unmatched: number;
  skippedNoPrice: number;
};

const expectedWorkbookSheets = [
  "Base Set",
  "Jungle",
  "Fossil",
  "Team Rocket",
  "Gym Heroes",
  "Gym Challenge",
  "Neo Genesis",
  "Neo Discovery",
  "Neo Revelation",
  "Neo Destiny",
];

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (match) return match.slice(prefix.length);

  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function resolveImportFile() {
  const requestedFile = argValue("--file") ?? process.env.MANUAL_PRICE_IMPORT_FILE;
  if (requestedFile) {
    const resolved = path.resolve(requestedFile);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Import file not found: ${resolved}`);
    }
    return resolved;
  }

  const importsDir = path.resolve("imports");
  const supportedFiles = ["manual-prices.csv", "manual-prices.xlsx", "manual-prices.xls"];
  const found = supportedFiles.map((fileName) => path.join(importsDir, fileName)).find(fs.existsSync);
  if (!found) {
    throw new Error(
      `No import file found. Put manual-prices.csv, manual-prices.xlsx, or manual-prices.xls in ${importsDir}, or pass --file imports/your-file.csv.`,
    );
  }

  return found;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u2640/g, " female ")
    .replace(/\u2642/g, " male ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeNumber(value: string) {
  const printedNumber = value.split("/")[0]?.trim() ?? value.trim();
  const numeric = Number(printedNumber);
  return Number.isFinite(numeric) ? String(numeric) : normalizeText(printedNumber);
}

function parseMoney(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  if (value === undefined || value === null) {
    return null;
  }

  const cleaned = String(value).replace(/[$,]/g, "").trim();
  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function firstCell(row: Record<string, unknown>, names: string[]) {
  const normalizedNames = new Set(names.map(normalizeHeader));
  const entry = Object.entries(row).find(([key]) => normalizedNames.has(normalizeHeader(key)));
  return entry?.[1];
}

function cellText(value: unknown) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function isBlankTrackerRow(row: unknown[]) {
  return !cellText(row[1]) && !cellText(row[2]) && parseMoney(row[4]) === null;
}

function readTrackerWorkbookRows(workbook: XLSX.WorkBook): ImportRow[] {
  const rows: ImportRow[] = [];
  const missingSheets = expectedWorkbookSheets.filter((sheetName) => !workbook.Sheets[sheetName]);
  if (missingSheets.length > 0) {
    console.log(`Warning: missing expected sheets: ${missingSheets.join(", ")}`);
  }

  for (const sheetName of expectedWorkbookSheets) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      range: 4,
      blankrows: false,
      defval: null,
      raw: true,
    });

    for (let rowIndex = 0; rowIndex < sheetRows.length; rowIndex += 1) {
      const row = sheetRows[rowIndex];
      if (isBlankTrackerRow(row)) continue;

      rows.push({
        sheetName,
        rowNumber: rowIndex + 5,
        setName: sheetName,
        cardNumber: cellText(row[1]),
        cardName: cellText(row[2]),
        marketPrice: parseMoney(row[4]),
      });
    }
  }

  return rows;
}

function readFlattenedRows(workbook: XLSX.WorkBook): ImportRow[] {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Import file has no sheets.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });

  return rows.map((row, index) => ({
    sheetName,
    rowNumber: index + 2,
    setName: cellText(firstCell(row, ["set", "set name"])),
    cardNumber: cellText(firstCell(row, ["card number", "card no", "number", "no"])),
    cardName: cellText(firstCell(row, ["card name", "name"])),
    marketPrice: parseMoney(
      firstCell(row, [
        "market price",
        "market value",
        "manual price",
        "manual market price",
        "price",
        "value",
        "value mkt",
        "estimated value",
      ]),
    ),
  }));
}

function readRows(filePath: string): ImportRow[] {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const extension = path.extname(filePath).toLowerCase();
  const hasTrackerSheets = expectedWorkbookSheets.some((sheetName) => workbook.Sheets[sheetName]);

  if ((extension === ".xlsx" || extension === ".xls") && hasTrackerSheets) {
    return readTrackerWorkbookRows(workbook);
  }

  return readFlattenedRows(workbook);
}

function cardKey(setName: string, cardNumber: string, cardName: string) {
  return `${normalizeText(setName)}|${normalizeNumber(cardNumber)}|${normalizeText(cardName)}`;
}

function chooseVariant(card: ExistingCard) {
  const masterVariants = card.variants.filter((variant) => variant.isMasterSetCandidate);
  const firstEditionMaster = masterVariants.filter((variant) => variant.edition === "FIRST_EDITION");
  const candidates = firstEditionMaster.length > 0 ? firstEditionMaster : masterVariants;

  return candidates.length === 1 ? candidates[0] : null;
}

function printReport({
  filePath,
  sheetReports,
  rowsRead,
  matchedRows,
  unmatchedRows,
  skippedRows,
}: {
  filePath: string;
  sheetReports: SheetReport[];
  rowsRead: number;
  matchedRows: MatchedRow[];
  unmatchedRows: UnmatchedRow[];
  skippedRows: ImportRow[];
}) {
  const totalImportedMarketValue = matchedRows.reduce((total, row) => total + (row.marketPrice ?? 0), 0);

  console.log("Manual spreadsheet price import report");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "APPLY"}`);
  console.log(`Source: ${filePath}`);
  console.log(`Sheets processed: ${sheetReports.length}`);
  console.log(`Rows read: ${rowsRead}`);
  console.log(`Rows matched: ${matchedRows.length}`);
  console.log(`Rows unmatched: ${unmatchedRows.length}`);
  console.log(`Rows skipped because no price: ${skippedRows.length}`);
  console.log(`Total imported market value: $${totalImportedMarketValue.toFixed(2)}`);

  if (sheetReports.length > 0) {
    console.log("\nSheet summary:");
    console.table(sheetReports);
  }

  if (unmatchedRows.length > 0) {
    console.log("\nUnmatched rows:");
    unmatchedRows.forEach((row) =>
      console.log(
        `- ${row.sheetName} row ${row.rowNumber}: ${row.setName || "(missing set)"} ${row.cardNumber || "(missing number)"} ${row.cardName || "(missing name)"} - ${row.reason}`,
      ),
    );
  }

  if (skippedRows.length > 0) {
    console.log("\nSkipped rows without prices:");
    skippedRows.slice(0, 25).forEach((row) =>
      console.log(
        `- ${row.sheetName} row ${row.rowNumber}: ${row.setName || "(missing set)"} ${row.cardNumber || "(missing number)"} ${row.cardName || "(missing name)"}`,
      ),
    );
    if (skippedRows.length > 25) {
      console.log(`...and ${skippedRows.length - 25} more`);
    }
  }
}

function buildSheetReports(
  rows: ImportRow[],
  matchedRows: MatchedRow[],
  unmatchedRows: UnmatchedRow[],
  skippedRows: ImportRow[],
) {
  const sheetNames = Array.from(new Set(rows.map((row) => row.sheetName)));

  return sheetNames.map((sheetName) => ({
    sheetName,
    rowsRead: rows.filter((row) => row.sheetName === sheetName).length,
    matched: matchedRows.filter((row) => row.sheetName === sheetName).length,
    unmatched: unmatchedRows.filter((row) => row.sheetName === sheetName).length,
    skippedNoPrice: skippedRows.filter((row) => row.sheetName === sheetName).length,
  }));
}

async function main() {
  const filePath = resolveImportFile();
  const rows = readRows(filePath);
  const cards = await prisma.card.findMany({
    include: {
      set: { select: { name: true } },
      variants: {
        select: {
          id: true,
          edition: true,
          isMasterSetCandidate: true,
        },
      },
    },
  });
  const cardsByKey = new Map(cards.map((card) => [cardKey(card.set.name, card.cardNumber, card.name), card]));

  const matchedRows: MatchedRow[] = [];
  const unmatchedRows: UnmatchedRow[] = [];
  const skippedRows: ImportRow[] = [];

  for (const row of rows) {
    if (row.marketPrice === null) {
      skippedRows.push(row);
      continue;
    }

    if (!row.setName || !row.cardNumber || !row.cardName) {
      unmatchedRows.push({ ...row, reason: "Missing set, card number, or card name" });
      continue;
    }

    const card = cardsByKey.get(cardKey(row.setName, row.cardNumber, row.cardName));
    if (!card) {
      unmatchedRows.push({ ...row, reason: "No existing card matched set + card number + card name" });
      continue;
    }

    const variant = chooseVariant(card);
    if (!variant) {
      unmatchedRows.push({ ...row, reason: `Expected one master variant, found ${card.variants.length}` });
      continue;
    }

    matchedRows.push({ ...row, variantId: variant.id });
  }

  printReport({
    filePath,
    sheetReports: buildSheetReports(rows, matchedRows, unmatchedRows, skippedRows),
    rowsRead: rows.length,
    matchedRows,
    unmatchedRows,
    skippedRows,
  });

  if (dryRun) {
    console.log("\nDry run only. No database changes were written.");
    return;
  }

  const importedAt = new Date();
  await prisma.$transaction(async (transaction) => {
    for (const row of matchedRows) {
      await transaction.cardVariant.update({
        where: { id: row.variantId },
        data: {
          estimatedValue: row.marketPrice ?? 0,
          marketPrice: row.marketPrice,
          marketPriceSource: importSource,
          marketPriceStatus: "MANUAL",
          marketPriceUpdatedAt: importedAt,
        },
      });

      await transaction.priceSnapshot.create({
        data: {
          variantId: row.variantId,
          source: importSource,
          marketPrice: row.marketPrice ?? 0,
          capturedAt: importedAt,
          notes: `Imported from manual spreadsheet ${row.sheetName} row ${row.rowNumber}.`,
        },
      });
    }
  });

  console.log(`\nImport complete. Updated ${matchedRows.length} variants and created ${matchedRows.length} price snapshots.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
