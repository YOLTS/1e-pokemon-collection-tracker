# Pokemon Vintage Collection Tracker

A local-first web app for tracking English 1st Edition vintage Pokemon cards. The project starts with Base Set, Jungle, and Fossil sample data, while the architecture is prepared for the full WOTC 1st Edition run from Base Set through Neo Destiny.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite for local development

## Current Features

- Portfolio-style dashboard with master completion, owned cards, missing cards, estimated collection value, and estimated remaining cost.
- Master progress donut and set-specific progress bars.
- Sets page covering all 10 English vintage sets that include 1st Edition cards.
- Individual set pages with variant tables.
- Cards page with all seeded variants or a selected set filter.
- Owned/missing toggle backed by collection inventory records.
- Raw and graded card fields, including condition, grading company, grade, notes, estimated value, and purchase price.
- Placeholder manual price snapshots for future pricing API integrations.

## Architecture Notes

The data model separates collection concepts so the app can grow without a rewrite:

- `PokemonSet`: set catalog metadata, set symbol, era, language, checklist total.
- `Card`: canonical card identity within a set.
- `CardVariant`: edition, language, finish, master-set eligibility, estimated value.
- `CollectionItem`: owned inventory copy, condition, grading, purchase price, storage, duplicates.
- `PriceSnapshot`: manual values today, pricing API snapshots later.
- `SaleRecord`: future sales history support.

This supports future Japanese sets, PSA population data, wishlist status, duplicate inventory, pricing APIs, and sales tracking.

## Spreadsheet Source Of Truth

The seed command imports collection data from the workbook:

```text
C:\Users\jofus\Desktop\WOTC_1st_Edition_Pokemon_Checklist_FINAL.xlsx
```

You can override that path with `POKEMON_CHECKLIST_XLSX`.

The importer reads all 10 workbook sheets, preserves spreadsheet card order, imports owned status, rarity, notes, paid value, and market value, and replaces existing local seed data.

Run a dry-run summary before writing:

```bash
npm run prisma:seed -- --dry-run
```

Import into SQLite:

```bash
npm run prisma:seed
```

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create the local SQLite database:

```bash
npm run prisma:migrate -- --name init
```

3. Preview the spreadsheet import:

```bash
npm run prisma:seed -- --dry-run
```

4. Import spreadsheet data:

```bash
npm run prisma:seed
```

5. Start the app:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000).

## Useful Commands

```bash
npm run lint
npm run build
npm run prisma:generate
npm run prisma:migrate -- --name your_migration_name
npm run prisma:seed -- --dry-run
npm run prisma:seed
```

## Reset Local Data

Delete `prisma/dev.db`, then run:

```bash
npm run prisma:migrate -- --name init
npm run prisma:seed
```
