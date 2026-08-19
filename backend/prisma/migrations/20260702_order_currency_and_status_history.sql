-- Migration: 20260702_order_currency_and_status_history
-- Purpose: Align the live SQLite database with the admin order endpoints by adding the missing currency column and order status history table.
-- REVIEW this file carefully before executing. This script is written for SQLite.

PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

-- Add currency column to existing Order table if it is missing.
ALTER TABLE "Order" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'INR';

-- Create order status history table if it is missing.
CREATE TABLE IF NOT EXISTS "OrderStatusHistory" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "orderId" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT,
  "changedById" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("changedById") REFERENCES "User" ("id")
);
CREATE INDEX IF NOT EXISTS "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");
CREATE INDEX IF NOT EXISTS "OrderStatusHistory_changedById_idx" ON "OrderStatusHistory"("changedById");

-- Backfill existing orders with a default status history event when none exists.
INSERT INTO "OrderStatusHistory" ("orderId", "status", "note", "createdAt")
SELECT o."id", COALESCE(o."status", 'PENDING'), 'Imported from existing order record', o."createdAt"
FROM "Order" o
LEFT JOIN "OrderStatusHistory" h ON h."orderId" = o."id"
WHERE h."id" IS NULL;

COMMIT;
PRAGMA foreign_keys=ON;
