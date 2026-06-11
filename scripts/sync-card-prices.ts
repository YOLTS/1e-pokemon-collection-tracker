import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apiBaseUrl = "https://api.pokemontcg.io/v2";
const priceSource = "POKEMON_TCG_API_TCGPLAYER";
const manualSource = "MANUAL";
const applyChanges = process.argv.includes("--apply");

type ApiSet = {
  id: string;
  name: string;
  printedTotal: number;
  total: number;
  releaseDate: string;
};

type ApiPrice = {
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  market?: number | null;
  directLow?: number | null;
};

type ApiCard = {
  id: string;
  name: string;
  number: string;
  tcgplayer?: {
    updatedAt?: string;
    prices?: Record<string, ApiPrice | undefined>;
  };
};

type ApiResponse<T> = {
  data: T[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
};

type PriceStatus = "EXACT_1ST_EDITION" | "UNAVAILABLE";

type PriceResult = {
  variantId: number;
  cardLabel: string;
  status: PriceStatus;
  bucket: "1stEditionHolofoil" | "1stEditionNormal";
  marketPrice?: number;
  lowPrice?: number;
  highPrice?: number;
  updatedAt?: Date;
  genericFallbackSkipped: boolean;
  manualSkipped: boolean;
  reason: string;
};

const setNameAliases: Record<string, string[]> = {
  "Base Set": ["Base"],
};

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[’‘]/g, "'")
    .replace(/♀/g, " female ")
    .replace(/♂/g, " male ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeNumber(value: string) {
  const printedNumber = value.split("/")[0]?.trim() ?? value.trim();
  const numeric = Number(printedNumber);
  return Number.isFinite(numeric) ? String(numeric) : normalizeText(printedNumber);
}

function releaseYear(releaseDate: string) {
  return Number(releaseDate.slice(0, 4));
}

function apiHeaders() {
  const apiKey = process.env.POKEMON_TCG_API_KEY;
  return apiKey ? { "X-Api-Key": apiKey } : undefined;
}

