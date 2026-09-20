CREATE TYPE "PaymentWebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

CREATE TABLE "PaymentWebhookEvent" (
  "id" SERIAL NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "paymentId" INTEGER,
  "status" "PaymentWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "processingLeaseToken" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processingStartedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_providerEventId_key"
ON "PaymentWebhookEvent"("provider", "providerEventId");

CREATE UNIQUE INDEX "PaymentWebhookEvent_processingLeaseToken_key"
ON "PaymentWebhookEvent"("processingLeaseToken");

CREATE INDEX "PaymentWebhookEvent_status_processingStartedAt_idx"
ON "PaymentWebhookEvent"("status", "processingStartedAt");

CREATE INDEX "PaymentWebhookEvent_paymentId_idx"
ON "PaymentWebhookEvent"("paymentId");

ALTER TABLE "PaymentWebhookEvent"
ADD CONSTRAINT "PaymentWebhookEvent_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
