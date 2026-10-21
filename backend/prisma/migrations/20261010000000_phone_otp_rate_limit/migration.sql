CREATE TABLE "PhoneOtpRateLimit" (
    "namespace" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneOtpRateLimit_pkey" PRIMARY KEY ("namespace", "keyHash")
);

CREATE INDEX "PhoneOtpRateLimit_expiresAt_idx" ON "PhoneOtpRateLimit"("expiresAt");
