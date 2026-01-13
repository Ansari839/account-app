import prisma from '../lib/prisma';

async function main() {
    try {
        const suppliers = await prisma.supplier.findMany({
            include: { payableAccount: true }
        });
        console.log('Suppliers COUNT:', suppliers.length);
        console.log('Suppliers:', JSON.stringify(suppliers, null, 2));

        const accounts = await prisma.account.findMany({
            where: { type: 'LIABILITY', isPosting: true }
        });
        console.log('Liability Accounts COUNT:', accounts.length);
        console.log('Liability Accounts:', JSON.stringify(accounts, null, 2));

    } catch (e) {
        console.error('Error fetching data:', e);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

main();
