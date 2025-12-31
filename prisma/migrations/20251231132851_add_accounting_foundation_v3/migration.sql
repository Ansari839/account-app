-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VoucherType" ADD VALUE 'PURCHASE_RETURN';
ALTER TYPE "VoucherType" ADD VALUE 'SALES_RETURN';
ALTER TYPE "VoucherType" ADD VALUE 'OPENING';
ALTER TYPE "VoucherType" ADD VALUE 'CLOSING';

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "financialYearId" TEXT;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
