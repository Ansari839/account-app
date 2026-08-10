import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth-utils';

// ─── Pakistani Standard COA Seed Data ─────────────────────────────────────────
// Structure: { code, name, type, isPosting, parentCode?, systemKey? }
// systemKey → will be stored in SystemAccountMapping for this account
// ──────────────────────────────────────────────────────────────────────────────

type SeedAccount = {
    code: string;
    name: string;
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
    isPosting: boolean;
    parentCode?: string;
    systemKey?: string;
    description?: string;
};

const SEED_ACCOUNTS: SeedAccount[] = [
    // ── ASSETS ──────────────────────────────────────────────────────────────
    { code: '1000', name: 'Assets', type: 'ASSET', isPosting: false },
    { code: '1100', name: 'Current Assets', type: 'ASSET', isPosting: false, parentCode: '1000' },
    { code: '1110', name: 'Cash in Hand', type: 'ASSET', isPosting: true, parentCode: '1100', systemKey: 'cash', description: 'Physical cash held on premises' },
    { code: '1120', name: 'Bank Accounts', type: 'ASSET', isPosting: false, parentCode: '1100' },
    { code: '1121', name: 'HBL Bank Account', type: 'ASSET', isPosting: true, parentCode: '1120', description: 'Habib Bank Limited current account' },
    { code: '1122', name: 'MCB Bank Account', type: 'ASSET', isPosting: true, parentCode: '1120', description: 'MCB Bank Limited current account' },
    { code: '1130', name: 'Accounts Receivable', type: 'ASSET', isPosting: true, parentCode: '1100', systemKey: 'accounts_receivable', description: 'Amount owed by customers' },
    { code: '1140', name: 'Inventory / Stock-in-Trade', type: 'ASSET', isPosting: true, parentCode: '1100', systemKey: 'inventory', description: 'Goods held for resale (perpetual inventory)' },
    { code: '1150', name: 'Advance to Suppliers', type: 'ASSET', isPosting: true, parentCode: '1100', description: 'Prepayments made to suppliers' },
    { code: '1160', name: 'Input Tax (GST Receivable)', type: 'ASSET', isPosting: true, parentCode: '1100', systemKey: 'input_tax', description: 'Sales tax paid on purchases, claimable from FBR' },
    { code: '1170', name: 'Advance Income Tax', type: 'ASSET', isPosting: true, parentCode: '1100', description: 'Withholding tax paid in advance' },
    { code: '1200', name: 'Fixed Assets', type: 'ASSET', isPosting: false, parentCode: '1000' },
    { code: '1210', name: 'Furniture & Fixtures', type: 'ASSET', isPosting: true, parentCode: '1200' },
    { code: '1220', name: 'Machinery & Equipment', type: 'ASSET', isPosting: true, parentCode: '1200' },
    { code: '1230', name: 'Vehicles', type: 'ASSET', isPosting: true, parentCode: '1200' },
    { code: '1240', name: 'Office Equipment', type: 'ASSET', isPosting: true, parentCode: '1200' },
    { code: '1250', name: 'Accumulated Depreciation', type: 'ASSET', isPosting: true, parentCode: '1200', description: 'Contra-asset: total depreciation accumulated' },

    // ── LIABILITIES ──────────────────────────────────────────────────────────
    { code: '2000', name: 'Liabilities', type: 'LIABILITY', isPosting: false },
    { code: '2100', name: 'Current Liabilities', type: 'LIABILITY', isPosting: false, parentCode: '2000' },
    { code: '2110', name: 'Accounts Payable', type: 'LIABILITY', isPosting: true, parentCode: '2100', systemKey: 'accounts_payable', description: 'Amount owed to suppliers' },
    { code: '2120', name: 'Output Tax (GST Payable)', type: 'LIABILITY', isPosting: true, parentCode: '2100', systemKey: 'output_tax', description: 'Sales tax collected from customers, payable to FBR' },
    { code: '2130', name: 'Accrued Expenses', type: 'LIABILITY', isPosting: true, parentCode: '2100', description: 'Expenses incurred but not yet paid' },
    { code: '2140', name: 'Short-term Loans', type: 'LIABILITY', isPosting: true, parentCode: '2100' },
    { code: '2150', name: 'Advance from Customers', type: 'LIABILITY', isPosting: true, parentCode: '2100', description: 'Customer deposits received before delivery' },
    { code: '2200', name: 'Long-term Liabilities', type: 'LIABILITY', isPosting: false, parentCode: '2000' },
    { code: '2210', name: 'Long-term Loans', type: 'LIABILITY', isPosting: true, parentCode: '2200' },

    // ── EQUITY ────────────────────────────────────────────────────────────────
    { code: '3000', name: 'Equity', type: 'EQUITY', isPosting: false },
    { code: '3100', name: "Owner's Capital", type: 'EQUITY', isPosting: true, parentCode: '3000', description: 'Capital invested by owner(s)' },
    { code: '3200', name: 'Retained Earnings', type: 'EQUITY', isPosting: true, parentCode: '3000', description: 'Accumulated net profits not distributed' },
    { code: '3300', name: 'Drawings', type: 'EQUITY', isPosting: true, parentCode: '3000', description: 'Withdrawals by owner — reduces equity' },

    // ── INCOME / REVENUE ──────────────────────────────────────────────────────
    { code: '4000', name: 'Income', type: 'INCOME', isPosting: false },
    { code: '4100', name: 'Sales Revenue', type: 'INCOME', isPosting: false, parentCode: '4000', description: 'Trading account — appears in P&L' },
    { code: '4110', name: 'Sales', type: 'INCOME', isPosting: true, parentCode: '4100', systemKey: 'sales', description: 'Revenue from sale of goods' },
    { code: '4120', name: 'Sales Returns', type: 'INCOME', isPosting: true, parentCode: '4100', systemKey: 'sales_returns', description: 'Contra-revenue: goods returned by customers' },
    { code: '4130', name: 'Sales Discount', type: 'INCOME', isPosting: true, parentCode: '4100', description: 'Discount given to customers on sales' },
    { code: '4200', name: 'Other Income', type: 'INCOME', isPosting: false, parentCode: '4000' },
    { code: '4210', name: 'Commission Income', type: 'INCOME', isPosting: true, parentCode: '4200' },
    { code: '4220', name: 'Miscellaneous Income', type: 'INCOME', isPosting: true, parentCode: '4200' },

    // ── EXPENSES ──────────────────────────────────────────────────────────────
    { code: '5000', name: 'Expenses', type: 'EXPENSE', isPosting: false },
    { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', isPosting: false, parentCode: '5000', description: 'Trading account — appears in P&L' },
    { code: '5110', name: 'Purchases', type: 'EXPENSE', isPosting: true, parentCode: '5100', systemKey: 'purchases', description: 'Cost of goods purchased for resale' },
    { code: '5120', name: 'Purchase Returns', type: 'EXPENSE', isPosting: true, parentCode: '5100', systemKey: 'purchase_returns', description: 'Contra-expense: goods returned to suppliers' },
    { code: '5130', name: 'Purchase Discount', type: 'EXPENSE', isPosting: true, parentCode: '5100', description: 'Discount received from suppliers on purchases' },
    { code: '5140', name: 'Freight & Carriage Inward', type: 'EXPENSE', isPosting: true, parentCode: '5100', description: 'Transport cost on purchased goods' },
    { code: '5200', name: 'Operating Expenses', type: 'EXPENSE', isPosting: false, parentCode: '5000', description: 'P&L — recurring business operating costs' },
    { code: '5210', name: 'Salaries & Wages', type: 'EXPENSE', isPosting: true, parentCode: '5200' },
    { code: '5220', name: 'Rent Expense', type: 'EXPENSE', isPosting: true, parentCode: '5200' },
    { code: '5230', name: 'Utilities Expense', type: 'EXPENSE', isPosting: true, parentCode: '5200', description: 'Electricity, gas, water bills' },
    { code: '5240', name: 'Telephone & Internet', type: 'EXPENSE', isPosting: true, parentCode: '5200' },
    { code: '5250', name: 'Depreciation Expense', type: 'EXPENSE', isPosting: true, parentCode: '5200' },
    { code: '5260', name: 'Repair & Maintenance', type: 'EXPENSE', isPosting: true, parentCode: '5200' },
    { code: '5270', name: 'Stationery & Printing', type: 'EXPENSE', isPosting: true, parentCode: '5200' },
    { code: '5280', name: 'Fuel & Transport', type: 'EXPENSE', isPosting: true, parentCode: '5200' },
    { code: '5290', name: 'Miscellaneous Expenses', type: 'EXPENSE', isPosting: true, parentCode: '5200' },
    { code: '5300', name: 'Financial Expenses', type: 'EXPENSE', isPosting: false, parentCode: '5000' },
    { code: '5310', name: 'Bank Charges', type: 'EXPENSE', isPosting: true, parentCode: '5300' },
    { code: '5320', name: 'Interest Expense', type: 'EXPENSE', isPosting: true, parentCode: '5300' },
];

export async function POST(request: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(request);
        if (error) return error;
        if (!companyId) return NextResponse.json({ error: 'No active company session' }, { status: 400 });

        let created = 0;
        let skipped = 0;

        // Step 1: Build a code → DB id map for parent resolution
        const codeToId: Record<string, string> = {};

        // Step 2: Seed accounts in order (parents first)
        for (const acc of SEED_ACCOUNTS) {
            const parentId = acc.parentCode ? codeToId[acc.parentCode] : undefined;

            // Calculate level (depth)
            let level = 0;
            if (acc.parentCode) {
                const parent = SEED_ACCOUNTS.find(a => a.code === acc.parentCode);
                level = parent ? SEED_ACCOUNTS.filter(a => a.code === acc.parentCode).length : 1;
                // Simple depth calculation based on parent's presence
                let p: SeedAccount | undefined = parent;
                level = 1;
                while (p?.parentCode) {
                    level++;
                    p = SEED_ACCOUNTS.find(a => a.code === p!.parentCode);
                }
            }

            const result = await prisma.account.upsert({
                where: { companyId_code: { companyId, code: acc.code } },
                update: {}, // Don't overwrite if already exists
                create: {
                    code: acc.code,
                    name: acc.name,
                    type: acc.type,
                    isPosting: acc.isPosting,
                    parentId: parentId || null,
                    level,
                    description: acc.description || null,
                    companyId,
                },
            });

            codeToId[acc.code] = result.id;

            // Track created vs existing (createdAt === updatedAt means fresh)
            const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
            if (isNew) created++; else skipped++;
        }

        // Step 3: Create system account mappings for accounts with systemKey
        const mappingAccounts = SEED_ACCOUNTS.filter(a => a.systemKey);
        for (const acc of mappingAccounts) {
            const accountId = codeToId[acc.code];
            if (!accountId) continue;

            await prisma.systemAccountMapping.upsert({
                where: { companyId_key: { companyId, key: acc.systemKey! } },
                update: {}, // Don't overwrite if admin has customized it
                create: {
                    companyId,
                    key: acc.systemKey!,
                    accountId,
                },
            });
        }

        return NextResponse.json({
            success: true,
            message: `COA seeded successfully`,
            data: { created, skipped, total: SEED_ACCOUNTS.length },
        });

    } catch (error: any) {
        console.error('[COA Seed] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
