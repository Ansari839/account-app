import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function cleanupOrphanedStockEntries() {
    console.log("=== Checking for Orphaned Stock Ledger Entries ===\n");

    const allEntries = await prisma.stockLedger.findMany({
        include: {
            product: { select: { name: true } }
        }
    });

    console.log(`Total stock ledger entries: ${allEntries.length}\n`);

    const orphanedEntries: string[] = [];

    for (const entry of allEntries) {
        let exists = false;

        try {
            if (entry.refType === 'SALES_INVOICE') {
                const invoice = await prisma.salesInvoice.findUnique({ where: { id: entry.refId } });
                exists = !!invoice;
            } else if (entry.refType === 'DO') {
                const dn = await prisma.deliveryOrder.findUnique({ where: { id: entry.refId } });
                exists = !!dn;
            } else if (entry.refType === 'GRN') {
                const grn = await prisma.gRN.findUnique({ where: { id: entry.refId } });
                exists = !!grn;
            } else if (entry.refType === 'PURCHASE_INVOICE') {
                const invoice = await prisma.purchaseInvoice.findUnique({ where: { id: entry.refId } });
                exists = !!invoice;
            } else if (entry.refType === 'RETURN') {
                const ret = await prisma.purchaseReturn.findUnique({ where: { id: entry.refId } });
                exists = !!ret;
            } else if (entry.refType === 'SALES_RETURN') {
                const ret = await prisma.salesReturn.findUnique({ where: { id: entry.refId } });
                exists = !!ret;
            } else {
                // Unknown refType, consider it valid
                exists = true;
            }

            if (!exists) {
                orphanedEntries.push(entry.id);
                console.log(`ORPHANED: ${entry.product.name} | ${entry.refType} | QtyIn: ${entry.qtyIn}, QtyOut: ${entry.qtyOut}`);
            }
        } catch (e: any) {
            orphanedEntries.push(entry.id);
            console.log(`ERROR checking ${entry.id}: ${e.message}`);
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Orphaned entries found: ${orphanedEntries.length}`);

    if (orphanedEntries.length > 0) {
        console.log(`\nDeleting ${orphanedEntries.length} orphaned entries...`);

        const result = await prisma.stockLedger.deleteMany({
            where: {
                id: { in: orphanedEntries }
            }
        });

        console.log(`✅ Deleted ${result.count} orphaned stock ledger entries`);
    } else {
        console.log(`\n✅ No orphaned entries found. Stock ledger is clean!`);
    }

    await prisma.$disconnect();
}

cleanupOrphanedStockEntries().catch((e) => {
    console.error("Error:", e);
    process.exit(1);
});
