
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function main() {
    let prisma;
    try {
        console.log("Initializing Prisma...");
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const adapter = new PrismaPg(pool);
        prisma = new PrismaClient({ adapter });

        const id = '1cc3a14c-f70d-4b6a-bb6e-9b38bc20e481';
        console.log(`Inspecting ID: ${id}`);

        const asAccount = await prisma.account.findUnique({ where: { id } });
        if (asAccount) {
            console.log(`[FOUND] It is an Account: ${asAccount.name}`);
            const linkedCust = await prisma.customer.findFirst({
                where: { receivableAccountId: id }
            });
            console.log(`   -> Linked Customer: ${linkedCust ? linkedCust.name : 'NONE'}`);
        } else {
            console.log(`[NOT FOUND] Not an Account.`);
        }

        const asCustomer = await prisma.customer.findUnique({ where: { id } });
        if (asCustomer) {
            console.log(`[FOUND] It is a Customer: ${asCustomer.name}`);
        } else {
            console.log(`[NOT FOUND] Not a Customer via ID.`);
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        if (prisma) await prisma.$disconnect();
    }
}

main();
