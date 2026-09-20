CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY');

CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'CANCELLED');

CREATE TABLE "Payment" (
  "id" SERIAL NOT NULL,
  "orderId" INTEGER,
  "userId" INTEGER NOT NULL,
  "storeId" INTEGER NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
  "providerOrderId" TEXT,
  "providerPaymentId" TEXT,
  "providerSignature" TEXT,
  "idempotencyKey" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_providerOrderId_key" ON "Payment"("providerOrderId");
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");
CREATE INDEX "Payment_userId_storeId_idx" ON "Payment"("userId", "storeId");
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
CREATE INDEX "Payment_idempotencyKey_idx" ON "Payment"("idempotencyKey");
CREATE UNIQUE INDEX "Payment_userId_storeId_idempotencyKey_key" ON "Payment"("userId", "storeId", "idempotencyKey");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;