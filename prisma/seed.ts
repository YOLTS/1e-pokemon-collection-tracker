import path from "node:path";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import {
  ACQUISITION_SOURCE,
  CARD_CATEGORY,
  CARD_CONDITION,
  EDITION,
  FINISH,
  GRADING_COMPANY,
  OWNERSHIP_STATUS,
  PRICE_SOURCE,
} from "../lib/domain";

const prisma = new PrismaClient();

const spreadsheetPath =
  process.env.POKEMON_CHECKLIST_XLSX ??
  path.join(process.env.USERPROFILE ?? "", "Desktop", "WOTC_1st_Edition_Pokemon_Checklist_FINAL.xlsx");

const expectedSets = [
  { name: "Base Set", slug: "base-set", series: "Base", releaseYear: 1999, symbol: "BS", symbolLabel: "Base starburst", color: "#f43f5e" },
  { name: "Jungle", slug: "jungle", series: "Jungle", releaseYear: 1999, symbol: "JG", symbolLabel: "Jungle flower", color: "#22c55e" },
  { name: "Fossil", slug: "fossil", series: "Fossil", releaseYear: 1999, symbol: "FO", symbolLabel: "Fossil claw", color: "#f59e0b" },
  { name: "Team Rocket", slug: "team-rocket", series: "Team Rocket", releaseYear: 2000, symbol: "TR", symbolLabel: "Rocket R", color: "#64748b" },
  { name: "Gym Heroes", slug: "gym-heroes", series: "Gym", releaseYear: 2000, symbol: "GH", symbolLabel: "Gym Heroes badge", color: "#38bdf8" },
  { name: "Gym Challenge", slug: "gym-challenge", series: "Gym", releaseYear: 2000, symbol: "GC", symbolLabel: "Gym Challenge badge", color: "#a855f7" },
  { name: "Neo Genesis", slug: "neo-genesis", series: "Neo", releaseYear: 2000, symbol: "NG", symbolLabel: "Neo Genesis symbol", color: "#14b8a6" },
  { name: "Neo Discovery", slug: "neo-discovery", series: "Neo", releaseYear: 2001, symbol: "ND", symbolLabel: "Neo Discovery symbol", color: "#eab308" },
  { name: "Neo Revelation", slug: "neo-revelation", series: "Neo", releaseYear: 2001, symbol: "NR", symbolLabel: "Neo Revelation symbol", color: "#fb7185" },
  { name: "Neo Destiny", slug: "neo-destiny", series: "Neo", releaseYear: 2002, symbol: "NDe", symbolLabel: "Neo Destiny symbol", color: "#8b5cf6" },
] as const;

type SetSeed = (typeof expectedSets)[number] & {
  totalCards: number;
  cards: CardSeed[];
};

type CardSeed = {
  displayOrder: number;
  cardNumber: string;
  name: string;
  rarity: string;
  category: string;
  finish: string;
  owned: boolean;
  notes: string;
  purchasePrice: number | null;
  paidLabel: string | null;
  marketValue: number | null;
  sourceRow: number;
};

type ImportSummary = {
  spreadsheetPath: string;
  setsFound: number;
  cardsFound: number;
  ownedCardsFound: number;
  skippedRows: string[];
  warnings: string[];
  errors: string[];
  perSet: { name: string; cards: number; owned: number }[];
};

function cellText(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function numericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function slugPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function variantSlug(setSlug: string, cardNumber: string, name: string, finish: string) {
  return `${setSlug}-${slugPart(cardNumber)}-${slugPart(name)}-first-edition-${slugPart(finish)}`;
}

function inferCategory(rarity: string) {
  return rarity === "Energy" ? CARD_CATEGORY.ENERGY : CARD_CATEGORY.POKEMON;
}

function inferFinish(rarity: string) {
  if (rarity === "Rare Holo" || rarity === "Rare Shining" || rarity === "Rare Secret") {
    return FINISH.HOLO;
  }

  return FINISH.NON_HOLO;
}

function buildCollectionNotes(notes: string, paidLabel: string | null) {
  const parts = [notes];
  if (paidLabel) {
    parts.push(`Paid value: ${paidLabel}`);
  }

  return parts.filter(Boolean).join(" | ");
}

function parseWorkbook(): { sets: SetSeed[]; summary: ImportSummary } {
  const workbook = XLSX.readFile(spreadsheetPath, { cellDates: false });
  const skippedRows: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const sets = expectedSets.map((set, setIndex) => {
    const sheet = workbook.Sheets[set.name];
    if (!sheet) {
      errors.push(`Missing expected sheet: ${set.name}`);
      return { ...set, totalCards: 0, cards: [] };
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: null,
    });

    const cards: CardSeed[] = [];
    for (let rowIndex = 2; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const sourceRow = rowIndex + 1;
      const displayOrder = typeof row[0] === "number" ? row[0] : null;
      const cardNumber = cellText(row[1]);
      const name = cellText(row[2]);
      const rarity = cellText(row[3]);
      const ownedValue = cellText(row[4]);
      const notes = cellText(row[5]);
      const paid = row[6];
      const market = row[7];

      if (!displayOrder && !cardNumber && !name && !rarity) {
        skippedRows.push(`${set.name} row ${sourceRow}: empty/trailing row`);
        continue;
      }

      if (!displayOrder || !cardNumber || !name || !rarity) {
        skippedRows.push(`${set.name} row ${sourceRow}: non-card row or incomplete card data`);
        continue;
      }

      if (ownedValue !== "Yes" && ownedValue !== "No") {
        warnings.push(`${set.name} ${cardNumber}: unexpected Owned value "${ownedValue || "(blank)"}"; treating as No`);
      }

      const purchasePrice = numericValue(paid);
      const paidLabel = paid !== null && paid !== undefined && purchasePrice === null ? cellText(paid) : null;
      const marketValue = numericValue(market);
      if (market !== null && market !== undefined && marketValue === null) {
        warnings.push(`${set.name} ${cardNumber}: non-numeric market value "${cellText(market)}" ignored`);
      }

      cards.push({
        displayOrder,
        cardNumber,
        name,
        rarity,
        category: inferCategory(rarity),
        finish: inferFinish(rarity),
        owned: ownedValue === "Yes",
        notes,
        purchasePrice,
        paidLabel,
        marketValue,
        sourceRow,
      });
    }

    if (cards.length === 0) {
      warnings.push(`${set.name}: no cards parsed`);
    }

    return {
      ...set,
      displayOrder: setIndex + 1,
      totalCards: cards.length,
      cards,
    };
  });

  const cardsFound = sets.reduce((total, set) => total + set.cards.length, 0);
  const ownedCardsFound = sets.reduce(
    (total, set) => total + set.cards.filter((card) => card.owned).length,
    0,
  );

  return {
    sets,
    summary: {
      spreadsheetPath,
      setsFound: sets.filter((set) => set.cards.length > 0).length,
      cardsFound,
      ownedCardsFound,
      skippedRows,
      warnings,
      errors,
      perSet: sets.map((set) => ({
        name: set.name,
        cards: set.cards.length,
        owned: set.cards.filter((card) => card.owned).length,
      })),
    },
  };
}

