ALTER TABLE "CardVariant" ADD COLUMN "marketPrice" REAL;
ALTER TABLE "CardVariant" ADD COLUMN "marketPriceSource" TEXT;
ALTER TABLE "CardVariant" ADD COLUMN "marketPriceStatus" TEXT NOT NULL DEFAULT 'UNAVAILABLE';
ALTER TABLE "CardVariant" ADD COLUMN "marketPriceBucket" TEXT;
ALTER TABLE "CardVariant" ADD COLUMN "marketPriceUpdatedAt" DATETIME;

CREATE INDEX "CardVariant_marketPriceStatus_idx" ON "CardVariant"("marketPriceStatus");
