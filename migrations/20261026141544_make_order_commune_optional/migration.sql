-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_communeId_fkey";

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "communeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE SET NULL ON UPDATE CASCADE;
