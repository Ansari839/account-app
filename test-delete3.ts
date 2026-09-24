import prisma from './lib/prisma';

async function run() {
  try {
    const record = await prisma.productionRecord.findFirst({
      where: { id: 'f0b7ed34-3b45-455a-9485-3de7f17afe48' },
      include: { overheads: true }
    });
    
    if (!record) { console.log('Record not found'); return; }

    await prisma.$transaction(async (tx) => {
        // 1. Revert consumed quantities for purchase invoices (Out-house services)
        for (const overhead of record.overheads) {
            if (overhead.purchaseInvoiceItemId && overhead.quantity) {
                await tx.purchaseInvoiceItem.update({
                    where: { id: overhead.purchaseInvoiceItemId },
                    data: { consumedQty: { decrement: overhead.quantity } }
                });
            }
        }

        // 2. Delete Stock Ledgers associated with this production
        await tx.stockLedger.deleteMany({
            where: { refType: 'PRODUCTION', refId: record.id }
        });

        // 3. Find and Delete Journal Entries
        const je = await tx.journalEntry.findFirst({
            where: {
                type: 'JOURNAL',
                narration: { startsWith: 'Production Batch BATCH-' },
                createdAt: {
                    gte: new Date(record.createdAt.getTime() - 60000),
                    lte: new Date(record.createdAt.getTime() + 60000)
                }
            }
        });

        if (je) {
            await tx.journalLine.deleteMany({ where: { entryId: je.id } });
            await tx.journalEntry.delete({ where: { id: je.id } });
        }

        // 4. Explicitly delete inputs and overheads to avoid foreign key constraint errors
        await tx.productionOverhead.deleteMany({ where: { productionId: record.id } });
        await tx.productionInput.deleteMany({ where: { productionId: record.id } });
        await tx.productionRecord.delete({ where: { id: record.id } });
    }, {
        maxWait: 10000,
        timeout: 30000
    });
    console.log("Delete successful");
  } catch (err: any) {
    console.error("Delete failed:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
