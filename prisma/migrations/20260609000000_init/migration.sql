CREATE TABLE "PokemonSet" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Card" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "setId" INTEGER NOT NULL,
  "cardNumber" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rarity" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'POKEMON',
  "displayOrder" INTEGER NOT NULL,
  "artist" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Card_setId_fkey" FOREIGN KEY ("setId") REFERENCES "PokemonSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CardVariant" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "cardId" INTEGER NOT NULL,
  "slug" TEXT NOT NULL,
  "edition" TEXT NOT NULL DEFAULT 'FIRST_EDITION',
  "finish" TEXT NOT NULL DEFAULT 'NON_HOLO',
  "language" TEXT NOT NULL DEFAULT 'ENGLISH',
  "isMasterSetCandidate" BOOLEAN NOT NULL DEFAULT true,
  "estimatedValue" REAL NOT NULL DEFAULT 0,
  "targetBuyPrice" REAL,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CardVariant_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CollectionItem" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "variantId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OWNED',
  "condition" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
  "gradingCompany" TEXT NOT NULL DEFAULT 'RAW',
  "grade" TEXT,
  "purchasePrice" REAL,
  "acquiredAt" DATETIME,
  "acquisitionSource" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "storageLocation" TEXT NOT NULL DEFAULT 'Binder',
  "notes" TEXT NOT NULL DEFAULT '',
  "isPrimaryCopy" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CollectionItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "CardVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PriceSnapshot" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "variantId" INTEGER NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "marketPrice" REAL NOT NULL,
  "lowPrice" REAL,
  "highPrice" REAL,
  "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "PriceSnapshot_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "CardVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SaleRecord" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "collectionItemId" INTEGER NOT NULL,
  "soldPrice" REAL NOT NULL,
  "soldAt" DATETIME NOT NULL,
  "marketplace" TEXT NOT NULL DEFAULT 'Unknown',
  "fees" REAL NOT NULL DEFAULT 0,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaleRecord_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PokemonSet_slug_key" ON "PokemonSet"("slug");
CREATE INDEX "PokemonSet_displayOrder_idx" ON "PokemonSet"("displayOrder");
CREATE INDEX "PokemonSet_era_language_idx" ON "PokemonSet"("era", "language");
CREATE UNIQUE INDEX "Card_setId_cardNumber_name_key" ON "Card"("setId", "cardNumber", "name");
CREATE INDEX "Card_setId_idx" ON "Card"("setId");
CREATE INDEX "Card_setId_displayOrder_idx" ON "Card"("setId", "displayOrder");
CREATE UNIQUE INDEX "CardVariant_slug_key" ON "CardVariant"("slug");
CREATE INDEX "CardVariant_cardId_idx" ON "CardVariant"("cardId");
CREATE INDEX "CardVariant_edition_finish_language_idx" ON "CardVariant"("edition", "finish", "language");
CREATE INDEX "CardVariant_isMasterSetCandidate_idx" ON "CardVariant"("isMasterSetCandidate");
CREATE INDEX "CollectionItem_variantId_idx" ON "CollectionItem"("variantId");
CREATE INDEX "CollectionItem_status_idx" ON "CollectionItem"("status");
CREATE INDEX "CollectionItem_gradingCompany_idx" ON "CollectionItem"("gradingCompany");
CREATE INDEX "PriceSnapshot_variantId_idx" ON "PriceSnapshot"("variantId");
CREATE INDEX "PriceSnapshot_source_idx" ON "PriceSnapshot"("source");
CREATE INDEX "PriceSnapshot_capturedAt_idx" ON "PriceSnapshot"("capturedAt");
CREATE INDEX "SaleRecord_collectionItemId_idx" ON "SaleRecord"("collectionItemId");
CREATE INDEX "SaleRecord_soldAt_idx" ON "SaleRecord"("soldAt");
