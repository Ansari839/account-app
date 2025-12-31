import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, AccountType, VoucherType } from '../app/generated/prisma/client'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log(`🚀 Start seeding production data ...`)

  // 1. Create Default Company
  const company = await prisma.company.upsert({
    where: { id: 'default-company' },
    update: {},
    create: {
      id: 'default-company',
      name: 'Antigravity ERP Corp',
      email: 'admin@antigravity.erp',
      address: '123 Infinite Loop, Silicon Valley, CA'
    },
  });

  // 2. Global Settings
  console.log("⚙️  Seeding Global Settings...");
  const settings = [
    { key: 'mandatory_grn', value: 'true', group: 'PURCHASE', type: 'BOOLEAN' },
    { key: 'mandatory_do', value: 'false', group: 'SALES', type: 'BOOLEAN' },
    { key: 'allow_negative_stock', value: 'false', group: 'INVENTORY', type: 'BOOLEAN' },
    { key: 'default_currency', value: 'USD', group: 'GENERAL', type: 'STRING' },
    { key: 'theme', value: 'dark', group: 'UI', type: 'STRING' },
    { key: 'logo_url', value: '/logo.png', group: 'BRANDING', type: 'STRING' },
  ];

  for (const s of settings) {
    await prisma.globalSetting.upsert({
      where: { key: s.key },
      update: s,
      create: s
    });
  }

  // 3. Tax Codes
  console.log("📝 Seeding Tax Codes...");
  const taxCodes = [
    { code: 'VAT-15', name: 'VAT 15%', rate: 15 },
    { code: 'VAT-5', name: 'VAT 5%', rate: 5 },
    { code: 'TAX-EXE', name: 'Tax Exempt', rate: 0 },
  ];

  for (const t of taxCodes) {
    await prisma.taxCode.upsert({
      where: { code: t.code },
      update: t,
      create: t
    });
  }

  // 4. Chart of Accounts (Basic Hierarchy)
  console.log("🗂️  Seeding Chart of Accounts...");
  const coa = [
    // Assets
    { code: '1000', name: 'Current Assets', type: AccountType.ASSET, isPosting: false },
    { code: '1001', name: 'Bank Account', type: AccountType.ASSET, isPosting: true, parentCode: '1000' },
    { code: '1100', name: 'Accounts Receivable', type: AccountType.ASSET, isPosting: true, parentCode: '1000' },
    { code: '1200', name: 'Inventory', type: AccountType.ASSET, isPosting: true, parentCode: '1000' },

    // Liabilities
    { code: '2000', name: 'Current Liabilities', type: AccountType.LIABILITY, isPosting: false },
    { code: '2100', name: 'Accounts Payable', type: AccountType.LIABILITY, isPosting: true, parentCode: '2000' },
    { code: '2200', name: 'Output Tax', type: AccountType.LIABILITY, isPosting: true, parentCode: '2000' },

    // Equity
    { code: '3000', name: 'Equity & Capital', type: AccountType.EQUITY, isPosting: false },
    { code: '3100', name: 'Owner Capital', type: AccountType.EQUITY, isPosting: true, parentCode: '3000' },
    { code: '3200', name: 'Retained Earnings', type: AccountType.EQUITY, isPosting: true, parentCode: '3000' },

    // Income
    { code: '4000', name: 'Sales Revenue', type: AccountType.INCOME, isPosting: true },

    // Expenses
    { code: '5000', name: 'Cost of Goods Sold', type: AccountType.EXPENSE, isPosting: true },
    { code: '5100', name: 'Operating Expenses', type: AccountType.EXPENSE, isPosting: false },
    { code: '5101', name: 'Rent Expense', type: AccountType.EXPENSE, isPosting: true, parentCode: '5100' },
    { code: '5102', name: 'Salary Expense', type: AccountType.EXPENSE, isPosting: true, parentCode: '5100' },
  ];

  const accountMap = new Map();

  for (const acc of coa) {
    const parentId = acc.parentCode ? accountMap.get(acc.parentCode) : null;
    const level = parentId ? 1 : 0; // Simple level logic for seed

    const created = await prisma.account.upsert({
      where: { code: acc.code },
      update: {
        name: acc.name,
        type: acc.type,
        isPosting: acc.isPosting,
        parentId: parentId || undefined,
        level
      },
      create: {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        isPosting: acc.isPosting,
        parentId,
        level
      }
    });
    accountMap.set(acc.code, created.id);
  }

  // 5. User Roles & Admin
  console.log("👤 Seeding Admin User & Roles...");
  const roles = [
    { name: 'ADMIN', description: 'Full System Access' },
    { name: 'ACCOUNTANT', description: 'Financial Entry & Reporting' },
    { name: 'SALES_REP', description: 'Sales Transactions Only' },
  ];

  const roleMap = new Map();
  for (const r of roles) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: r,
      create: r
    });
    roleMap.set(r.name, role.id);
  }

  const adminEmail = 'admin@antigravity.erp';
  const passwordHash = await bcrypt.hash('Admin@123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: {
      email: adminEmail,
      passwordHash,
      fullName: 'Super Administrator',
      isActive: true,
      mustChangePass: false
    }
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: roleMap.get('ADMIN')
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: roleMap.get('ADMIN')
    }
  });

  // 6. Financial Year
  console.log("📅 Seeding Current Financial Year...");
  await prisma.financialYear.upsert({
    where: { name: 'FY 2025' },
    update: {},
    create: {
      name: 'FY 2025',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      isOpen: true
    }
  });

  console.log(`✅ Created admin: ${adminEmail} (Pass: Admin@123)`);
  console.log(`🎉 Seeding finished successfully.`)
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