const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const products = await prisma.product.findMany();
    console.log(JSON.stringify(products.map(p => ({name: p.name, isManufactured: p.isManufactured, stage: p.stage})), null, 2));
}
main().finally(() => prisma.$disconnect());
