import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, AccountType } from '@prisma/client'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log(`🚀 Start seeding COA for Default Company ...`)

    // 1. Create Default Company
    const company = await prisma.company.upsert({
        where: { id: 'default-company' },
        update: {},
        create: {
            id: 'default-company',
            name: 'Antigravity ERP Corp',
            email: 'admin@antigravity.erp',
            address: 'Main App Office'
        },
    });

    // 2. Company Settings
    console.log("⚙️  Seeding Company Settings...");
    const settings = [
        { key: 'mandatory_grn', value: 'false', group: 'PURCHASE', type: 'BOOLEAN' },
        { key: 'mandatory_do', value: 'false', group: 'SALES', type: 'BOOLEAN' },
        { key: 'allow_negative_stock', value: 'false', group: 'INVENTORY', type: 'BOOLEAN' },
        { key: 'default_currency', value: 'PKR', group: 'GENERAL', type: 'STRING' },
        { key: 'theme', value: 'light', group: 'UI', type: 'STRING' },
    ];

    for (const s of settings) {
        await prisma.companySetting.upsert({
            where: { companyId_key: { companyId: company.id, key: s.key } },
            update: { value: s.value, type: s.type, group: s.group },
            create: { companyId: company.id, ...s }
        });
    }

    // 2.5 Currencies and Units
    console.log("💱 Seeding Currencies and Units...");
    await prisma.currency.upsert({
        where: { code: 'PKR' },
        update: {},
        create: { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs.', rate: 1, isBase: true }
    });

    await prisma.unit.upsert({
        where: { code: 'MTR' },
        update: {},
        create: { code: 'MTR', name: 'Meter' }
    });

    await prisma.unit.upsert({
        where: { code: 'PCS' },
        update: {},
        create: { code: 'PCS', name: 'Pieces' }
    });

    // 3. Chart of Accounts (Garments Specific)
    console.log("🗂️  Seeding Chart of Accounts...");
    const coaData = [
        // 1. ASSETS
        { code: '1000', name: 'ASSETS', type: 'ASSET' },
        { code: '1100', name: 'Non-Current Assets', type: 'ASSET', parentCode: '1000' },
        { code: '1110', name: 'Machinery & Equipment', type: 'ASSET', parentCode: '1100' },
        { code: '1200', name: 'Current Assets', type: 'ASSET', parentCode: '1000' },
        { code: '1210', name: 'Cash & Bank', type: 'ASSET', parentCode: '1200' },
        { code: '1211', name: 'Petty Cash', type: 'ASSET', parentCode: '1210' },
        { code: '1212', name: 'Business Bank Account', type: 'ASSET', parentCode: '1210' },
        { code: '1220', name: 'Accounts Receivable', type: 'ASSET', parentCode: '1200' },
        { code: '1230', name: 'Inventory', type: 'ASSET', parentCode: '1200' },
        { code: '1231', name: 'Raw Materials Inventory', type: 'ASSET', parentCode: '1230' },
        { code: '1232', name: 'Finished Goods Inventory', type: 'ASSET', parentCode: '1230' },

        // 2. LIABILITIES
        { code: '2000', name: 'LIABILITIES', type: 'LIABILITY' },
        { code: '2100', name: 'Current Liabilities', type: 'LIABILITY', parentCode: '2000' },
        { code: '2110', name: 'Accounts Payable', type: 'LIABILITY', parentCode: '2100' },
        { code: '2120', name: 'Accrued Salaries', type: 'LIABILITY', parentCode: '2100' },
        { code: '2130', name: 'Tax Payable', type: 'LIABILITY', parentCode: '2100' },

        // 3. EQUITY
        { code: '3000', name: 'EQUITY', type: 'EQUITY' },
        { code: '3100', name: 'Capital Account', type: 'EQUITY', parentCode: '3000' },
        { code: '3200', name: 'Retained Earnings', type: 'EQUITY', parentCode: '3000' },

        // 4. INCOME
        { code: '4000', name: 'INCOME', type: 'INCOME' },
        { code: '4100', name: 'Sales Revenue', type: 'INCOME', parentCode: '4000' },
        { code: '4110', name: 'Local Sales', type: 'INCOME', parentCode: '4100' },
        { code: '4120', name: 'Export Sales', type: 'INCOME', parentCode: '4100' },

        // 5. EXPENSES
        { code: '5000', name: 'EXPENSES', type: 'EXPENSE' },
        { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', parentCode: '5000' },
        { code: '5110', name: 'Purchases', type: 'EXPENSE', parentCode: '5100' },
        { code: '5200', name: 'Operating Expenses', type: 'EXPENSE', parentCode: '5000' },
        { code: '5210', name: 'Salaries & Wages', type: 'EXPENSE', parentCode: '5200' },
        { code: '5220', name: 'Rent Expense', type: 'EXPENSE', parentCode: '5200' },
        { code: '5230', name: 'Utility Bills', type: 'EXPENSE', parentCode: '5200' },
    ];

    const accountMap = new Map();

    for (const ac of coaData) {
        const parent = ac.parentCode ? accountMap.get(ac.parentCode) : null;
        const isParent = coaData.some(item => item.parentCode === ac.code);

        const account = await prisma.account.upsert({
            where: { companyId_code: { companyId: company.id, code: ac.code } },
            update: {
                name: ac.name,
                type: ac.type as AccountType,
                parentId: parent?.id,
                level: parent ? parent.level + 1 : 0,
                isPosting: !isParent,
            },
            create: {
                code: ac.code,
                name: ac.name,
                type: ac.type as AccountType,
                companyId: company.id,
                parentId: parent?.id,
                level: parent ? parent.level + 1 : 0,
                isPosting: !isParent,
            }
        });
        accountMap.set(ac.code, account);
    }

    // 4. Admin User
    console.log("👤 Seeding Admin for Default Company...");
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    await prisma.user.upsert({
        where: { email: 'admin@antigravity.erp' },
        update: {
            passwordHash,
            mustChangePass: false,
            company: { connect: { id: company.id } }
        },
        create: {
            email: 'admin@antigravity.erp',
            passwordHash,
            fullName: 'Antigravity Admin',
            isActive: true,
            mustChangePass: false,
            company: { connect: { id: company.id } },
        }
    });

    console.log(`🎉 COA Seeding successfully finished for Default Company!`)
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
