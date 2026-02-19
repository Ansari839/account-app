/*
  Warnings:

  - You are about to drop the `GlobalSetting` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[companyId,code]` on the table `Currency` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,code]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,doNo]` on the table `DeliveryOrder` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,name]` on the table `FinancialYear` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,grnNo]` on the table `GRN` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,number]` on the table `JournalEntry` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,code]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,invoiceNo]` on the table `PurchaseInvoice` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,poNo]` on the table `PurchaseOrder` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,reqNo]` on the table `PurchaseRequest` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,returnNo]` on the table `PurchaseReturn` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,name]` on the table `Role` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,invoiceNo]` on the table `SalesInvoice` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,orderNo]` on the table `SalesOrder` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,quoteNo]` on the table `SalesQuotation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,returnNo]` on the table `SalesReturn` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,code]` on the table `Supplier` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,code]` on the table `TaxCode` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,code]` on the table `Unit` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,type]` on the table `VoucherSequence` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,code]` on the table `Warehouse` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `companyId` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `Currency` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `DeliveryOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `FinancialYear` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `GRN` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `JournalEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `PurchaseInvoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `PurchaseOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `PurchaseRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `PurchaseReturn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `SalesInvoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `SalesOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `SalesQuotation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `SalesReturn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `StockLedger` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `Supplier` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `TaxCode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `Unit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `UnitConversion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `VoucherSequence` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `Warehouse` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_currencyCode_fkey";

-- DropForeignKey
ALTER TABLE "Supplier" DROP CONSTRAINT "Supplier_currencyCode_fkey";

-- DropIndex
DROP INDEX "Currency_code_key";

-- DropIndex
DROP INDEX "Customer_code_key";

-- DropIndex
DROP INDEX "DeliveryOrder_doNo_key";

-- DropIndex
DROP INDEX "FinancialYear_name_key";

-- DropIndex
DROP INDEX "GRN_grnNo_key";

-- DropIndex
DROP INDEX "JournalEntry_number_key";

-- DropIndex
DROP INDEX "Product_code_key";

-- DropIndex
DROP INDEX "PurchaseInvoice_invoiceNo_key";

-- DropIndex
DROP INDEX "PurchaseOrder_poNo_key";

-- DropIndex
DROP INDEX "PurchaseRequest_reqNo_key";

-- DropIndex
DROP INDEX "PurchaseReturn_returnNo_key";

-- DropIndex
DROP INDEX "Role_name_key";

-- DropIndex
DROP INDEX "SalesInvoice_invoiceNo_key";

-- DropIndex
DROP INDEX "SalesOrder_orderNo_key";

-- DropIndex
DROP INDEX "SalesQuotation_quoteNo_key";

-- DropIndex
DROP INDEX "SalesReturn_returnNo_key";

-- DropIndex
DROP INDEX "Supplier_code_key";

-- DropIndex
DROP INDEX "TaxCode_code_key";

-- DropIndex
DROP INDEX "Unit_code_key";

-- DropIndex
DROP INDEX "VoucherSequence_type_key";

-- DropIndex
DROP INDEX "Warehouse_code_key";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Currency" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DeliveryOrder" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DeliveryOrderItem" ADD COLUMN     "unitId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "FinancialYear" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "GRN" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "GRNItem" ADD COLUMN     "rate" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
ADD COLUMN     "unitId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseInvoiceItem" ADD COLUMN     "unitId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ADD COLUMN     "unitId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseRequest" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseRequestItem" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseReturn" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseReturnItem" ADD COLUMN     "unitId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "SalesInvoice" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SalesInvoiceItem" ADD COLUMN     "unitId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SalesOrderItem" ADD COLUMN     "unitId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "SalesQuotation" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SalesQuotationItem" ADD COLUMN     "unitId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "SalesReturn" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SalesReturnItem" ADD COLUMN     "unitId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "StockLedger" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TaxCode" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UnitConversion" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VoucherSequence" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "companyId" TEXT NOT NULL;

-- DropTable
DROP TABLE "GlobalSetting";

-- CreateTable
CREATE TABLE "UserCompany" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySetting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "group" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCompany_userId_companyId_key" ON "UserCompany"("userId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySetting_companyId_key_key" ON "CompanySetting"("companyId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_companyId_code_key" ON "Currency"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_code_key" ON "Customer"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryOrder_companyId_doNo_key" ON "DeliveryOrder"("companyId", "doNo");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialYear_companyId_name_key" ON "FinancialYear"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GRN_companyId_grnNo_key" ON "GRN"("companyId", "grnNo");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_companyId_number_key" ON "JournalEntry"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_code_key" ON "Product"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_companyId_invoiceNo_key" ON "PurchaseInvoice"("companyId", "invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_companyId_poNo_key" ON "PurchaseOrder"("companyId", "poNo");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_companyId_reqNo_key" ON "PurchaseRequest"("companyId", "reqNo");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturn_companyId_returnNo_key" ON "PurchaseReturn"("companyId", "returnNo");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_companyId_invoiceNo_key" ON "SalesInvoice"("companyId", "invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_companyId_orderNo_key" ON "SalesOrder"("companyId", "orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "SalesQuotation_companyId_quoteNo_key" ON "SalesQuotation"("companyId", "quoteNo");

-- CreateIndex
CREATE UNIQUE INDEX "SalesReturn_companyId_returnNo_key" ON "SalesReturn"("companyId", "returnNo");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_companyId_code_key" ON "Supplier"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TaxCode_companyId_code_key" ON "TaxCode"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_companyId_code_key" ON "Unit"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherSequence_companyId_type_key" ON "VoucherSequence"("companyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_companyId_code_key" ON "Warehouse"("companyId", "code");

-- AddForeignKey
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySetting" ADD CONSTRAINT "CompanySetting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialYear" ADD CONSTRAINT "FinancialYear_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Currency" ADD CONSTRAINT "Currency_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCode" ADD CONSTRAINT "TaxCode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitConversion" ADD CONSTRAINT "UnitConversion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNItem" ADD CONSTRAINT "GRNItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNItem" ADD CONSTRAINT "GRNItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceItem" ADD CONSTRAINT "PurchaseInvoiceItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceItem" ADD CONSTRAINT "PurchaseInvoiceItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuotation" ADD CONSTRAINT "SalesQuotation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuotationItem" ADD CONSTRAINT "SalesQuotationItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuotationItem" ADD CONSTRAINT "SalesQuotationItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOrderItem" ADD CONSTRAINT "DeliveryOrderItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOrderItem" ADD CONSTRAINT "DeliveryOrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceItem" ADD CONSTRAINT "SalesInvoiceItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceItem" ADD CONSTRAINT "SalesInvoiceItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnItem" ADD CONSTRAINT "SalesReturnItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnItem" ADD CONSTRAINT "SalesReturnItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherSequence" ADD CONSTRAINT "VoucherSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
