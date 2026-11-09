CREATE TYPE "ShipmentOperationType" AS ENUM (
    'ASSIGN_AWB',
    'GENERATE_LABEL',
    'REQUEST_PICKUP',
    'GENERATE_MANIFEST',
    'PRINT_MANIFEST'
);

CREATE TYPE "ShipmentOperationStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'SUCCEEDED',
    'FAILED',
    'RETRY_SCHEDULED',
    'RECONCILIATION_REQUIRED'
);

CREATE TYPE "ShipmentManifestStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'GENERATED',
    'FAILED',
    'RETRY_SCHEDULED',
    'RECONCILIATION_REQUIRED'
);

ALTER TABLE "Shipment"
    ADD COLUMN "courierCompanyId" TEXT,
    ADD COLUMN "labelUrl" TEXT,
    ADD COLUMN "labelGeneratedAt" TIMESTAMP(3),
    ADD COLUMN "pickupRequestedAt" TIMESTAMP(3),
    ADD COLUMN "pickupEstimatedAt" TIMESTAMP(3),
    ADD COLUMN "pickupProviderReference" TEXT;

CREATE TABLE "ShipmentManifest" (
    "id" SERIAL NOT NULL,
    "requestKey" TEXT NOT NULL,
    "status" "ShipmentManifestStatus" NOT NULL DEFAULT 'PENDING',
    "shiprocketManifestId" TEXT,
    "manifestUrl" TEXT,
    "generatedAt" TIMESTAMP(3),
    "printUrl" TEXT,
    "printedAt" TIMESTAMP(3),
    "providerResponse" JSONB,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "requestSubmissionStage" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStartedAt" TIMESTAMP(3),
    "processingLeaseToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentManifest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShipmentManifest_attemptCount_nonnegative_check" CHECK ("attemptCount" >= 0)
);

CREATE TABLE "ShipmentOperation" (
    "id" SERIAL NOT NULL,
    "identityKey" TEXT NOT NULL,
    "shipmentId" INTEGER,
    "manifestId" INTEGER,
    "operationType" "ShipmentOperationType" NOT NULL,
    "status" "ShipmentOperationStatus" NOT NULL DEFAULT 'PENDING',
    "requestSubmissionStage" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStartedAt" TIMESTAMP(3),
    "processingLeaseToken" TEXT,
    "providerReference" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentOperation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShipmentOperation_shipmentId_fkey" FOREIGN KEY ("shipmentId")
        REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShipmentOperation_manifestId_fkey" FOREIGN KEY ("manifestId")
        REFERENCES "ShipmentManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShipmentOperation_attemptCount_nonnegative_check" CHECK ("attemptCount" >= 0),
    CONSTRAINT "ShipmentOperation_identity_check" CHECK (
        ("shipmentId" IS NOT NULL AND "manifestId" IS NULL)
        OR ("shipmentId" IS NULL AND "manifestId" IS NOT NULL)
    )
);

CREATE TABLE "ShipmentManifestItem" (
    "id" SERIAL NOT NULL,
    "manifestId" INTEGER NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "shiprocketOrderId" TEXT NOT NULL,
    "shiprocketShipmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentManifestItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShipmentManifestItem_manifestId_fkey" FOREIGN KEY ("manifestId")
        REFERENCES "ShipmentManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShipmentManifestItem_shipmentId_fkey" FOREIGN KEY ("shipmentId")
        REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ShipmentOperation_identityKey_key" ON "ShipmentOperation"("identityKey");
CREATE UNIQUE INDEX "ShipmentOperation_processingLeaseToken_key" ON "ShipmentOperation"("processingLeaseToken");
CREATE UNIQUE INDEX "ShipmentOperation_shipmentId_operationType_key" ON "ShipmentOperation"("shipmentId", "operationType");
CREATE UNIQUE INDEX "ShipmentOperation_manifestId_operationType_key" ON "ShipmentOperation"("manifestId", "operationType");
CREATE INDEX "ShipmentOperation_status_nextAttemptAt_idx" ON "ShipmentOperation"("status", "nextAttemptAt");
CREATE INDEX "ShipmentOperation_shipmentId_idx" ON "ShipmentOperation"("shipmentId");
CREATE INDEX "ShipmentOperation_manifestId_idx" ON "ShipmentOperation"("manifestId");

CREATE UNIQUE INDEX "ShipmentManifest_requestKey_key" ON "ShipmentManifest"("requestKey");
CREATE UNIQUE INDEX "ShipmentManifest_processingLeaseToken_key" ON "ShipmentManifest"("processingLeaseToken");
CREATE INDEX "ShipmentManifest_status_nextAttemptAt_idx" ON "ShipmentManifest"("status", "nextAttemptAt");

CREATE UNIQUE INDEX "ShipmentManifestItem_manifestId_shipmentId_key" ON "ShipmentManifestItem"("manifestId", "shipmentId");
CREATE INDEX "ShipmentManifestItem_manifestId_idx" ON "ShipmentManifestItem"("manifestId");
CREATE INDEX "ShipmentManifestItem_shipmentId_idx" ON "ShipmentManifestItem"("shipmentId");
