-- AlterTable
ALTER TABLE "TaxCode" ADD COLUMN     "accountId" TEXT;

-- AddForeignKey
ALTER TABLE "TaxCode" ADD CONSTRAINT "TaxCode_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
