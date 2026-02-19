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
    console.log(`🚀 Start seeding garments data for MS Tech ...`)

    // 1. Create MS Tech Company
    const company = await prisma.company.upsert({
        where: { id: 'mstech-company' },
        update: {},
        create: {
            id: 'mstech-company',
            name: 'MS Tech Garments',
            email: 'contact@mstech.com',
            address: 'Industrial Area Phase II, Karachi, Pakistan'
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
    const pkr = await prisma.currency.upsert({
        where: { companyId_code: { companyId: company.id, code: 'PKR' } },
        update: {},
        create: { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs.', rate: 1, isBase: true, companyId: company.id }
    });

    const meter = await prisma.unit.upsert({
        where: { companyId_code: { companyId: company.id, code: 'MTR' } },
        update: {},
        create: { code: 'MTR', name: 'Meter', companyId: company.id }
    });

    const pack = await prisma.unit.upsert({
        where: { companyId_code: { companyId: company.id, code: 'PKT' } },
        update: {},
        create: { code: 'PKT', name: 'Pack', companyId: company.id }
    });

    const pcs = await prisma.unit.upsert({
        where: { companyId_code: { companyId: company.id, code: 'PCS' } },
        update: {},
        create: { code: 'PCS', name: 'Pieces', companyId: company.id }
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
        { code: '1212', name: 'Meezan Bank - MS Tech', type: 'ASSET', parentCode: '1210' },
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
        { code: '5110', name: 'Fabric Purchases', type: 'EXPENSE', parentCode: '5100' },
        { code: '5120', name: 'Tailoring Charges', type: 'EXPENSE', parentCode: '5100' },
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

    // 4. Warehouses
    console.log("🏭 Seeding Warehouses...");
    const warehouses = [
        { name: 'Main Store', code: 'WH-MAIN', address: 'Industrial Area' },
        { name: 'Production Unit', code: 'WH-PROD', address: 'Section B' },
        { name: 'Retail Outlet', code: 'WH-RETAIL', address: 'Commercial Center' },
    ];

    for (const w of warehouses) {
        await prisma.warehouse.upsert({
            where: { companyId_code: { companyId: company.id, code: w.code } },
            update: { name: w.name, address: w.address },
            create: { ...w, companyId: company.id }
        });
    }

    // 5. Product Categories
    console.log("📂 Seeding Categories...");
    const categories = [
        { name: 'Fabric' },
        { name: 'Ready-to-Wear' },
        { name: 'Trimmings' },
    ];

    const catMap = new Map();
    for (const c of categories) {
        let category = await prisma.category.findFirst({ where: { name: c.name, companyId: company.id } });
        if (!category) {
            category = await prisma.category.create({ data: { ...c, companyId: company.id } });
        }
        catMap.set(c.name, category);
    }

    // 6. Products
    console.log("👕 Seeding Products...");
    const products = [
        { name: 'Cotton Fabric (Roll)', code: 'PROD-FAB-COT', catName: 'Fabric', unitCode: 'MTR', price: 700 },
        { name: 'Denim Fabric (Roll)', code: 'PROD-FAB-DEN', catName: 'Fabric', unitCode: 'MTR', price: 1100 },
        { name: 'Men T-Shirt (White)', code: 'PROD-RTW-TSH', catName: 'Ready-to-Wear', unitCode: 'PCS', price: 600 },
        { name: 'Women Silk Scarf', code: 'PROD-RTW-SCRF', catName: 'Ready-to-Wear', unitCode: 'PCS', price: 900 },
        { name: 'Metallic Zipper (Pkt)', code: 'PROD-TRIM-ZIP', catName: 'Trimmings', unitCode: 'PKT', price: 100 },
    ];

    for (const p of products) {
        const unit = await prisma.unit.findUnique({ where: { companyId_code: { companyId: company.id, code: p.unitCode } } });
        if (!unit) throw new Error(`Unit ${p.unitCode} not found`);

        const product = await prisma.product.upsert({
            where: { companyId_code: { companyId: company.id, code: p.code } },
            update: {
                name: p.name,
                categoryId: catMap.get(p.catName).id,
                baseUnitId: unit.id,
                inventoryAccountId: accountMap.get('1231').id,
                purchaseAccountId: accountMap.get('5110').id,
                salesAccountId: accountMap.get('4110').id,
                cogsAccountId: accountMap.get('5100').id,
            },
            create: {
                code: p.code,
                name: p.name,
                companyId: company.id,
                categoryId: catMap.get(p.catName).id,
                baseUnitId: unit.id,
                inventoryAccountId: accountMap.get('1231').id,
                purchaseAccountId: accountMap.get('5110').id,
                salesAccountId: accountMap.get('4110').id,
                cogsAccountId: accountMap.get('5100').id,
            }
        });

        // Create default variant for pricing
        await prisma.productVariant.upsert({
            where: { sku: `${p.code}-STD` },
            update: { price: p.price },
            create: {
                productId: product.id,
                name: 'Standard',
                sku: `${p.code}-STD`,
                price: p.price
            }
        });
    }

    // 7. Suppliers & Customers
    console.log("🤝 Seeding Parties...");
    await prisma.supplier.upsert({
        where: { companyId_code: { companyId: company.id, code: 'SUP-001' } },
        update: {
            name: 'Textile Mills Ltd',
            currencyCode: pkr.id,
            payableAccountId: accountMap.get('2110').id,
        },
        create: {
            code: 'SUP-001',
            name: 'Textile Mills Ltd',
            companyId: company.id,
            currencyCode: pkr.id,
            payableAccountId: accountMap.get('2110').id,
        }
    });

    await prisma.customer.upsert({
        where: { companyId_code: { companyId: company.id, code: 'CUS-001' } },
        update: {
            name: 'Retail Fashion Hub',
            currencyCode: pkr.id,
            receivableAccountId: accountMap.get('1220').id,
        },
        create: {
            code: 'CUS-001',
            name: 'Retail Fashion Hub',
            companyId: company.id,
            currencyCode: pkr.id,
            receivableAccountId: accountMap.get('1220').id,
        }
    });

    // 8. Admin User + UserCompany
    console.log("👤 Seeding Admin...");
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@mstech.com' },
        update: {
            passwordHash,
            mustChangePass: false,
            companyId: company.id
        },
        create: {
            email: 'admin@mstech.com',
            passwordHash,
            fullName: 'MS Tech Admin',
            isActive: true,
            mustChangePass: false,
            companyId: company.id
        }
    });

    // Link user to company
    await prisma.userCompany.upsert({
        where: { userId_companyId: { userId: adminUser.id, companyId: company.id } },
        update: { role: 'ADMIN' },
        create: { userId: adminUser.id, companyId: company.id, role: 'ADMIN', isDefault: true }
    });

    console.log(`🎉 MS Tech Seeding successfully finished!`)
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
