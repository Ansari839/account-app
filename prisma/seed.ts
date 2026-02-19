import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, AccountType, VoucherType } from '@prisma/client'
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

  // 2. Company Settings
  console.log("⚙️  Seeding Company Settings...");
  const settings = [
    { key: 'mandatory_grn', value: 'true', group: 'PURCHASE', type: 'BOOLEAN' },
    { key: 'mandatory_do', value: 'false', group: 'SALES', type: 'BOOLEAN' },
    { key: 'allow_negative_stock', value: 'false', group: 'INVENTORY', type: 'BOOLEAN' },
    { key: 'default_currency', value: 'USD', group: 'GENERAL', type: 'STRING' },
    { key: 'theme', value: 'dark', group: 'UI', type: 'STRING' },
    { key: 'logo_url', value: '/logo.png', group: 'BRANDING', type: 'STRING' },
  ];

  for (const s of settings) {
    await prisma.companySetting.upsert({
      where: { companyId_key: { companyId: company.id, key: s.key } },
      update: { value: s.value, type: s.type, group: s.group },
      create: { companyId: company.id, ...s }
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
      where: { companyId_code: { companyId: company.id, code: t.code } },
      update: t,
      create: { ...t, companyId: company.id }
    });
  }

  // 4. Chart of Accounts (User Provided Detailed Hierarchy)
  console.log("🗂️  Seeding Chart of Accounts...");
  const coaData = [
    // 1. ASSETS
    { code: '1000', name: 'ASSETS', type: 'ASSET' },
    { code: '1100', name: 'Non-Current Assets', type: 'ASSET', parentCode: '1000' },
    { code: '1110', name: 'Property, Plant & Equipment', type: 'ASSET', parentCode: '1100' },
    { code: '1120', name: 'Accumulated Depreciation', type: 'ASSET', parentCode: '1100' },
    { code: '1200', name: 'Current Assets', type: 'ASSET', parentCode: '1000' },
    { code: '1210', name: 'Cash & Cash Equivalents', type: 'ASSET', parentCode: '1200' },
    { code: '1211', name: 'Petty Cash', type: 'ASSET', parentCode: '1210' },
    { code: '1212', name: 'Cash in Hand', type: 'ASSET', parentCode: '1210' },
    { code: '1220', name: 'Bank Accounts', type: 'ASSET', parentCode: '1200' },
    { code: '1221', name: 'Meezan Bank - Operation', type: 'ASSET', parentCode: '1220' },
    { code: '1222', name: 'HBL - Corporate', type: 'ASSET', parentCode: '1220' },
    { code: '1230', name: 'Accounts Receivable', type: 'ASSET', parentCode: '1200' },
    { code: '1240', name: 'Inventory', type: 'ASSET', parentCode: '1200' },
    { code: '1250', name: 'Advances, Deposits & Prepayments', type: 'ASSET', parentCode: '1200' },
    { code: '1251', name: 'Advance Income Tax', type: 'ASSET', parentCode: '1250' },
    { code: '1252', name: 'Security Deposits', type: 'ASSET', parentCode: '1250' },

    // 2. LIABILITIES
    { code: '2000', name: 'LIABILITIES', type: 'LIABILITY' },
    { code: '2100', name: 'Non-Current Liabilities', type: 'LIABILITY', parentCode: '2000' },
    { code: '2110', name: 'Long Term Loans', type: 'LIABILITY', parentCode: '2100' },
    { code: '2200', name: 'Current Liabilities', type: 'LIABILITY', parentCode: '2000' },
    { code: '2210', name: 'Accounts Payable', type: 'LIABILITY', parentCode: '2200' },
    { code: '2220', name: 'Tax Payable', type: 'LIABILITY', parentCode: '2200' },
    { code: '2221', name: 'Sales Tax Payable', type: 'LIABILITY', parentCode: '2220' },
    { code: '2222', name: 'Income Tax Payable', type: 'LIABILITY', parentCode: '2220' },
    { code: '2223', name: 'SRB Payable', type: 'LIABILITY', parentCode: '2220' },
    { code: '2230', name: 'Accrued Expenses', type: 'LIABILITY', parentCode: '2200' },
    { code: '2240', name: 'Short Term Loans', type: 'LIABILITY', parentCode: '2200' },

    // 3. EQUITY
    { code: '3000', name: 'EQUITY', type: 'EQUITY' },
    { code: '3100', name: 'Share Capital', type: 'EQUITY', parentCode: '3000' },
    { code: '3200', name: 'Retained Earnings', type: 'EQUITY', parentCode: '3000' },
    { code: '3300', name: 'Drawings / Dividends', type: 'EQUITY', parentCode: '3000' },

    // 4. REVENUE
    { code: '4000', name: 'REVENUE', type: 'REVENUE' },
    { code: '4100', name: 'Operating Revenue', type: 'REVENUE', parentCode: '4000' },
    { code: '4110', name: 'Ocean Freight Income', type: 'REVENUE', parentCode: '4100' },
    { code: '4120', name: 'Air Freight Income', type: 'REVENUE', parentCode: '4100' },
    { code: '4130', name: 'Transportation Income', type: 'REVENUE', parentCode: '4100' },
    { code: '4140', name: 'Customs Clearance Income', type: 'REVENUE', parentCode: '4100' },
    { code: '4150', name: 'Agency Commission', type: 'REVENUE', parentCode: '4100' },
    { code: '4200', name: 'Other Income', type: 'REVENUE', parentCode: '4000' },
    { code: '4210', name: 'Exchange Gain', type: 'REVENUE', parentCode: '4200' },
    { code: '4220', name: 'Bank Profit', type: 'REVENUE', parentCode: '4200' },

    // 5. EXPENSES
    { code: '5000', name: 'EXPENSES', type: 'EXPENSE' },
    { code: '5100', name: 'Cost of Services (Direct)', type: 'EXPENSE', parentCode: '5000' },
    { code: '5110', name: 'Ocean Freight Expense', type: 'EXPENSE', parentCode: '5100' },
    { code: '5120', name: 'Air Freight Expense', type: 'EXPENSE', parentCode: '5100' },
    { code: '5130', name: 'Terminal Handling Charges (THC)', type: 'EXPENSE', parentCode: '5100' },
    { code: '5140', name: 'Delivery Order (DO) Charges', type: 'EXPENSE', parentCode: '5100' },
    { code: '5150', name: 'Customs Duty & Taxes', type: 'EXPENSE', parentCode: '5100' },
    { code: '5160', name: 'Transportation Charges', type: 'EXPENSE', parentCode: '5100' },
    { code: '5170', name: 'Port Charges', type: 'EXPENSE', parentCode: '5100' },
    { code: '5200', name: 'Operating Expenses (Admin)', type: 'EXPENSE', parentCode: '5000' },
    { code: '5210', name: 'Salaries & Wages', type: 'EXPENSE', parentCode: '5200' },
    { code: '5220', name: 'Rent, Rates & Taxes', type: 'EXPENSE', parentCode: '5200' },
    { code: '5230', name: 'Utilities (Elec, Water, Gas)', type: 'EXPENSE', parentCode: '5200' },
    { code: '5240', name: 'Internet & Communication', type: 'EXPENSE', parentCode: '5200' },
    { code: '5250', name: 'Entertainment & Refreshment', type: 'EXPENSE', parentCode: '5200' },
    { code: '5260', name: 'Repair & Maintenance', type: 'EXPENSE', parentCode: '5200' },
    { code: '5270', name: 'Marketing & Advertisement', type: 'EXPENSE', parentCode: '5200' },
    { code: '5280', name: 'Exchange Loss', type: 'EXPENSE', parentCode: '5200' },
  ];

  for (const ac of coaData) {
    const parent = ac.parentCode
      ? await prisma.account.findUnique({ where: { companyId_code: { companyId: 'default-company', code: ac.parentCode } } })
      : null;

    let type = ac.type === 'REVENUE' ? 'INCOME' : ac.type;
    const level = parent ? parent.level + 1 : 0;
    const isParent = coaData.some(item => item.parentCode === ac.code);
    const isPosting = !isParent;

    try {
      await prisma.account.upsert({
        where: { companyId_code: { companyId: 'default-company', code: ac.code } },
        update: {
          parentId: parent?.id,
          name: ac.name,
          type: type as AccountType,
          level,
          isPosting: isPosting,
          companyId: 'default-company'
        },
        create: {
          code: ac.code,
          name: ac.name,
          type: type as AccountType,
          companyId: 'default-company',
          parentId: parent?.id,
          level,
          isPosting: isPosting
        }
      });
    } catch (e: any) {
      console.error(`Error seeding COA ${ac.code}: ${e.message}`);
    }
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
      where: { companyId_name: { companyId: 'default-company', name: r.name } },
      update: r,
      create: { ...r, companyId: 'default-company' }
    });
    roleMap.set(r.name, role.id);
  }

  const adminEmail = 'admin@antigravity.erp';
  const passwordHash = await bcrypt.hash('Admin@123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, companyId: 'default-company', isSuperAdmin: true },
    create: {
      email: adminEmail,
      passwordHash,
      fullName: 'Super Administrator',
      isActive: true,
      isSuperAdmin: true,
      mustChangePass: false,
      companyId: 'default-company'
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

  // Link Admin to Default Company
  await prisma.userCompany.upsert({
    where: {
      userId_companyId: {
        userId: adminUser.id,
        companyId: 'default-company'
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      companyId: 'default-company',
      isDefault: true
    }
  });

  // 6. Financial Year
  console.log("📅 Seeding Current Financial Year...");
  await prisma.financialYear.upsert({
    where: { companyId_name: { companyId: 'default-company', name: 'FY 2025' } },
    update: {},
    create: {
      name: 'FY 2025',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      isOpen: true,
      companyId: 'default-company'
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
