ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_cod_razorpay_state_check"
CHECK (
    "provider" <> 'COD'
    OR (
        "providerOrderId" IS NULL
        AND "providerPaymentId" IS NULL
        AND "providerSignature" IS NULL
        AND "status" = 'PENDING_COLLECTION'
    )
);
