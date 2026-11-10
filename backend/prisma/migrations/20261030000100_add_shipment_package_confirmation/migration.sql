ALTER TABLE "Shipment"
    ADD COLUMN "packageWeightKg" DECIMAL(8, 3),
    ADD COLUMN "packageLengthCm" DECIMAL(8, 2),
    ADD COLUMN "packageBreadthCm" DECIMAL(8, 2),
    ADD COLUMN "packageHeightCm" DECIMAL(8, 2),
    ADD COLUMN "packageConfirmedAt" TIMESTAMP(3),
    ADD COLUMN "packageConfirmedById" INTEGER,
    ADD CONSTRAINT "Shipment_packageConfirmedById_fkey"
        FOREIGN KEY ("packageConfirmedById")
        REFERENCES "User"("id")
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    ADD CONSTRAINT "Shipment_attemptCount_nonnegative_check"
        CHECK ("attemptCount" >= 0),
    ADD CONSTRAINT "Shipment_package_measurements_complete_check"
        CHECK (
            (
                "packageWeightKg" IS NULL
                AND "packageLengthCm" IS NULL
                AND "packageBreadthCm" IS NULL
                AND "packageHeightCm" IS NULL
            )
            OR (
                "packageWeightKg" IS NOT NULL
                AND "packageWeightKg" > 0
                AND "packageLengthCm" IS NOT NULL
                AND "packageLengthCm" > 0.5
                AND "packageBreadthCm" IS NOT NULL
                AND "packageBreadthCm" > 0.5
                AND "packageHeightCm" IS NOT NULL
                AND "packageHeightCm" > 0.5
            )
        ),
    ADD CONSTRAINT "Shipment_package_confirmation_complete_check"
        CHECK (
            (
                "packageConfirmedAt" IS NULL
                AND "packageConfirmedById" IS NULL
            )
            OR (
                "packageConfirmedAt" IS NOT NULL
                AND "packageConfirmedById" IS NOT NULL
                AND "packageWeightKg" IS NOT NULL
                AND "packageWeightKg" > 0
                AND "packageLengthCm" IS NOT NULL
                AND "packageLengthCm" > 0.5
                AND "packageBreadthCm" IS NOT NULL
                AND "packageBreadthCm" > 0.5
                AND "packageHeightCm" IS NOT NULL
                AND "packageHeightCm" > 0.5
            )
        );

CREATE INDEX "Shipment_packageConfirmedById_idx"
    ON "Shipment"("packageConfirmedById");

CREATE FUNCTION "prevent_shipment_package_change_after_processing"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (
        OLD."shiprocketOrderId" IS NOT NULL
        AND NEW."shiprocketOrderId" IS NULL
    ) OR (
        OLD."shiprocketShipmentId" IS NOT NULL
        AND NEW."shiprocketShipmentId" IS NULL
    ) THEN
        RAISE EXCEPTION 'Shipment provider identifiers cannot be cleared once recorded'
            USING ERRCODE = 'check_violation';
    END IF;

    IF OLD."attemptCount" > 0 AND NEW."attemptCount" < OLD."attemptCount" THEN
        RAISE EXCEPTION 'Shipment attempt count cannot decrease after processing starts'
            USING ERRCODE = 'check_violation';
    END IF;

    IF (
        OLD."attemptCount" > 0
        OR NEW."attemptCount" > 0
        OR OLD."status" = 'PROCESSING'
        OR NEW."status" = 'PROCESSING'
        OR OLD."shiprocketOrderId" IS NOT NULL
        OR OLD."shiprocketShipmentId" IS NOT NULL
        OR NEW."shiprocketOrderId" IS NOT NULL
        OR NEW."shiprocketShipmentId" IS NOT NULL
    ) AND (
        NEW."packageWeightKg" IS DISTINCT FROM OLD."packageWeightKg"
        OR NEW."packageLengthCm" IS DISTINCT FROM OLD."packageLengthCm"
        OR NEW."packageBreadthCm" IS DISTINCT FROM OLD."packageBreadthCm"
        OR NEW."packageHeightCm" IS DISTINCT FROM OLD."packageHeightCm"
        OR NEW."packageConfirmedAt" IS DISTINCT FROM OLD."packageConfirmedAt"
        OR NEW."packageConfirmedById" IS DISTINCT FROM OLD."packageConfirmedById"
    ) THEN
        RAISE EXCEPTION 'Shipment package data cannot change once processing starts or provider identifiers exist'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "Shipment_package_immutable_after_processing"
    BEFORE UPDATE OF
        "attemptCount",
        "status",
        "shiprocketOrderId",
        "shiprocketShipmentId",
        "packageWeightKg",
        "packageLengthCm",
        "packageBreadthCm",
        "packageHeightCm",
        "packageConfirmedAt",
        "packageConfirmedById"
    ON "Shipment"
    FOR EACH ROW
    EXECUTE FUNCTION "prevent_shipment_package_change_after_processing"();
