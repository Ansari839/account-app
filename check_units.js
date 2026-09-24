const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const units = await prisma.unit.findMany({ select: { id: true, name: true, code: true, companyId: true } });
    console.log(JSON.stringify(units, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
