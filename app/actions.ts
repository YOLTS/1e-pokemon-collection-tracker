"use server";

import { revalidatePath } from "next/cache";
import { CARD_CONDITION, GRADING_COMPANY, OWNERSHIP_STATUS } from "@/lib/domain";
import { prisma } from "@/lib/prisma";

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
