ALTER TABLE "Payment"
ADD COLUMN "codCollectedAt" TIMESTAMP(3),
ADD COLUMN "codCollectedById" INTEGER;

CREATE INDEX "Payment_codCollectedById_idx"
ON "Payment"("codCollectedById");

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_codCollectedById_fkey"
FOREIGN KEY ("codCollectedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
DROP CONSTRAINT IF EXISTS "Payment_cod_razorpay_state_check";

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_cod_lifecycle_check"
CHECK (
  "provider" <> 'COD'
  OR (
    "status" IN ('PENDING_COLLECTION', 'COD_COLLECTED', 'CANCELLED', 'REFUNDED')
    AND "providerOrderId" IS NULL
    AND "providerPaymentId" IS NULL
    AND "providerSignature" IS NULL
    AND (
      (
        "status" IN ('COD_COLLECTED', 'REFUNDED')
        AND "codCollectedAt" IS NOT NULL
        AND "codCollectedById" IS NOT NULL
      )
      OR (
        "status" IN ('PENDING_COLLECTION', 'CANCELLED')
        AND "codCollectedAt" IS NULL
        AND "codCollectedById" IS NULL
      )
    )
  )
);
