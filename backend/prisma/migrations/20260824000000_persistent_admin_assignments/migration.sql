BEGIN;

ALTER TABLE "User"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "AdminAssignment" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "storeId" INTEGER,
  "brandId" INTEGER,
  "role" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminAssignment_userId_role_storeId_brandId_key"
  ON "AdminAssignment"("userId", "role", "storeId", "brandId");
CREATE INDEX "AdminAssignment_userId_isActive_idx"
  ON "AdminAssignment"("userId", "isActive");
CREATE INDEX "AdminAssignment_storeId_role_isActive_idx"
  ON "AdminAssignment"("storeId", "role", "isActive");
CREATE INDEX "AdminAssignment_brandId_role_isActive_idx"
  ON "AdminAssignment"("brandId", "role", "isActive");

ALTER TABLE "AdminAssignment"
  ADD CONSTRAINT "AdminAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminAssignment"
  ADD CONSTRAINT "AdminAssignment_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminAssignment"
  ADD CONSTRAINT "AdminAssignment_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AdminAssignment" ("userId", "storeId", "role", "isActive", "createdAt", "updatedAt")
SELECT
  "id",
  CASE WHEN "role" = 'SUPER_ADMIN' THEN NULL ELSE "storeId" END,
  "role",
  "isActive",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User"
WHERE "role" IN ('SUPER_ADMIN', 'ADMIN', 'BRAND_MANAGER', 'INVENTORY_MANAGER', 'ORDER_MANAGER', 'MARKETING_MANAGER')
  AND "isActive" = true
  AND ("role" = 'SUPER_ADMIN' OR "storeId" IS NOT NULL);

COMMIT;
