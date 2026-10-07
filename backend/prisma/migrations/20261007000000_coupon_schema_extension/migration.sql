ALTER TABLE "Coupon"
  ADD COLUMN "userUsageLimit" INTEGER,
  ADD COLUMN "maxDiscount" DOUBLE PRECISION,
  ADD COLUMN "maxOrderValue" DOUBLE PRECISION,
  ADD COLUMN "allowFreeShipping" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "CouponUsage" (
  "id" SERIAL NOT NULL,
  "couponId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "orderId" INTEGER NOT NULL,
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "amountDiscounted" DOUBLE PRECISION,
  CONSTRAINT "CouponUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CouponUsage_couponId_userId_orderId_key"
  ON "CouponUsage"("couponId", "userId", "orderId");
CREATE INDEX "CouponUsage_couponId_idx"
  ON "CouponUsage"("couponId");
CREATE INDEX "CouponUsage_userId_idx"
  ON "CouponUsage"("userId");
CREATE INDEX "CouponUsage_orderId_idx"
  ON "CouponUsage"("orderId");

ALTER TABLE "CouponUsage"
  ADD CONSTRAINT "CouponUsage_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CouponUsage"
  ADD CONSTRAINT "CouponUsage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CouponUsage"
  ADD CONSTRAINT "CouponUsage_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CouponProduct" (
  "id" SERIAL NOT NULL,
  "couponId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CouponProduct_couponId_productId_key"
  ON "CouponProduct"("couponId", "productId");
CREATE INDEX "CouponProduct_couponId_idx"
  ON "CouponProduct"("couponId");
CREATE INDEX "CouponProduct_productId_idx"
  ON "CouponProduct"("productId");

ALTER TABLE "CouponProduct"
  ADD CONSTRAINT "CouponProduct_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CouponProduct"
  ADD CONSTRAINT "CouponProduct_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CouponCategory" (
  "id" SERIAL NOT NULL,
  "couponId" INTEGER NOT NULL,
  "categoryId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CouponCategory_couponId_categoryId_key"
  ON "CouponCategory"("couponId", "categoryId");
CREATE INDEX "CouponCategory_couponId_idx"
  ON "CouponCategory"("couponId");
CREATE INDEX "CouponCategory_categoryId_idx"
  ON "CouponCategory"("categoryId");

ALTER TABLE "CouponCategory"
  ADD CONSTRAINT "CouponCategory_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CouponCategory"
  ADD CONSTRAINT "CouponCategory_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD COLUMN "couponId" INTEGER,
  ADD COLUMN "couponCode" TEXT,
  ADD COLUMN "discountAmount" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "subtotalBeforeDiscount" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "shippingCost" DOUBLE PRECISION DEFAULT 0;
