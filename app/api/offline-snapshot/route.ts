import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildOfflineIntelligence,
  buildOfflineSetMetrics,
  OFFLINE_SNAPSHOT_SCHEMA_VERSION,
  summarizeOfflineVariants,
  type OfflineCard,
  type OfflineCollectionItem,
  type OfflineRecentItem,
  type OfflineSet,
  type OfflineSnapshot,
  type OfflineVariant,
} from "@/lib/offline-snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isoDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function collectionItemSnapshot(item: {
  id: number;
  variantId: number;
  status: string;
  condition: string;
  gradingCompany: string;
  grade: string | null;
  purchasePrice: number | null;
  acquiredAt: Date | null;
  acquisitionSource: string;
  storageLocation: string;
  notes: string;
  isPrimaryCopy: boolean;
  createdAt: Date;
  updatedAt: Date;
}): OfflineCollectionItem {
  return {
    id: item.id,
    variantId: item.variantId,
    status: item.status,
    condition: item.condition,
    gradingCompany: item.gradingCompany,
    grade: item.grade,
    purchasePrice: item.purchasePrice,
    acquiredAt: isoDate(item.acquiredAt),
    acquisitionSource: item.acquisitionSource,
    storageLocation: item.storageLocation,
    notes: item.notes,
    isPrimaryCopy: item.isPrimaryCopy,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function GET() {
  const [setsWithCards, recentItems] = await Promise.all([
    prisma.pokemonSet.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        cards: {
          orderBy: { displayOrder: "asc" },
          include: {
            variants: {
              orderBy: { id: "asc" },
              include: {
                ownedItems: {
                  orderBy: [{ isPrimaryCopy: "desc" }, { updatedAt: "desc" }],
                },
              },
            },
          },
        },
      },
    }),
    prisma.collectionItem.findMany({
      where: { status: "OWNED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        variant: {
          include: {
            card: {
              include: { set: true },
            },
          },
        },
      },
    }),
  ]);

  const sets: OfflineSet[] = setsWithCards.map((set) => ({
    id: set.id,
    name: set.name,
    slug: set.slug,
    series: set.series,
    era: set.era,
    language: set.language,
    releaseYear: set.releaseYear,
    totalCards: set.totalCards,
    firstEdition: set.firstEdition,
    symbol: set.symbol,
    symbolLabel: set.symbolLabel,
    color: set.color,
    displayOrder: set.displayOrder,
  }));

  const cards: OfflineCard[] = setsWithCards.flatMap((set) =>
    set.cards.map((card) => ({
      id: card.id,
      setId: card.setId,
      cardNumber: card.cardNumber,
      name: card.name,
      rarity: card.rarity,
      category: card.category,
      displayOrder: card.displayOrder,
      artist: card.artist,
      imageUrlSmall: card.imageUrlSmall,
      imageUrlLarge: card.imageUrlLarge,
      imageSource: card.imageSource,
      imageMatchStatus: card.imageMatchStatus,
    })),
  );

  const variants: OfflineVariant[] = setsWithCards.flatMap((set) =>
    set.cards.flatMap((card) =>
      card.variants.map((variant) => ({
        id: variant.id,
        cardId: variant.cardId,
        slug: variant.slug,
        edition: variant.edition,
        finish: variant.finish,
        language: variant.language,
        isMasterSetCandidate: variant.isMasterSetCandidate,
        estimatedValue: variant.estimatedValue,
        targetBuyPrice: variant.targetBuyPrice,
        marketPrice: variant.marketPrice,
        marketPriceSource: variant.marketPriceSource,
        marketPriceStatus: variant.marketPriceStatus,
        marketPriceBucket: variant.marketPriceBucket,
        marketPriceUpdatedAt: isoDate(variant.marketPriceUpdatedAt),
        notes: variant.notes,
        card: {
          id: card.id,
          setId: card.setId,
          cardNumber: card.cardNumber,
          name: card.name,
          rarity: card.rarity,
          category: card.category,
          displayOrder: card.displayOrder,
          artist: card.artist,
          imageUrlSmall: card.imageUrlSmall,
          imageUrlLarge: card.imageUrlLarge,
          imageSource: card.imageSource,
          imageMatchStatus: card.imageMatchStatus,
          set: {
            name: set.name,
            slug: set.slug,
            symbol: set.symbol,
            symbolLabel: set.symbolLabel,
            color: set.color,
            releaseYear: set.releaseYear,
          },
        },
        ownedItems: variant.ownedItems.map(collectionItemSnapshot),
      })),
    ),
  );

  const summary = summarizeOfflineVariants(variants);
  const setMetrics = buildOfflineSetMetrics(sets, variants);
  const intelligence = buildOfflineIntelligence(variants, setMetrics);
  const collectionItemsCount = variants.reduce((total, variant) => total + variant.ownedItems.length, 0);
  const snapshotRecentItems: OfflineRecentItem[] = recentItems.map((item) => ({
    id: item.id,
    createdAt: item.createdAt.toISOString(),
    condition: item.condition,
    gradingCompany: item.gradingCompany,
    variantId: item.variantId,
    cardName: item.variant.card.name,
    cardNumber: item.variant.card.cardNumber,
    setName: item.variant.card.set.name,
    marketPrice: item.variant.marketPrice ?? (item.variant.estimatedValue > 0 ? item.variant.estimatedValue : null),
  }));

  const snapshot: OfflineSnapshot = {
    schemaVersion: OFFLINE_SNAPSHOT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: "NEON_POSTGRES",
    counts: {
      sets: sets.length,
      cards: cards.length,
      variants: variants.length,
      collectionItems: collectionItemsCount,
    },
    sets,
    cards,
    variants,
    dashboard: {
      summary,
      setMetrics,
      recentItems: snapshotRecentItems,
      intelligence,
    },
  };

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
