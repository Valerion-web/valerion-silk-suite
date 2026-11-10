CREATE TABLE "ConsumedPhoneOtp" (
    "id" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumedPhoneOtp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConsumedPhoneOtp_digest_key" ON "ConsumedPhoneOtp"("digest");
CREATE INDEX "ConsumedPhoneOtp_expiresAt_idx" ON "ConsumedPhoneOtp"("expiresAt");