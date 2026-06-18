import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { CARD_CONDITION, GRADING_COMPANY, OWNERSHIP_STATUS, PRICE_SOURCE } from "@/lib/domain";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SyncMutationType = "SET_OWNED" | "UPDATE_MARKET_PRICE";
type SyncMutationStatus = "APPLIED" | "ALREADY_APPLIED" | "FAILED" | "CONFLICT";

type SyncMutationResult = {
  localMutationId: string;
  type: SyncMutationType;
  status: SyncMutationStatus;
  syncedAt: string;
  serverResult?: Record<string, unknown>;
  error?: string | null;
};

type SyncMutationInput = {
  localMutationId: string;
  type: SyncMutationType;
  payload: unknown;
  createdAt?: string;
  updatedAt?: string;
  baseSnapshotGeneratedAt?: string | null;
  baseServerUpdatedAt?: string | null;
};

type SetOwnedPayload = {
  variantId: number;
  setSlug?: string;
  owned: boolean;
};

type UpdateMarketPricePayload = {
  variantId: number;
  setSlug?: string;
  newEstimatedValue: number;
  newMarketPrice: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSupportedMutationType(value: unknown): value is SyncMutationType {
  return value === "SET_OWNED" || value === "UPDATE_MARKET_PRICE";
}

function parseMutations(value: unknown): SyncMutationInput[] {
  if (!isRecord(value) || !Array.isArray(value.mutations)) {
    throw new Error("Request body must include a mutations array.");
  }

  return value.mutations.map((mutation, index) => {
    if (!isRecord(mutation)) {
      throw new Error(`Mutation ${index} must be an object.`);
    }

    if (typeof mutation.localMutationId !== "string" || mutation.localMutationId.trim() === "") {
      throw new Error(`Mutation ${index} is missing localMutationId.`);
    }

    if (!isSupportedMutationType(mutation.type)) {
      throw new Error(`Mutation ${index} has unsupported type.`);
    }

    return {
      localMutationId: mutation.localMutationId,
      type: mutation.type,
      payload: mutation.payload,
      createdAt: typeof mutation.createdAt === "string" ? mutation.createdAt : undefined,
      updatedAt: typeof mutation.updatedAt === "string" ? mutation.updatedAt : undefined,
      baseSnapshotGeneratedAt:
        typeof mutation.baseSnapshotGeneratedAt === "string" || mutation.baseSnapshotGeneratedAt === null
          ? mutation.baseSnapshotGeneratedAt
          : undefined,
      baseServerUpdatedAt:
        typeof mutation.baseServerUpdatedAt === "string" || mutation.baseServerUpdatedAt === null
          ? mutation.baseServerUpdatedAt
          : undefined,
    };
  });
}

function parseSetOwnedPayload(payload: unknown): SetOwnedPayload {
  if (!isRecord(payload)) {
    throw new Error("SET_OWNED payload must be an object.");
  }

  const variantId = payload.variantId;
  const owned = payload.owned;
  const setSlug = payload.setSlug;

  if (typeof variantId !== "number" || !Number.isInteger(variantId)) {
    throw new Error("SET_OWNED payload requires an integer variantId.");
  }

  if (typeof owned !== "boolean") {
    throw new Error("SET_OWNED payload requires a boolean owned value.");
  }

  return {
    variantId,
    owned,
    setSlug: typeof setSlug === "string" ? setSlug : undefined,
  };
}

function parseUpdateMarketPricePayload(payload: unknown): UpdateMarketPricePayload {
  if (!isRecord(payload)) {
    throw new Error("UPDATE_MARKET_PRICE payload must be an object.");
  }

  const variantId = payload.variantId;
  const newEstimatedValue = payload.newEstimatedValue;
  const newMarketPrice = payload.newMarketPrice;
  const setSlug = payload.setSlug;

  if (typeof variantId !== "number" || !Number.isInteger(variantId)) {
    throw new Error("UPDATE_MARKET_PRICE payload requires an integer variantId.");
  }

  if (typeof newEstimatedValue !== "number" || !Number.isFinite(newEstimatedValue) || newEstimatedValue < 0) {
    throw new Error("UPDATE_MARKET_PRICE payload requires a non-negative newEstimatedValue.");
  }

  if (typeof newMarketPrice !== "number" || !Number.isFinite(newMarketPrice) || newMarketPrice < 0) {
    throw new Error("UPDATE_MARKET_PRICE payload requires a non-negative newMarketPrice.");
  }

  return {
    variantId,
    newEstimatedValue,
    newMarketPrice,
    setSlug: typeof setSlug === "string" ? setSlug : undefined,
  };
}

function failedResult(mutation: Pick<SyncMutationInput, "localMutationId" | "type">, error: unknown): SyncMutationResult {
  return {
    localMutationId: mutation.localMutationId,
    type: mutation.type,
    status: "FAILED",
    syncedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : "Unknown sync mutation error.",
  };
}

function revalidationPathsFor(variantId: number, setSlug?: string) {
  return [
    "/",
    "/sets",
    "/cards",
    `/cards/${variantId}`,
    ...(setSlug ? [`/sets/${setSlug}`] : []),
  ];
}

async function applySetOwnedMutation(mutation: SyncMutationInput, pathsToRevalidate: Set<string>) {
  const payload = parseSetOwnedPayload(mutation.payload);

  return prisma.$transaction(async (tx) => {
    const existingReceipt = await tx.syncMutationReceipt.findUnique({
      where: { localMutationId: mutation.localMutationId },
    });

    if (existingReceipt) {
      return {
        localMutationId: mutation.localMutationId,
        type: mutation.type,
        status: "ALREADY_APPLIED",
        syncedAt: new Date().toISOString(),
        serverResult: isRecord(existingReceipt.result) ? existingReceipt.result : undefined,
        error: null,
      } satisfies SyncMutationResult;
    }

    const variant = await tx.cardVariant.findUnique({
      where: { id: payload.variantId },
      select: { id: true },
    });

    if (!variant) {
      return {
        localMutationId: mutation.localMutationId,
        type: mutation.type,
        status: "CONFLICT",
        syncedAt: new Date().toISOString(),
        error: `Variant ${payload.variantId} was not found.`,
      } satisfies SyncMutationResult;
    }

    const existingPrimaryCopy = await tx.collectionItem.findFirst({
      where: {
        variantId: payload.variantId,
        isPrimaryCopy: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    let collectionItemId: number | null = existingPrimaryCopy?.id ?? null;

    if (payload.owned) {
      if (existingPrimaryCopy) {
        const updatedCopy = await tx.collectionItem.update({
          where: { id: existingPrimaryCopy.id },
          data: {
            status: OWNERSHIP_STATUS.OWNED,
            isPrimaryCopy: true,
          },
        });
        collectionItemId = updatedCopy.id;
      } else {
        const createdCopy = await tx.collectionItem.create({
          data: {
            variantId: payload.variantId,
            status: OWNERSHIP_STATUS.OWNED,
            condition: CARD_CONDITION.NOT_ASSESSED,
            gradingCompany: GRADING_COMPANY.RAW,
            storageLocation: "Binder",
            notes: "Added from quick toggle.",
            isPrimaryCopy: true,
          },
        });
        collectionItemId = createdCopy.id;
      }
    }

    if (!payload.owned && existingPrimaryCopy?.status === OWNERSHIP_STATUS.OWNED) {
      const updatedCopy = await tx.collectionItem.update({
        where: { id: existingPrimaryCopy.id },
        data: {
          status: OWNERSHIP_STATUS.MISSING,
          isPrimaryCopy: true,
        },
      });
      collectionItemId = updatedCopy.id;
    }

    const result = {
      variantId: payload.variantId,
      setSlug: payload.setSlug ?? null,
      collectionItemId,
      owned: payload.owned,
    };

    await tx.syncMutationReceipt.create({
      data: {
        localMutationId: mutation.localMutationId,
        type: mutation.type,
        result,
      },
    });

    revalidationPathsFor(payload.variantId, payload.setSlug).forEach((path) => pathsToRevalidate.add(path));

    return {
      localMutationId: mutation.localMutationId,
      type: mutation.type,
      status: "APPLIED",
      syncedAt: new Date().toISOString(),
      serverResult: result,
      error: null,
    } satisfies SyncMutationResult;
  });
}

async function applyUpdateMarketPriceMutation(mutation: SyncMutationInput, pathsToRevalidate: Set<string>) {
  const payload = parseUpdateMarketPricePayload(mutation.payload);

  return prisma.$transaction(async (tx) => {
    const existingReceipt = await tx.syncMutationReceipt.findUnique({
      where: { localMutationId: mutation.localMutationId },
    });

    if (existingReceipt) {
      return {
        localMutationId: mutation.localMutationId,
        type: mutation.type,
        status: "ALREADY_APPLIED",
        syncedAt: new Date().toISOString(),
        serverResult: isRecord(existingReceipt.result) ? existingReceipt.result : undefined,
        error: null,
      } satisfies SyncMutationResult;
    }

    const variant = await tx.cardVariant.findUnique({
      where: { id: payload.variantId },
      select: { id: true },
    });

    if (!variant) {
      return {
        localMutationId: mutation.localMutationId,
        type: mutation.type,
        status: "CONFLICT",
        syncedAt: new Date().toISOString(),
        error: `Variant ${payload.variantId} was not found.`,
      } satisfies SyncMutationResult;
    }

    const marketPriceUpdatedAt = new Date();

    await tx.cardVariant.update({
      where: { id: payload.variantId },
      data: {
        estimatedValue: payload.newEstimatedValue,
        marketPrice: payload.newMarketPrice,
        marketPriceSource: PRICE_SOURCE.MANUAL_APP_EDIT,
        marketPriceStatus: "MANUAL",
        marketPriceUpdatedAt,
      },
    });

    const priceSnapshot = await tx.priceSnapshot.create({
      data: {
        variantId: payload.variantId,
        source: PRICE_SOURCE.MANUAL_APP_EDIT,
        marketPrice: payload.newMarketPrice,
        capturedAt: marketPriceUpdatedAt,
        notes: "Manual estimated value synced from offline app.",
      },
    });

    const result = {
      variantId: payload.variantId,
      setSlug: payload.setSlug ?? null,
      estimatedValue: payload.newEstimatedValue,
      marketPrice: payload.newMarketPrice,
      priceSnapshotId: priceSnapshot.id,
    };

    await tx.syncMutationReceipt.create({
      data: {
        localMutationId: mutation.localMutationId,
        type: mutation.type,
        result,
      },
    });

    revalidationPathsFor(payload.variantId, payload.setSlug).forEach((path) => pathsToRevalidate.add(path));

    return {
      localMutationId: mutation.localMutationId,
      type: mutation.type,
      status: "APPLIED",
      syncedAt: new Date().toISOString(),
      serverResult: result,
      error: null,
    } satisfies SyncMutationResult;
  });
}

async function applyMutation(mutation: SyncMutationInput, pathsToRevalidate: Set<string>) {
  if (mutation.type === "SET_OWNED") {
    return applySetOwnedMutation(mutation, pathsToRevalidate);
  }

  if (mutation.type === "UPDATE_MARKET_PRICE") {
    return applyUpdateMarketPriceMutation(mutation, pathsToRevalidate);
  }

  return failedResult(mutation, `Unsupported mutation type ${mutation.type}.`);
}

export async function POST(request: Request) {
  let mutations: SyncMutationInput[];

  try {
    mutations = parseMutations(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        syncedAt: new Date().toISOString(),
        results: [],
        error: error instanceof Error ? error.message : "Invalid sync mutation request.",
      },
      { status: 400 },
    );
  }

  const pathsToRevalidate = new Set<string>();
  const results: SyncMutationResult[] = [];

  for (const mutation of mutations) {
    try {
      results.push(await applyMutation(mutation, pathsToRevalidate));
    } catch (error) {
      results.push(failedResult(mutation, error));
    }
  }

  pathsToRevalidate.forEach((path) => revalidatePath(path));

  return NextResponse.json(
    {
      syncedAt: new Date().toISOString(),
      results,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
