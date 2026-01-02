import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("🔍 Finding default accounts...");

    const inventoryAccount = await prisma.account.findFirst({
        where: {
            OR: [
                { code: '1240' },
                { name: { contains: 'Inventory', mode: 'insensitive' } }
            ],
            isPosting: true
        }
    });

    const purchaseAccount = await prisma.account.findFirst({
        where: {
            OR: [
                { code: '5100' },
                { name: { contains: 'Purchase', mode: 'insensitive' } },
                { name: { contains: 'Cost of Services', mode: 'insensitive' } }
            ],
            isPosting: true
        }
    });

    console.log(`✅ Inventory Account: ${inventoryAccount?.name} (${inventoryAccount?.id})`);
    console.log(`✅ Purchase Account: ${purchaseAccount?.name} (${purchaseAccount?.id})`);

    if (!inventoryAccount || !purchaseAccount) {
        console.error("❌ Could not find required accounts. Please ensure COA is seeded correctly.");
        return;
    }

    console.log("🛠️  Updating products missing account mappings...");

    const result = await prisma.product.updateMany({
        where: {
            OR: [
                { inventoryAccountId: null },
                { purchaseAccountId: null }
            ]
        },
        data: {
            inventoryAccountId: inventoryAccount.id,
            purchaseAccountId: purchaseAccount.id
        }
    });

    console.log(`🎉 Updated ${result.count} products.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
