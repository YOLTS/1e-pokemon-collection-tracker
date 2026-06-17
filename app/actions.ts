"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CARD_CONDITION, GRADING_COMPANY, OWNERSHIP_STATUS, PRICE_SOURCE } from "@/lib/domain";
import { prisma } from "@/lib/prisma";

function parseOptionalMoney(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function toggleVariantOwned(formData: FormData) {
  const variantId = Number(formData.get("variantId"));
  const owned = formData.get("owned") === "true";
  const setSlug = String(formData.get("setSlug") ?? "");

  if (!Number.isInteger(variantId)) {
    return;
  }

  const existingPrimaryCopy = await prisma.collectionItem.findFirst({
    where: {
      variantId,
      isPrimaryCopy: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (owned) {
    if (existingPrimaryCopy) {
      await prisma.collectionItem.update({
        where: { id: existingPrimaryCopy.id },
        data: {
          status: OWNERSHIP_STATUS.OWNED,
          isPrimaryCopy: true,
        },
      });
    } else {
      await prisma.collectionItem.create({
        data: {
          variantId,
          status: OWNERSHIP_STATUS.OWNED,
          condition: CARD_CONDITION.NOT_ASSESSED,
          gradingCompany: GRADING_COMPANY.RAW,
          storageLocation: "Binder",
          notes: "Added from quick toggle.",
          isPrimaryCopy: true,
        },
      });
    }
  }

  if (!owned && existingPrimaryCopy?.status === OWNERSHIP_STATUS.OWNED) {
    await prisma.collectionItem.update({
      where: { id: existingPrimaryCopy.id },
      data: {
        status: OWNERSHIP_STATUS.MISSING,
        isPrimaryCopy: true,
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/sets");
  revalidatePath("/cards");
  if (setSlug) {
    revalidatePath(`/sets/${setSlug}`);
  }
}

export async function updateVariantDetails(formData: FormData) {
  const variantId = Number(formData.get("variantId"));
  const setSlug = String(formData.get("setSlug") ?? "");
  const condition = String(formData.get("condition") ?? CARD_CONDITION.NOT_ASSESSED);
  const purchasePrice = parseOptionalMoney(formData.get("purchasePrice"));
  const estimatedValue = parseOptionalMoney(formData.get("estimatedValue")) ?? 0;
  const notes = String(formData.get("notes") ?? "").trim();

  if (!Number.isInteger(variantId)) {
    return;
  }

  const variant = await prisma.cardVariant.findUnique({
    where: { id: variantId },
    include: { ownedItems: { where: { isPrimaryCopy: true }, take: 1 } },
  });

  if (!variant) {
    return;
  }

  const primaryCopy = variant.ownedItems[0];
  const marketPriceUpdatedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.cardVariant.update({
      where: { id: variantId },
      data: {
        estimatedValue,
        marketPrice: estimatedValue,
        marketPriceSource: PRICE_SOURCE.MANUAL_APP_EDIT,
        marketPriceStatus: "MANUAL",
        marketPriceUpdatedAt,
        notes: primaryCopy?.status === OWNERSHIP_STATUS.OWNED ? variant.notes : notes,
      },
    });

    await tx.priceSnapshot.create({
      data: {
        variantId,
        source: PRICE_SOURCE.MANUAL_APP_EDIT,
        marketPrice: estimatedValue,
        capturedAt: marketPriceUpdatedAt,
        notes: "Manual estimated value saved in app.",
      },
    });

    if (primaryCopy) {
      await tx.collectionItem.update({
        where: { id: primaryCopy.id },
        data: {
          condition,
          purchasePrice,
          notes,
        },
      });
    } else {
      await tx.collectionItem.create({
        data: {
          variantId,
          status: OWNERSHIP_STATUS.MISSING,
          condition,
          gradingCompany: GRADING_COMPANY.RAW,
          purchasePrice,
          notes,
          isPrimaryCopy: true,
        },
      });
    }
  });

  revalidatePath("/");
  revalidatePath("/sets");
  revalidatePath("/cards");
  revalidatePath(`/cards/${variantId}`);
  if (setSlug) {
    revalidatePath(`/sets/${setSlug}`);
  }

  redirect(`/cards/${variantId}?saved=1`);
}
