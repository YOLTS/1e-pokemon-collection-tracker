import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apiBaseUrl = "https://api.pokemontcg.io/v2";
const imageSource = "pokemon-tcg-api";
const applyChanges = process.argv.includes("--apply");

type ApiSet = {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  releaseDate: string;
};

type ApiCard = {
  id: string;
  name: string;
  number: string;
  images?: {
    small?: string;
    large?: string;
  };
};

type ApiResponse<T> = {
  data: T[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
};

type MatchStatus = "MATCHED" | "UNMATCHED" | "AMBIGUOUS";

type MatchResult = {
  cardId: number;
  setName: string;
  cardNumber: string;
  cardName: string;
  status: MatchStatus;
  apiCard?: ApiCard;
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
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  let response: Response;

  try {
    response = await fetch(url, { headers: apiHeaders(), signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Pokémon TCG API request timed out after 60 seconds for ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(`Pokémon TCG API request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as ApiResponse<T>;
}

async function fetchAllSets() {
  const response = await fetchApi<ApiSet>("/sets", {
    pageSize: "250",
    select: "id,name,series,printedTotal,total,releaseDate",
  });
  return response.data;
}

async function fetchCardsForSet(setId: string) {
  const response = await fetchApi<ApiCard>("/cards", {
    q: `set.id:${setId}`,
    pageSize: "250",
    select: "id,name,number,images",
  });

  if (response.totalCount > response.pageSize) {
    throw new Error(`Set ${setId} returned more than 250 cards; pagination is required.`);
  }

  return response.data;
}

function resolveApiSet(
  localSet: { name: string; releaseYear: number; totalCards: number },
  apiSets: ApiSet[],
) {
  const acceptedNames = [localSet.name, ...(setNameAliases[localSet.name] ?? [])].map(normalizeText);
  const candidates = apiSets.filter(
    (set) =>
      acceptedNames.includes(normalizeText(set.name)) &&
      releaseYear(set.releaseDate) === localSet.releaseYear &&
      (set.printedTotal === localSet.totalCards || set.total === localSet.totalCards),
  );

  if (candidates.length === 1) {
    return { status: "MATCHED" as const, set: candidates[0] };
  }

  return {
    status: candidates.length > 1 ? ("AMBIGUOUS" as const) : ("UNMATCHED" as const),
    candidates,
  };
}

function matchCard(
  card: { id: number; name: string; cardNumber: string; set: { name: string } },
  apiCards: ApiCard[],
): MatchResult {
  const number = normalizeNumber(card.cardNumber);
  const name = normalizeText(card.name);
  const exactCandidates = apiCards.filter(
    (candidate) => normalizeNumber(candidate.number) === number && normalizeText(candidate.name) === name,
  );

  if (exactCandidates.length === 1) {
    const candidate = exactCandidates[0];
    if (!candidate.images?.small || !candidate.images?.large) {
      return {
        cardId: card.id,
        setName: card.set.name,
        cardNumber: card.cardNumber,
        cardName: card.name,
        status: "UNMATCHED",
        reason: `API card ${candidate.id} has incomplete image URLs`,
      };
    }

    return {
      cardId: card.id,
      setName: card.set.name,
      cardNumber: card.cardNumber,
      cardName: card.name,
      status: "MATCHED",
      apiCard: candidate,
      reason: `Matched ${candidate.id} by set, number, and name`,
    };
  }

  if (exactCandidates.length > 1) {
    return {
      cardId: card.id,
      setName: card.set.name,
      cardNumber: card.cardNumber,
      cardName: card.name,
      status: "AMBIGUOUS",
      reason: `${exactCandidates.length} API cards matched set, number, and name`,
    };
  }

  const sameNumber = apiCards.filter((candidate) => normalizeNumber(candidate.number) === number);
  const sameName = apiCards.filter((candidate) => normalizeText(candidate.name) === name);

  if (sameNumber.length > 1 || sameName.length > 1) {
    return {
      cardId: card.id,
      setName: card.set.name,
      cardNumber: card.cardNumber,
      cardName: card.name,
      status: "AMBIGUOUS",
      reason: `No exact match; ${sameNumber.length} number candidates and ${sameName.length} name candidates`,
    };
  }

  return {
    cardId: card.id,
    setName: card.set.name,
    cardNumber: card.cardNumber,
    cardName: card.name,
    status: "UNMATCHED",
    reason:
      sameNumber.length === 1
        ? `Number matched ${sameNumber[0].id}, but name differed (${sameNumber[0].name})`
        : sameName.length === 1
          ? `Name matched ${sameName[0].id}, but number differed (${sameName[0].number})`
          : "No API card matched both number and name",
  };
}

function printSummary(results: MatchResult[], setIssues: string[]) {
  const counts = results.reduce(
    (summary, result) => {
      summary[result.status.toLowerCase() as "matched" | "unmatched" | "ambiguous"] += 1;
      return summary;
    },
    { matched: 0, unmatched: 0, ambiguous: 0 },
  );

  console.log("Pokémon TCG API image match summary");
  console.log(`Mode: ${applyChanges ? "APPLY" : "DRY RUN"}`);
  console.log(`Cards evaluated: ${results.length}`);
  console.log(`Matched: ${counts.matched}`);
  console.log(`Unmatched: ${counts.unmatched}`);
  console.log(`Ambiguous: ${counts.ambiguous}`);
  console.log(`Set resolution issues: ${setIssues.length}`);

  if (setIssues.length > 0) {
    console.log("\nSet resolution issues:");
    setIssues.forEach((issue) => console.log(`- ${issue}`));
  }

  const reviewItems = results.filter((result) => result.status !== "MATCHED");
  if (reviewItems.length > 0) {
    console.log("\nCards requiring review:");
    for (const result of reviewItems) {
      console.log(`- [${result.status}] ${result.setName} ${result.cardNumber} ${result.cardName}: ${result.reason}`);
    }
  }

  return counts;
}

async function main() {
  console.log(`Fetching Pokémon TCG API catalog${process.env.POKEMON_TCG_API_KEY ? " with API key" : " without API key"}...`);

  const [localSets, apiSets] = await Promise.all([
    prisma.pokemonSet.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        cards: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            name: true,
            cardNumber: true,
            imageUrlSmall: true,
            imageUrlLarge: true,
            set: { select: { name: true } },
          },
        },
      },
    }),
    fetchAllSets(),
  ]);

  const results: MatchResult[] = [];
  const setIssues: string[] = [];

  for (const localSet of localSets) {
    const setResolution = resolveApiSet(localSet, apiSets);
    if (setResolution.status !== "MATCHED") {
      const reason =
        setResolution.status === "AMBIGUOUS"
          ? `${setResolution.candidates.length} API sets matched`
          : "No API set matched name, release year, and total";
      setIssues.push(`${localSet.name}: ${reason}`);
      for (const card of localSet.cards) {
        results.push({
          cardId: card.id,
          setName: localSet.name,
          cardNumber: card.cardNumber,
          cardName: card.name,
          status: setResolution.status,
          reason: `Set unresolved: ${reason}`,
        });
      }
      continue;
    }

    console.log(`Fetching ${localSet.name} (${setResolution.set.id})...`);
    const apiCards = await fetchCardsForSet(setResolution.set.id);
    results.push(...localSet.cards.map((card) => matchCard(card, apiCards)));
  }

  const counts = printSummary(results, setIssues);

  if (!applyChanges) {
    console.log("\nDry run only. No database rows were changed.");
    console.log("Run with --apply after reviewing this summary to write image metadata.");
    return;
  }

  console.log("\nWriting image match results...");
  await prisma.$transaction(
    results.map((result) =>
      prisma.card.update({
        where: { id: result.cardId },
        data:
          result.status === "MATCHED" && result.apiCard
            ? {
                imageUrlSmall: result.apiCard.images?.small,
                imageUrlLarge: result.apiCard.images?.large,
                imageSource,
                imageMatchStatus: "MATCHED",
              }
            : {
                imageMatchStatus: result.status,
              },
      }),
    ),
  );

  console.log(`Update complete: ${counts.matched} image records populated.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
