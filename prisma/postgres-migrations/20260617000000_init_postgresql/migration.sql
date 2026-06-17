-- CreateTable
CREATE TABLE "PokemonSet" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "era" TEXT NOT NULL DEFAULT 'WOTC_VINTAGE',
    "language" TEXT NOT NULL DEFAULT 'ENGLISH',
    "releaseYear" INTEGER NOT NULL,
    "totalCards" INTEGER NOT NULL,
    "firstEdition" BOOLEAN NOT NULL DEFAULT true,
    "symbol" TEXT NOT NULL,
    "symbolLabel" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PokemonSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" SERIAL NOT NULL,
    "setId" INTEGER NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'POKEMON',
    "displayOrder" INTEGER NOT NULL,
    "artist" TEXT,
    "imageUrlSmall" TEXT,
    "imageUrlLarge" TEXT,
    "imageSource" TEXT,
    "imageMatchStatus" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardVariant" (
    "id" SERIAL NOT NULL,
    "cardId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "edition" TEXT NOT NULL DEFAULT 'FIRST_EDITION',
    "finish" TEXT NOT NULL DEFAULT 'NON_HOLO',
    "language" TEXT NOT NULL DEFAULT 'ENGLISH',
    "isMasterSetCandidate" BOOLEAN NOT NULL DEFAULT true,
    "estimatedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetBuyPrice" DOUBLE PRECISION,
    "marketPrice" DOUBLE PRECISION,
    "marketPriceSource" TEXT,
    "marketPriceStatus" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
    "marketPriceBucket" TEXT,
    "marketPriceUpdatedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" SERIAL NOT NULL,
    "variantId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OWNED',
    "condition" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "gradingCompany" TEXT NOT NULL DEFAULT 'RAW',
    "grade" TEXT,
    "purchasePrice" DOUBLE PRECISION,
    "acquiredAt" TIMESTAMP(3),
    "acquisitionSource" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "storageLocation" TEXT NOT NULL DEFAULT 'Binder',
    "notes" TEXT NOT NULL DEFAULT '',
    "isPrimaryCopy" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" SERIAL NOT NULL,
    "variantId" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "marketPrice" DOUBLE PRECISION NOT NULL,
    "lowPrice" DOUBLE PRECISION,
    "highPrice" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleRecord" (
    "id" SERIAL NOT NULL,
    "collectionItemId" INTEGER NOT NULL,
    "soldPrice" DOUBLE PRECISION NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL,
    "marketplace" TEXT NOT NULL DEFAULT 'Unknown',
    "fees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PokemonSet_slug_key" ON "PokemonSet"("slug");

-- CreateIndex
CREATE INDEX "PokemonSet_displayOrder_idx" ON "PokemonSet"("displayOrder");

-- CreateIndex
CREATE INDEX "PokemonSet_era_language_idx" ON "PokemonSet"("era", "language");

-- CreateIndex
CREATE INDEX "Card_setId_idx" ON "Card"("setId");

-- CreateIndex
CREATE INDEX "Card_setId_displayOrder_idx" ON "Card"("setId", "displayOrder");

-- CreateIndex
CREATE INDEX "Card_imageMatchStatus_idx" ON "Card"("imageMatchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Card_setId_cardNumber_name_key" ON "Card"("setId", "cardNumber", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CardVariant_slug_key" ON "CardVariant"("slug");

-- CreateIndex
CREATE INDEX "CardVariant_cardId_idx" ON "CardVariant"("cardId");

-- CreateIndex
CREATE INDEX "CardVariant_edition_finish_language_idx" ON "CardVariant"("edition", "finish", "language");

-- CreateIndex
CREATE INDEX "CardVariant_isMasterSetCandidate_idx" ON "CardVariant"("isMasterSetCandidate");

-- CreateIndex
CREATE INDEX "CardVariant_marketPriceStatus_idx" ON "CardVariant"("marketPriceStatus");

-- CreateIndex
CREATE INDEX "CollectionItem_variantId_idx" ON "CollectionItem"("variantId");

-- CreateIndex
CREATE INDEX "CollectionItem_status_idx" ON "CollectionItem"("status");

-- CreateIndex
CREATE INDEX "CollectionItem_gradingCompany_idx" ON "CollectionItem"("gradingCompany");

-- CreateIndex
CREATE INDEX "PriceSnapshot_variantId_idx" ON "PriceSnapshot"("variantId");

-- CreateIndex
CREATE INDEX "PriceSnapshot_source_idx" ON "PriceSnapshot"("source");

-- CreateIndex
CREATE INDEX "PriceSnapshot_capturedAt_idx" ON "PriceSnapshot"("capturedAt");

-- CreateIndex
CREATE INDEX "SaleRecord_collectionItemId_idx" ON "SaleRecord"("collectionItemId");

-- CreateIndex
CREATE INDEX "SaleRecord_soldAt_idx" ON "SaleRecord"("soldAt");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_setId_fkey" FOREIGN KEY ("setId") REFERENCES "PokemonSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardVariant" ADD CONSTRAINT "CardVariant_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "CardVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "CardVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRecord" ADD CONSTRAINT "SaleRecord_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
