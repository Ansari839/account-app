
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
        console.log(`Inspecting Customer ID: ${id}`);

        const cust = await prisma.customer.findUnique({
            where: { id },
            include: { receivableAccount: true }
        });

        if (cust) {
            console.log("Customer Found:", JSON.stringify(cust, null, 2));
        } else {
            console.log("Customer NOT FOUND via Prisma.");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        if (prisma) await prisma.$disconnect();
    }
}

main();
