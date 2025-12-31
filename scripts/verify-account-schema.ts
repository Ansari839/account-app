
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, AccountType } from '../app/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Starting Accounting Schema Verification...');

    try {
        // 1. Create Financial Year (Prerequisite)
        const fy = await prisma.financialYear.create({
            data: {
                name: 'FY 2025-26',
                startDate: new Date('2025-04-01'),
                endDate: new Date('2026-03-31'),
                isOpen: true,
            },
        });
        console.log('✅ Created Financial Year:', fy.name);

        // 2. Create Chart of Accounts Hierarchy
        const assets = await prisma.account.create({
            data: {
                code: '1000',
                name: 'Assets',
                type: AccountType.ASSET,
                isPosting: false,
                level: 1,
            },
        });

        const bank = await prisma.account.create({
            data: {
                code: '1100',
                name: 'Bank Limit',
                type: AccountType.ASSET,
                isPosting: true,
                parentId: assets.id,
                level: 2,
            },
        });
        console.log('✅ Created COA Hierarchy:', `${assets.name} -> ${bank.name}`);

        // 3. Create Unit & Conversion
        const kgs = await prisma.unit.create({
            data: { name: 'Kilograms', code: 'KG' }
        });
        const grams = await prisma.unit.create({
            data: { name: 'Grams', code: 'GM' }
        });

        await prisma.unitConversion.create({
            data: {
                fromUnitId: kgs.id,
                toUnitId: grams.id,
                factor: 1000
            }
        });
        console.log('✅ Created Units & Conversion');


        // 4. Create Tax Code
        const vat = await prisma.taxCode.create({
            data: { name: 'VAT 5%', code: 'VAT5', rate: 5.0 },
        });

        // 5. Create Category
        const electronics = await prisma.category.create({
            data: { name: 'Electronics' },
        });

        // 6. Create Product with Links
        const product = await prisma.product.create({
            data: {
                code: 'LAP-001',
                name: 'Laptop X1',
                categoryId: electronics.id,
                baseUnitId: kgs.id,
                taxCodeId: vat.id,
                inventoryAccountId: bank.id, // Just for testing linkage
                cogsAccountId: bank.id,
                salesAccountId: bank.id,
                purchaseAccountId: bank.id,
            },
        });
        console.log('✅ Created Product linked to Accounts:', product.code);

        // 7. Create Customer with Receivable Account
        const usd = await prisma.currency.create({
            data: { code: 'USD', name: 'US Dollar', symbol: '$', rate: 1 }
        });

        const customer = await prisma.customer.create({
            data: {
                code: 'CUST-001',
                name: 'Tech Solutions Inc',
                currencyCode: usd.code,
                receivableAccountId: bank.id,
            },
        });
        console.log('✅ Created Customer linked to Receivable Account:', customer.name);

        // 8. Create Warehouse
        const warehouse = await prisma.warehouse.create({
            data: { code: 'WH-MAIN', name: 'Main Warehouse', isDefault: true }
        });
        console.log('✅ Created Warehouse:', warehouse.name);

    } catch (e) {
        console.error('❌ Verification Failed:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
