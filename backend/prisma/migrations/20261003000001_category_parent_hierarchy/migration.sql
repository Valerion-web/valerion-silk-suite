ALTER TABLE "Category" ADD COLUMN "parentId" INTEGER;

CREATE INDEX "Category_storeId_parentId_idx" ON "Category"("storeId", "parentId");

ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;