async function fetchApi<T>(path: string, params: Record<string, string>) {
  const url = new URL(`${apiBaseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(url, { headers: apiHeaders(), signal: controller.signal });
    if (!response.ok) throw new Error(`Pokemon TCG API request failed (${response.status}) for ${url}`);
    return (await response.json()) as ApiResponse<T>;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAllSets() {
  const response = await fetchApi<ApiSet>("/sets", {
    pageSize: "250",
    select: "id,name,printedTotal,total,releaseDate",
  });
  return response.data;
}

async function fetchCardsForSet(setId: string) {
  const response = await fetchApi<ApiCard>("/cards", {
    q: `set.id:${setId}`,
    pageSize: "250",
    select: "id,name,number,tcgplayer",
  });
  if (response.totalCount > response.pageSize) {
    throw new Error(`Set ${setId} returned more than 250 cards; pagination is required.`);
  }
  return response.data;
}

function resolveApiSet(localSet: { name: string; releaseYear: number; totalCards: number }, apiSets: ApiSet[]) {
  const acceptedNames = [localSet.name, ...(setNameAliases[localSet.name] ?? [])].map(normalizeText);
  const candidates = apiSets.filter(
    (set) =>
      acceptedNames.includes(normalizeText(set.name)) &&
      releaseYear(set.releaseDate) === localSet.releaseYear &&
      (set.printedTotal === localSet.totalCards || set.total === localSet.totalCards),
  );
  return candidates.length === 1 ? candidates[0] : null;
}

function exactApiCard(card: { name: string; cardNumber: string }, apiCards: ApiCard[]) {
  const candidates = apiCards.filter(
    (candidate) =>
      normalizeNumber(candidate.number) === normalizeNumber(card.cardNumber) &&
      normalizeText(candidate.name) === normalizeText(card.name),
  );
  return candidates.length === 1 ? candidates[0] : null;
}

function parseApiDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(`${value.replaceAll("/", "-")}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function priceResult(
  variant: {
    id: number;
    finish: string;
    marketPriceSource: string | null;
    card: { name: string; cardNumber: string; set: { name: string } };
  },
  apiCard: ApiCard | null,
): PriceResult {
  const bucket = variant.finish === "HOLO" ? "1stEditionHolofoil" : "1stEditionNormal";
  const genericBucket = variant.finish === "HOLO" ? "holofoil" : "normal";
  const label = `${variant.card.set.name} ${variant.card.cardNumber} ${variant.card.name}`;

  if (variant.marketPriceSource === manualSource) {
    return {
      variantId: variant.id,
      cardLabel: label,
      status: "UNAVAILABLE",
      bucket,
      genericFallbackSkipped: false,
      manualSkipped: true,
      reason: "Existing manual market price preserved",
    };
  }

  if (!apiCard) {
    return {
      variantId: variant.id,
      cardLabel: label,
      status: "UNAVAILABLE",
      bucket,
      genericFallbackSkipped: false,
      manualSkipped: false,
      reason: "No unique Pokemon TCG API card match",
    };
  }

  const prices = apiCard.tcgplayer?.prices;
  const exactPrice = prices?.[bucket];
  const marketPrice = exactPrice?.market;
  if (typeof marketPrice === "number" && Number.isFinite(marketPrice)) {
    return {
      variantId: variant.id,
      cardLabel: label,
      status: "EXACT_1ST_EDITION",
      bucket,
      marketPrice,
      lowPrice: typeof exactPrice?.low === "number" ? exactPrice.low : undefined,
      highPrice: typeof exactPrice?.high === "number" ? exactPrice.high : undefined,
      updatedAt: parseApiDate(apiCard.tcgplayer?.updatedAt),
      genericFallbackSkipped: false,
      manualSkipped: false,
      reason: `Exact ${bucket} market price from ${apiCard.id}`,
    };
  }

  const genericFallbackSkipped = Boolean(prices?.[genericBucket]?.market || prices?.reverseHolofoil?.market);
  return {
    variantId: variant.id,
    cardLabel: label,
    status: "UNAVAILABLE",
    bucket,
    updatedAt: parseApiDate(apiCard.tcgplayer?.updatedAt),
    genericFallbackSkipped,
    manualSkipped: false,
    reason: genericFallbackSkipped
      ? `Exact ${bucket} unavailable; generic pricing deliberately skipped`
      : `Exact ${bucket} market price unavailable`,
  };
}

function printSummary(results: PriceResult[], setIssues: string[]) {
  const exact = results.filter((result) => result.status === "EXACT_1ST_EDITION").length;
  const unavailable = results.filter((result) => result.status === "UNAVAILABLE" && !result.manualSkipped).length;
  const skippedGeneric = results.filter((result) => result.genericFallbackSkipped).length;
  const manualSkipped = results.filter((result) => result.manualSkipped).length;

  console.log("Pokemon TCG API provisional pricing summary");
  console.log(`Mode: ${applyChanges ? "APPLY" : "DRY RUN"}`);
  console.log(`Variants evaluated: ${results.length}`);
  console.log(`Exact 1st Edition prices: ${exact}`);
  console.log(`Unavailable exact prices: ${unavailable}`);
  console.log(`Generic fallbacks skipped: ${skippedGeneric}`);
  console.log(`Manual prices preserved: ${manualSkipped}`);
  console.log(`Set resolution issues: ${setIssues.length}`);

  if (setIssues.length) {
    console.log("\nSet resolution issues:");
    setIssues.forEach((issue) => console.log(`- ${issue}`));
  }

  const examples = results.filter((result) => result.status === "EXACT_1ST_EDITION").slice(0, 10);
  if (examples.length) {
    console.log("\nExact price examples:");
    examples.forEach((result) => console.log(`- ${result.cardLabel}: $${result.marketPrice?.toFixed(2)} (${result.bucket})`));
  }

  return { exact, unavailable, skippedGeneric, manualSkipped };
}

async function main() {
  console.log(`Fetching Pokemon TCG API pricing${process.env.POKEMON_TCG_API_KEY ? " with API key" : " without API key"}...`);
  const [localSets, apiSets] = await Promise.all([
    prisma.pokemonSet.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        cards: {
          orderBy: { displayOrder: "asc" },
          include: {
            set: { select: { name: true } },
            variants: {
              orderBy: { id: "asc" },
              select: { id: true, finish: true, marketPriceSource: true },
            },
          },
        },
      },
    }),
    fetchAllSets(),
  ]);

  const results: PriceResult[] = [];
  const setIssues: string[] = [];

  for (const localSet of localSets) {
    const apiSet = resolveApiSet(localSet, apiSets);
    if (!apiSet) {
      setIssues.push(`${localSet.name}: no unique API set match`);
      for (const card of localSet.cards) {
        for (const variant of card.variants) results.push(priceResult({ ...variant, card }, null));
      }
      continue;
    }

    console.log(`Fetching ${localSet.name} pricing (${apiSet.id})...`);
    const apiCards = await fetchCardsForSet(apiSet.id);
    for (const card of localSet.cards) {
      const apiCard = exactApiCard(card, apiCards);
      for (const variant of card.variants) results.push(priceResult({ ...variant, card }, apiCard));
    }
  }

  printSummary(results, setIssues);

  if (!applyChanges) {
    console.log("\nDry run only. No database rows were changed.");
    console.log("Run npm.cmd run prices:sync -- --apply after reviewing this summary.");
    return;
  }

  console.log("\nWriting provisional price metadata...");
  await prisma.$transaction(async (transaction) => {
    for (const result of results) {
      if (result.manualSkipped) continue;

      if (result.status === "EXACT_1ST_EDITION" && result.marketPrice !== undefined) {
        await transaction.cardVariant.update({
          where: { id: result.variantId },
          data: {
            marketPrice: result.marketPrice,
            marketPriceSource: priceSource,
            marketPriceStatus: result.status,
            marketPriceBucket: result.bucket,
            marketPriceUpdatedAt: result.updatedAt ?? new Date(),
          },
        });
        const capturedAt = result.updatedAt ?? new Date();
        const existingSnapshot = await transaction.priceSnapshot.findFirst({
          where: {
            variantId: result.variantId,
            source: priceSource,
            marketPrice: result.marketPrice,
            capturedAt,
          },
          select: { id: true },
        });
        if (!existingSnapshot) {
          await transaction.priceSnapshot.create({
            data: {
              variantId: result.variantId,
              source: priceSource,
              marketPrice: result.marketPrice,
              lowPrice: result.lowPrice,
              highPrice: result.highPrice,
              capturedAt,
              notes: `Exact TCGplayer ${result.bucket} price.`,
            },
          });
        }
      } else {
        await transaction.cardVariant.update({
          where: { id: result.variantId },
          data: {
            marketPrice: null,
            marketPriceSource: priceSource,
            marketPriceStatus: "UNAVAILABLE",
            marketPriceBucket: result.bucket,
            marketPriceUpdatedAt: result.updatedAt ?? null,
          },
        });
      }
    }
  });

  console.log("Pricing update complete. Manual estimated values and ownership records were not modified.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
