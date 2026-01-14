
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Searching for 'Cash' accounts...");
        const accounts = await prisma.account.findMany({
            where: { name: { contains: 'Cash', mode: 'insensitive' } }
        });

        console.log(`Found ${accounts.length} Cash accounts.`);

        for (const acc of accounts) {
            console.log(`\nAccount: ${acc.name} (${acc.code}) - ID: ${acc.id}`);

            const supplier = await prisma.supplier.findFirst({
                where: { payableAccountId: acc.id }
            });
            console.log(`  -> Linked Supplier: ${supplier ? supplier.name + ' (' + supplier.id + ')' : 'NONE'}`);

            const customer = await prisma.customer.findFirst({
                where: { receivableAccountId: acc.id }
            });
            console.log(`  -> Linked Customer: ${customer ? customer.name + ' (' + customer.id + ')' : 'NONE'}`);
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
