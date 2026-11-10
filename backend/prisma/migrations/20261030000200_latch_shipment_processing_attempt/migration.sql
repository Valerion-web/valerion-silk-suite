CREATE OR REPLACE FUNCTION "prevent_shipment_package_change_after_processing"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (
        OLD."status" = 'PROCESSING'
        OR NEW."status" = 'PROCESSING'
    ) AND (
        NEW."attemptCount" IS NULL
        OR NEW."attemptCount" < 1
    ) THEN
        RAISE EXCEPTION 'Shipment attempt count must be at least one while processing'
            USING ERRCODE = '23514';
    END IF;

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
