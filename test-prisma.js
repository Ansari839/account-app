const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    try {
        const count = await prisma.stockLedger.count({ where: { productId: "some-id" } });
        console.log("Count:", count);
    } catch(e) {
        console.error("Error:", e);
    }
}
main();
