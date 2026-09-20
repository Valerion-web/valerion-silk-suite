ALTER TABLE "Order"
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "requestFingerprint" TEXT,
ADD COLUMN "requestContextFingerprint" TEXT;

CREATE UNIQUE INDEX "Order_userId_storeId_idempotencyKey_key"
ON "Order"("userId", "storeId", "idempotencyKey");