ALTER TABLE "Shipment"
    ADD COLUMN "awbNormalized" TEXT,
    ADD COLUMN "trackingStatus" TEXT,
    ADD COLUMN "trackingStatusId" TEXT,
    ADD COLUMN "trackingStatusAt" TIMESTAMP(3),
    ADD COLUMN "estimatedDeliveryAt" TIMESTAMP(3);

UPDATE "Shipment"
SET "awbNormalized" = upper(regexp_replace("awbCode", E'\\s+', '', 'g'))
WHERE "awbCode" IS NOT NULL;

CREATE INDEX "Shipment_awbNormalized_idx" ON "Shipment"("awbNormalized");

CREATE TABLE "ShipmentTrackingEvent" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "eventHash" TEXT NOT NULL,
    "awbNormalized" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT,
    "statusId" TEXT,
    "shipmentStatus" TEXT,
    "shipmentStatusId" TEXT,
    "activity" TEXT,
    "location" TEXT,
    "srStatus" TEXT,
    "srStatusLabel" TEXT,
    "providerOrderId" TEXT,
    "merchantOrderId" TEXT,
    "occurredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentTrackingEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShipmentTrackingEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId")
        REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ShipmentTrackingEvent_eventHash_key"
    ON "ShipmentTrackingEvent"("eventHash");
CREATE INDEX "ShipmentTrackingEvent_shipmentId_occurredAt_idx"
    ON "ShipmentTrackingEvent"("shipmentId", "occurredAt");
CREATE INDEX "ShipmentTrackingEvent_awbNormalized_idx"
    ON "ShipmentTrackingEvent"("awbNormalized");
