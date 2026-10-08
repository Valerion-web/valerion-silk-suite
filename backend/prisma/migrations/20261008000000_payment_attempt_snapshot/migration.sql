DROP INDEX "Payment_userId_storeId_idempotencyKey_key";

ALTER TABLE "Payment" ADD COLUMN "checkoutSnapshot" JSONB,
ADD COLUMN "paymentAttemptKey" TEXT;

CREATE INDEX "Payment_userId_storeId_idempotencyKey_idx"
ON "Payment"("userId", "storeId", "idempotencyKey");

CREATE UNIQUE INDEX "Payment_userId_storeId_paymentAttemptKey_key"
ON "Payment"("userId", "storeId", "paymentAttemptKey");
