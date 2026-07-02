-- Migration: 20260702_add_images_and_variants
-- Purpose: Backfill legacy Product.images, Product.countInStock, Product.warehouse
-- into normalized tables: ProductImage, ProductVariant, StockHistory (Warehouse mapping).
-- REVIEW this file carefully before executing. This script is written for SQLite.

PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

-- Ensure Main Warehouse exists
CREATE TABLE IF NOT EXISTS "Warehouse" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL UNIQUE,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME
);

INSERT OR IGNORE INTO "Warehouse" ("name","createdAt","updatedAt") VALUES ('Main Warehouse', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Create ProductImage table if missing (idempotent)
CREATE TABLE IF NOT EXISTS "ProductImage" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "productId" INTEGER NOT NULL,
  "url" TEXT NOT NULL,
  "altText" TEXT,
  "sortOrder" INTEGER DEFAULT 0,
  "isPrimary" INTEGER DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME
);
CREATE INDEX IF NOT EXISTS "ProductImage_productId_idx" ON "ProductImage"("productId");

-- Create ProductVariant table if missing (idempotent)
CREATE TABLE IF NOT EXISTS "ProductVariant" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "productId" INTEGER NOT NULL,
  "sku" TEXT UNIQUE,
  "size" TEXT,
  "color" TEXT,
  "priceOverride" REAL,
  "quantityOnHand" INTEGER DEFAULT 0,
  "reorderThreshold" INTEGER DEFAULT 5,
  "status" TEXT DEFAULT 'ACTIVE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME
);
CREATE INDEX IF NOT EXISTS "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX IF NOT EXISTS "ProductVariant_sku_idx" ON "ProductVariant"("sku");

-- Create StockHistory table if missing (schema name/columns may differ; adapt if your DB uses different naming)
CREATE TABLE IF NOT EXISTS "StockHistory" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "variantId" INTEGER,
  "productId" INTEGER NOT NULL,
  "warehouseId" INTEGER,
  "change" INTEGER NOT NULL,
  "mode" TEXT,
  "reason" TEXT,
  "reference" TEXT,
  "adminId" INTEGER,
  "type" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "StockHistory_variantId_idx" ON "StockHistory"("variantId");
CREATE INDEX IF NOT EXISTS "StockHistory_productId_idx" ON "StockHistory"("productId");
CREATE INDEX IF NOT EXISTS "StockHistory_warehouseId_idx" ON "StockHistory"("warehouseId");

-- 1) Backfill ProductImage from legacy JSON array in Product.images
-- This uses json_each for JSON arrays (SQLite JSON1). If your images column stores JSON arrays, this will insert each element.
-- Only run the JSON path if images begins with '['
INSERT INTO "ProductImage" ("productId","url","createdAt","updatedAt")
SELECT p."id", json_each.value, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Product" p, json_each(p."images")
WHERE p."images" IS NOT NULL
  AND trim(p."images") <> ''
  AND substr(trim(p."images"),1,1) = '[';

-- 1b) Backfill ProductImage from comma-separated list (fallback)
WITH RECURSIVE split(productId, rest, url) AS (
  SELECT id, (COALESCE(images,'') || ','), NULL FROM "Product" WHERE images IS NOT NULL AND images <> '' AND substr(trim(images),1,1) != '['
  UNION ALL
  SELECT productId,
         substr(rest, instr(rest, ',')+1),
         trim(substr(rest,1, instr(rest,',')-1))
  FROM split
  WHERE rest <> ''
)
INSERT INTO "ProductImage" ("productId","url","createdAt","updatedAt")
SELECT productId, url, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM split WHERE url IS NOT NULL AND url <> '';

-- 2) Create a default ProductVariant per product if none exist, preserving countInStock
INSERT INTO "ProductVariant" ("productId","sku","size","color","priceOverride","quantityOnHand","reorderThreshold","status","createdAt","updatedAt")
SELECT p."id",
       ('SKU-' || p."slug" || '-DEF') AS sku,
       NULL AS size,
       NULL AS color,
       NULL AS priceOverride,
       COALESCE(p."countInStock",0) AS quantityOnHand,
       COALESCE(p."lowStockAlert",5) AS reorderThreshold,
       'ACTIVE' AS status,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "Product" p
WHERE NOT EXISTS (SELECT 1 FROM "ProductVariant" pv WHERE pv."productId" = p."id");

-- 3) Insert a StockHistory initial row for legacy countInStock values (map warehouse name to Warehouse.id, fallback to Main Warehouse)
INSERT INTO "StockHistory" ("variantId","productId","warehouseId","change","mode","reason","reference","adminId","type","createdAt")
SELECT pv."id", p."id",
       COALESCE((SELECT w."id" FROM "Warehouse" w WHERE w."name" = p."warehouse"), (SELECT w2."id" FROM "Warehouse" w2 WHERE w2."name" = 'Main Warehouse')) AS warehouseId,
       COALESCE(p."countInStock",0) AS change,
       'MIGRATION_BACKFILL' AS mode,
       'migrated from Product.countInStock & Product.warehouse' AS reason,
       NULL, NULL, 'PURCHASE_IN', CURRENT_TIMESTAMP
FROM "Product" p
JOIN "ProductVariant" pv ON pv."productId" = p."id"
WHERE COALESCE(p."countInStock",0) <> 0;

-- 4) Optional: remove legacy columns from Product (COMMENTED OUT — enable only after you confirm backfill success)
-- ALTER TABLE "Product" RENAME TO "old_Product";
-- CREATE TABLE "Product" ( ... new schema without legacy columns ... );
-- INSERT INTO "Product"(col1, col2, ...) SELECT col1, col2, ... FROM "old_Product";
-- DROP TABLE "old_Product";

COMMIT;
PRAGMA foreign_keys=ON;

-- End of migration file
