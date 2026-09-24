import prisma from './lib/prisma';

async function main() {
    console.log("Starting transaction data cleanup sequentially...");

    try {
        // Sales Cycle
        console.log("Deleting Sales Data...");
        await prisma.salesInvoiceTax.deleteMany();
        await prisma.salesInvoiceItem.deleteMany();
        await prisma.salesInvoice.deleteMany();
        
        await prisma.salesReturnItem.deleteMany();
        await prisma.salesReturn.deleteMany();
        
        await prisma.deliveryOrderItem.deleteMany();
        await prisma.deliveryOrder.deleteMany();
        
        await prisma.salesOrderItem.deleteMany();
        await prisma.salesOrder.deleteMany();
        
        await prisma.salesQuotationItem.deleteMany();
        await prisma.salesQuotation.deleteMany();

        // Purchase Cycle
        console.log("Deleting Purchase Data...");
        await prisma.purchaseInvoiceTax.deleteMany();
        await prisma.purchaseInvoiceItem.deleteMany();
        await prisma.purchaseInvoice.deleteMany();

        await prisma.gRNItem.deleteMany();
        await prisma.gRN.deleteMany();

        await prisma.purchaseReturnItem.deleteMany();
        await prisma.purchaseReturn.deleteMany();

        await prisma.purchaseOrderItem.deleteMany();
        await prisma.purchaseOrder.deleteMany();

        await prisma.purchaseRequestItem.deleteMany();
        await prisma.purchaseRequest.deleteMany();

        // Inventory & Finance
        console.log("Deleting Inventory & Finance Data...");
        await prisma.stockLedger.deleteMany();
        await prisma.journalLine.deleteMany();
        await prisma.journalEntry.deleteMany();
        await prisma.accountEntry.deleteMany();
        await prisma.transaction.deleteMany();
        
        // Sequences & Logs
        console.log("Deleting Sequences & Logs...");
        await prisma.voucherSequence.deleteMany();
        await prisma.auditLog.deleteMany();

        console.log("✅ All transaction data has been deleted successfully!");
    } catch (error) {
        console.error("❌ Error deleting transaction data:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
