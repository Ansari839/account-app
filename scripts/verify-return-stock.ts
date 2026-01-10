
import prisma from '../lib/prisma';

async function main() {
    console.log("Starting Verification...");

    // 1. Get a Supplier, Warehouse, Product
    const supplier = await prisma.supplier.findFirst();
    const warehouse = await prisma.warehouse.findFirst();
    const product = await prisma.product.findFirst();

    if (!supplier || !warehouse || !product) {
        console.error("Missing Master Data");
        return;
    }

    console.log(`Using Supplier: ${supplier.name}, Warehouse: ${warehouse.name}, Product: ${product.name}`);

    // 2. Create a Dummy Return (using Service would be best but let's emulate logic to check DB constraints?)
    // No, let's call the API logic equivalent or just raw insert to see if logic holds
    // Actually, I can't call Service easily from script if it's not exported properly or env issues.
    // Let's just check if there are existing entries first.

    const returns = await prisma.purchaseReturn.findMany({ include: { items: true } });
    console.log(`Found ${returns.length} Purchase Returns.`);

    if (returns.length > 0) {
        const lastReturn = returns[returns.length - 1];
        console.log(`Checking Stock Ledger for Return ID: ${lastReturn.id}`);

        const ledgers = await prisma.stockLedger.findMany({
            where: {
                refType: 'RETURN',
                refId: lastReturn.id
            }
        });

        console.log(`Found ${ledgers.length} Stock Ledger entries for this return.`);
        ledgers.forEach(l => console.log(` - Ledger: ${l.id} | Out: ${l.qtyOut} | Ref: ${l.refId}`));
    } else {
        console.log("No returns found to verify.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
