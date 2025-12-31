-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('JOURNAL', 'PAYMENT', 'RECEIPT', 'PURCHASE', 'SALES', 'CONTRA');

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "VoucherType" NOT NULL,
    "reference" TEXT,
    "narration" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "credit" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "narration" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLedger" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "qtyIn" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "qtyOut" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "costRate" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNo" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "taxCodeId" TEXT,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "total" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GRN" (
    "id" TEXT NOT NULL,
    "grnNo" TEXT NOT NULL,
    "poId" TEXT,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GRN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GRNItem" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "poItemId" TEXT,
    "qtyReceived" DECIMAL(65,30) NOT NULL,
    "qtyRejected" DECIMAL(65,30) NOT NULL DEFAULT 0.0,

    CONSTRAINT "GRNItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "grnId" TEXT,
    "poId" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "taxCodeId" TEXT,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "total" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "PurchaseInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "reqNo" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" DECIMAL(65,30) NOT NULL,
    "description" TEXT,

    CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_number_key" ON "JournalEntry"("number");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNo_key" ON "PurchaseOrder"("poNo");

-- CreateIndex
CREATE UNIQUE INDEX "GRN_grnNo_key" ON "GRN"("grnNo");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_invoiceNo_key" ON "PurchaseInvoice"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_journalEntryId_key" ON "PurchaseInvoice"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_reqNo_key" ON "PurchaseRequest"("reqNo");

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNItem" ADD CONSTRAINT "GRNItem_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GRN"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNItem" ADD CONSTRAINT "GRNItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNItem" ADD CONSTRAINT "GRNItem_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GRN"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceItem" ADD CONSTRAINT "PurchaseInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceItem" ADD CONSTRAINT "PurchaseInvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceItem" ADD CONSTRAINT "PurchaseInvoiceItem_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
