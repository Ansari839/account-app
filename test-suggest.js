const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const parent = await prisma.account.findFirst({ where: { code: '2210', companyId: 'default-company' } });
    if (!parent) return console.log("Parent not found");
    console.log("Parent ID:", parent.id);
    
    // Simulate logic
    const lastChild = await prisma.account.findFirst({
        where: { parentId: parent.id, companyId: 'default-company' },
        orderBy: { code: 'desc' }
    });
    console.log("Last Child:", lastChild);
}
main();
