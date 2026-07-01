-- CreateTable
CREATE TABLE "Warehouse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT OR IGNORE INTO "Warehouse" ("name", "createdAt", "updatedAt")
VALUES ('Main Warehouse', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_StockHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "variantId" INTEGER,
    "productId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "change" INTEGER NOT NULL,
    "mode" TEXT,
    "reason" TEXT,
    "reference" TEXT,
    "adminId" INTEGER,
    "type" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockHistory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockHistory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockHistory_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StockHistory" ("adminId", "change", "createdAt", "id", "mode", "productId", "reason", "reference", "type", "variantId", "warehouseId")
SELECT "adminId", "change", "createdAt", "id", "mode", "productId", "reason", "reference", "type", "variantId",
       COALESCE("warehouseId", (SELECT "id" FROM "Warehouse" WHERE "name" = 'Main Warehouse'))
FROM "StockHistory";
DROP TABLE "StockHistory";
ALTER TABLE "new_StockHistory" RENAME TO "StockHistory";
CREATE INDEX "StockHistory_variantId_idx" ON "StockHistory"("variantId");
CREATE INDEX "StockHistory_productId_idx" ON "StockHistory"("productId");
CREATE INDEX "StockHistory_warehouseId_idx" ON "StockHistory"("warehouseId");
CREATE INDEX "StockHistory_adminId_idx" ON "StockHistory"("adminId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_name_key" ON "Warehouse"("name");
