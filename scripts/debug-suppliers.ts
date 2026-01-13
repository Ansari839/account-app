import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true, code: true } });
    console.log('Suppliers:', JSON.stringify(suppliers, null, 2));
    const accounts = await prisma.account.findMany({ where: { type: 'LIABILITY', isPosting: true }, select: { id: true, name: true, code: true } });
    console.log('Liability Accounts:', JSON.stringify(accounts, null, 2));
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
