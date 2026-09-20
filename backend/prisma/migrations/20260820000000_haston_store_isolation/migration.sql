BEGIN;

CREATE TABLE "Tenant" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

CREATE TABLE "Store" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");
CREATE INDEX "Store_tenantId_idx" ON "Store"("tenantId");
ALTER TABLE "Store" ADD CONSTRAINT "Store_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN "storeId" INTEGER;
ALTER TABLE "Category" ADD COLUMN "storeId" INTEGER;
ALTER TABLE "Brand" ADD COLUMN "storeId" INTEGER;
ALTER TABLE "Product" ADD COLUMN "storeId" INTEGER;
ALTER TABLE "Product" ADD COLUMN "brandId" INTEGER;
ALTER TABLE "Product" ADD COLUMN "hoverImage" TEXT;
ALTER TABLE "Order" ADD COLUMN "storeId" INTEGER;
ALTER TABLE "Order" ADD COLUMN "shippingAddress" TEXT;
ALTER TABLE "Order" ADD COLUMN "billingAddress" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "variantId" INTEGER;

INSERT INTO "Tenant" ("name", "slug", "status", "updatedAt")
VALUES ('House of Valerion', 'house-of-valerion', 'ACTIVE', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Store" ("tenantId", "name", "slug", "status", "updatedAt")
SELECT "id", 'House of Valerion', 'house-of-valerion', 'ACTIVE', CURRENT_TIMESTAMP
FROM "Tenant"
WHERE "slug" = 'house-of-valerion'
ON CONFLICT ("slug") DO NOTHING;

UPDATE "User"
SET "storeId" = (SELECT "id" FROM "Store" WHERE "slug" = 'house-of-valerion')
WHERE "storeId" IS NULL;
UPDATE "Category"
SET "storeId" = (SELECT "id" FROM "Store" WHERE "slug" = 'house-of-valerion')
WHERE "storeId" IS NULL;
UPDATE "Brand"
SET "storeId" = (SELECT "id" FROM "Store" WHERE "slug" = 'house-of-valerion')
WHERE "storeId" IS NULL;
UPDATE "Product"
SET "storeId" = (SELECT "id" FROM "Store" WHERE "slug" = 'house-of-valerion')
WHERE "storeId" IS NULL;
UPDATE "Order"
SET "storeId" = (SELECT "id" FROM "Store" WHERE "slug" = 'house-of-valerion')
WHERE "storeId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Category" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Brand" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "storeId" SET NOT NULL;

CREATE INDEX "User_storeId_idx" ON "User"("storeId");
CREATE INDEX "Category_storeId_idx" ON "Category"("storeId");
CREATE INDEX "Category_storeId_slug_idx" ON "Category"("storeId", "slug");
CREATE INDEX "Brand_storeId_idx" ON "Brand"("storeId");
CREATE INDEX "Brand_storeId_slug_idx" ON "Brand"("storeId", "slug");
CREATE INDEX "Product_storeId_idx" ON "Product"("storeId");
CREATE INDEX "Product_storeId_categoryId_idx" ON "Product"("storeId", "categoryId");
CREATE INDEX "Product_storeId_brandId_idx" ON "Product"("storeId", "brandId");
CREATE INDEX "Order_storeId_idx" ON "Order"("storeId");
CREATE INDEX "Order_storeId_userId_idx" ON "Order"("storeId", "userId");
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Cart" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "storeId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Cart_userId_storeId_key" ON "Cart"("userId", "storeId");
CREATE INDEX "Cart_storeId_idx" ON "Cart"("storeId");
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CartItem" (
  "id" SERIAL NOT NULL,
  "cartId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "variantId" INTEGER,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CartItem_cartId_productId_variantId_key" ON "CartItem"("cartId", "productId", "variantId");
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Wishlist" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "storeId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Wishlist_userId_storeId_key" ON "Wishlist"("userId", "storeId");
CREATE INDEX "Wishlist_storeId_idx" ON "Wishlist"("storeId");
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WishlistItem" (
  "id" SERIAL NOT NULL,
  "wishlistId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WishlistItem_wishlistId_productId_key" ON "WishlistItem"("wishlistId", "productId");
CREATE INDEX "WishlistItem_productId_idx" ON "WishlistItem"("productId");
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "Wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Coupon" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "discountType" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "usageLimit" INTEGER,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "minOrderValue" DOUBLE PRECISION,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "storeId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Coupon_storeId_code_key" ON "Coupon"("storeId", "code");
CREATE INDEX "Coupon_storeId_idx" ON "Coupon"("storeId");
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
