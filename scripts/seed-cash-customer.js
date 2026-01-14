
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function main() {
    let prisma;
    try {
        console.log("Initializing Prisma...");
        try {
            prisma = new PrismaClient();
            await prisma.$connect();
        } catch (e) {
            console.log("Standard init failed, trying adapter...");
            const pool = new Pool({ connectionString: process.env.DATABASE_URL });
            const adapter = new PrismaPg(pool);
            prisma = new PrismaClient({ adapter });
        }

        console.log("Connected. Fetching Base Currency...");
        const baseCurrency = await prisma.currency.findFirst({
            where: { isBase: true }
        });

        let currency = baseCurrency;
        if (!currency) {
            currency = await prisma.currency.findFirst();
        }

        if (!currency) {
            console.error("CRITICAL: No Currency found in system. Cannot create customers.");
            return;
        }
        console.log(`Using Currency: ${currency.code}`);

        console.log("Identifying Cash/Bank Accounts...");
        const accounts = await prisma.account.findMany({
            where: {
                type: 'ASSET',
                OR: [
                    { name: { contains: 'Cash', mode: 'insensitive' } },
                    { name: { contains: 'Bank', mode: 'insensitive' } },
                    { name: { contains: 'Hand', mode: 'insensitive' } }
                ]
            }
        });

        console.log(`Found ${accounts.length} potential Cash/Bank accounts.`);

        for (const acc of accounts) {
            const existing = await prisma.customer.findFirst({
                where: { receivableAccountId: acc.id }
            });

            if (existing) {
                console.log(`[OK] Account '${acc.name}' is already linked to Customer: ${existing.name}`);
            } else {
                console.log(`[MISSING] Account '${acc.name}' has NO linked Customer. Creating one...`);

                try {
                    const newCust = await prisma.customer.create({
                        data: {
                            name: `Cash Customer - ${acc.name}`,
                            code: `CUST-${acc.code || acc.id.substring(0, 6)}`,
                            receivableAccountId: acc.id,
                            currencyCode: currency.code
                        }
                    });
                    console.log(`   -> Created: ${newCust.name} (${newCust.code})`);
                } catch (err) {
                    console.error(`   -> Failed to create customer for ${acc.name}:`, err.message);

                    try {
                        const newCust = await prisma.customer.create({
                            data: {
                                name: `Cash Customer - ${acc.name} (Ref)`,
                                code: `CUST-${Date.now()}`,
                                receivableAccountId: acc.id,
                                currencyCode: currency.code
                            }
                        });
                        console.log(`   -> Created (Fallback): ${newCust.name} (${newCust.code})`);
                    } catch (e2) {
                        console.error(`   -> Failed again:`, e2.message);
                    }
                }
            }
        }

    } catch (e) {
        console.error("Critical Error:", e);
    } finally {
        if (prisma) await prisma.$disconnect();
    }
}

main();