function printSummary(summary: ImportSummary) {
  console.log("Spreadsheet import summary");
  console.log(`Source: ${summary.spreadsheetPath}`);
  console.log(`Sets found: ${summary.setsFound}`);
  console.log(`Cards found: ${summary.cardsFound}`);
  console.log(`Owned cards found: ${summary.ownedCardsFound}`);
  console.log(`Skipped rows: ${summary.skippedRows.length}`);
  console.log(`Warnings: ${summary.warnings.length}`);
  console.log(`Errors: ${summary.errors.length}`);
  console.table(summary.perSet);

  if (summary.skippedRows.length > 0) {
    console.log("Skipped rows:");
    for (const row of summary.skippedRows) {
      console.log(`- ${row}`);
    }
  }

  if (summary.warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of summary.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (summary.errors.length > 0) {
    console.log("Errors:");
    for (const error of summary.errors) {
      console.log(`- ${error}`);
    }
  }
}

async function writeDatabase(sets: SetSeed[]) {
  await prisma.saleRecord.deleteMany();
  await prisma.priceSnapshot.deleteMany();
  await prisma.collectionItem.deleteMany();
  await prisma.cardVariant.deleteMany();
  await prisma.card.deleteMany();
  await prisma.pokemonSet.deleteMany();

  for (let setIndex = 0; setIndex < sets.length; setIndex += 1) {
    const set = sets[setIndex];
    const createdSet = await prisma.pokemonSet.create({
      data: {
        name: set.name,
        slug: set.slug,
        series: set.series,
        releaseYear: set.releaseYear,
        totalCards: set.totalCards,
        symbol: set.symbol,
        symbolLabel: set.symbolLabel,
        color: set.color,
        displayOrder: setIndex + 1,
      },
    });

    for (const cardData of set.cards) {
      const card = await prisma.card.create({
        data: {
          setId: createdSet.id,
          displayOrder: cardData.displayOrder,
          cardNumber: cardData.cardNumber,
          name: cardData.name,
          rarity: cardData.rarity,
          category: cardData.category,
        },
      });

      const estimatedValue = cardData.marketValue ?? 0;
      const variant = await prisma.cardVariant.create({
        data: {
          cardId: card.id,
          slug: variantSlug(set.slug, cardData.cardNumber, cardData.name, cardData.finish),
          edition: EDITION.FIRST_EDITION,
          finish: cardData.finish,
          estimatedValue,
          notes: cardData.owned ? "" : cardData.notes,
        },
      });

      if (cardData.marketValue !== null) {
        await prisma.priceSnapshot.create({
          data: {
            variantId: variant.id,
            source: PRICE_SOURCE.MANUAL,
            marketPrice: cardData.marketValue,
            notes: "Imported from spreadsheet Value (Mkt).",
          },
        });
      }

      if (cardData.owned) {
        await prisma.collectionItem.create({
          data: {
            variantId: variant.id,
            status: OWNERSHIP_STATUS.OWNED,
            condition: CARD_CONDITION.NOT_ASSESSED,
            gradingCompany: GRADING_COMPANY.RAW,
            purchasePrice: cardData.purchasePrice,
            acquisitionSource: ACQUISITION_SOURCE.UNKNOWN,
            notes: buildCollectionNotes(cardData.notes, cardData.paidLabel),
            isPrimaryCopy: true,
          },
        });
      }
    }
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { sets, summary } = parseWorkbook();

  printSummary(summary);

  if (summary.errors.length > 0) {
    throw new Error("Import aborted because the spreadsheet had errors.");
  }

  if (dryRun) {
    console.log("Dry run only. No database changes were written.");
    return;
  }

  console.log("Writing spreadsheet-derived data to the database...");
  await writeDatabase(sets);
  console.log("Import complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
