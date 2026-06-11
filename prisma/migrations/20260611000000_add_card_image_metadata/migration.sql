ALTER TABLE "Card" ADD COLUMN "imageUrlSmall" TEXT;
ALTER TABLE "Card" ADD COLUMN "imageUrlLarge" TEXT;
ALTER TABLE "Card" ADD COLUMN "imageSource" TEXT;
ALTER TABLE "Card" ADD COLUMN "imageMatchStatus" TEXT NOT NULL DEFAULT 'UNMATCHED';

CREATE INDEX "Card_imageMatchStatus_idx" ON "Card"("imageMatchStatus");
