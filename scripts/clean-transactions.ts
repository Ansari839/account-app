import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function cleanTransactions() {
    console.log('Starting transaction cleanup...');

    try {
        // 1. Inventory & Stock Limits
        console.log('Deleting Stock Ledger entries...');
        await prisma.stockLedger.deleteMany({});

        // 2. Line Items (Dependent on Headers)
        console.log('Deleting Line Items...');
        await prisma.salesReturnItem.deleteMany({});
        await prisma.purchaseReturnItem.deleteMany({});
        await prisma.salesInvoiceItem.deleteMany({});
        await prisma.purchaseInvoiceItem.deleteMany({});
        await prisma.deliveryOrderItem.deleteMany({});
        await prisma.gRNItem.deleteMany({});
        await prisma.salesOrderItem.deleteMany({});
        await prisma.purchaseOrderItem.deleteMany({});
        await prisma.salesQuotationItem.deleteMany({});
        await prisma.purchaseRequestItem.deleteMany({});

        // 3. Document Headers (Dependent on Orders/Journals)
        console.log('Deleting Return, Invoice, DO, GRN Documents...');
        // We strictly delete "child" documents first if they reference parents, or just all of them if simpler.
        // Note: Some might be circular if not careful, but usually Invoice -> Order is one way or loose.
        await prisma.salesReturn.deleteMany({});
        await prisma.purchaseReturn.deleteMany({});
        await prisma.salesInvoice.deleteMany({});
        await prisma.purchaseInvoice.deleteMany({});
        await prisma.deliveryOrder.deleteMany({});
        await prisma.gRN.deleteMany({});

        // 4. Primary Orders/Requests
        console.log('Deleting Orders and Requests...');
        await prisma.salesOrder.deleteMany({});
        await prisma.purchaseOrder.deleteMany({});
        await prisma.salesQuotation.deleteMany({});
        await prisma.purchaseRequest.deleteMany({});

        // 5. Accounting / Journals
        console.log('Deleting Journal Entries and Accounting Lines...');
        await prisma.journalLine.deleteMany({});
        await prisma.journalEntry.deleteMany({});

        // 6. Generic Transactions (The central transaction table)
        console.log('Deleting Central Transactions...');
        await prisma.accountEntry.deleteMany({});
        await prisma.transaction.deleteMany({});

        console.log('✅ Transaction data cleaned successfully.');
        console.log('Master data (Accounts, Products, Contacts) remains intact.');

    } catch (error) {
        console.error('Error cleaning transactions:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanTransactions();
