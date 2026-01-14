const prisma = require('../lib/prisma').default;

async function checkStockLedger() {
    console.log("=== Checking Stock Ledger Entries ===\n");

    // Get all stock ledger entries
    const stockEntries = await prisma.stockLedger.findMany({
        include: {
            product: { select: { name: true } }
        },
        orderBy: { date: 'desc' },
        take: 20
    });

    console.log(`Total recent stock entries: ${stockEntries.length}\n`);

    for (const entry of stockEntries) {
        console.log(`Product: ${entry.product.name}`);
        console.log(`  RefType: ${entry.refType}, RefId: ${entry.refId}`);
        console.log(`  QtyIn: ${entry.qtyIn}, QtyOut: ${entry.qtyOut}`);
        console.log(`  Date: ${entry.date.toISOString().split('T')[0]}`);

        // Check if the referenced document still exists
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
            }
            console.log(`  Referenced document exists: ${exists ? 'YES' : 'NO (ORPHANED!)'}`);
        } catch (e) {
            console.log(`  Error checking reference: ${e.message}`);
        }
        console.log('');
    }

    // Count orphaned entries
    const allEntries = await prisma.stockLedger.findMany();
    let orphanedCount = 0;

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
            }
            if (!exists) orphanedCount++;
        } catch (e) {
            orphanedCount++;
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total stock ledger entries: ${allEntries.length}`);
    console.log(`Orphaned entries (no matching document): ${orphanedCount}`);

    await prisma.$disconnect();
}

checkStockLedger().catch(console.error);
