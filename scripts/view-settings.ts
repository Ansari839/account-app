
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const settings = await prisma.companySetting.findMany();
    console.log('Company Settings:', JSON.stringify(settings, null, 2));

    const currencies = await prisma.currency.findMany();
    console.log('Currencies:', JSON.stringify(currencies, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
