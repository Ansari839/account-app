const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('Clearing transactions via TRUNCATE CASCADE...');
  await sql`
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
  `;
  console.log('Transactions cleared!');
}

main().catch(console.error);
