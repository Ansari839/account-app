import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('Clearing transactions via TRUNCATE CASCADE...');
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "ProductionOverhead",
      "ProductionInput",
      "ProductionRecord",
      "StockLedger",
      "GRNItem",
      "GRN",
      "DeliveryOrderItem",
      "DeliveryOrder",
      "PurchaseInvoiceTax",
      "PurchaseReturnItem",
      "PurchaseReturn",
      "PurchaseInvoiceItem",
      "PurchaseInvoice",
      "PurchaseOrderItem",
      "PurchaseOrder",
      "PurchaseRequestItem",
      "PurchaseRequest",
      "SalesInvoiceTax",
      "SalesReturnItem",
      "SalesReturn",
      "SalesInvoiceItem",
      "SalesInvoice",
      "SalesOrderItem",
      "SalesOrder",
      "SalesQuotationItem",
      "SalesQuotation",
      "AccountEntry",
      "Transaction",
      "JournalLine",
      "JournalEntry",
      "AuditLog"
    CASCADE;
  `);
  console.log('Transactions cleared!');
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
