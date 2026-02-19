import prisma from "@/lib/prisma";
import { Prisma, AccountType } from "@prisma/client";

export class ReportService {
    /**
     * Ledger Report for a specific account
     */
    static async getLedger(companyId: string, accountId: string, startDate: Date, endDate: Date) {
        // 1. Get Opening Balance (sum of all before startDate)
        const opening = await prisma.journalLine.aggregate({
            where: {
                OR: [
                    { accountId, account: { companyId } },
                    { accountId, account: { companyId: null } }
                ],
                entry: {
                    date: { lt: startDate },
                    status: true
                }
            },
            _sum: { debit: true, credit: true }
        });

        const account = await prisma.account.findUnique({ where: { id: accountId } });
        const initialOpening = account?.openingBalance?.toNumber() || 0;
        const initialType = account?.openingBalanceType || 'DR';

        const openingBalance = (initialType === 'DR' ? initialOpening : -initialOpening) +
            (opening._sum.debit?.toNumber() || 0) - (opening._sum.credit?.toNumber() || 0);

        // 2. Get Transactions
        const transactions = await prisma.journalLine.findMany({
            where: {
                OR: [
                    { accountId, account: { companyId } },
                    { accountId, account: { companyId: null } }
                ],
                entry: {
                    date: { gte: startDate, lte: endDate },
                    status: true
                }
            },
            include: { entry: true },
            orderBy: { entry: { date: 'asc' } }
        });

        return {
            openingBalance,
            transactions: transactions.map(t => ({
                id: t.id,
                voucherNo: t.entry.number,
                date: t.entry.date,
                type: t.entry.type,
                narration: t.narration || t.entry.narration,
                debit: t.debit,
                credit: t.credit,
                ref: t.entry.reference
            }))
        };
    }

    /**
     * Trial Balance - Professional view (includes all accounts, must equal)
     */
    static async getTrialBalance(companyId: string, endDate: Date) {
        // 1. Get transaction balances for ALL accounts
        const balances = await prisma.journalLine.groupBy({
            by: ['accountId'],
            where: {
                OR: [
                    { account: { companyId } },
                    { account: { companyId: null } }
                ],
                entry: { date: { lte: endDate }, status: true }
            },
            _sum: { debit: true, credit: true }
        });

        // 2. Fetch all accounts related to the company or global scope
        const accounts = await prisma.account.findMany({
            where: {
                OR: [{ companyId }, { companyId: null }]
            }
        });

        const report = accounts.map(acc => {
            const b = balances.find(item => item.accountId === acc.id);
            const debits = b?._sum.debit?.toNumber() || 0;
            const credits = b?._sum.credit?.toNumber() || 0;
            const opening = acc.openingBalance?.toNumber() || 0;

            const net = (acc.openingBalanceType === 'DR' ? opening : -opening) + debits - credits;

            return {
                accountCode: acc.code,
                accountName: acc.name,
                type: acc.type,
                debit: net > 0 ? net : 0,
                credit: net < 0 ? Math.abs(net) : 0
            };
        }).filter(r => Math.abs(r.debit) > 0.001 || Math.abs(r.credit) > 0.001);

        return report;
    }

    /**
     * Day Book
     */
    static async getDayBook(companyId: string, date: Date) {
        return await prisma.journalEntry.findMany({
            where: {
                lines: { some: { account: { companyId } } },
                date: {
                    gte: new Date(date.setHours(0, 0, 0, 0)),
                    lte: new Date(date.setHours(23, 59, 59, 999))
                },
                status: true
            },
            include: {
                lines: { include: { account: true } }
            },
            orderBy: { createdAt: 'asc' }
        });
    }

    /**
     * Profit & Loss Statement
     */
    /**
     * Profit & Loss Statement - Professional Hierarchical View
     */
    static async getProfitLoss(companyId: string, startDate: Date, endDate: Date) {
        // 1. Fetch all Income/Expense accounts (Posting & Non-Posting)
        const allAccounts = await prisma.account.findMany({
            where: {
                OR: [{ companyId }, { companyId: null }],
                type: { in: [AccountType.INCOME, AccountType.EXPENSE] }
            },
            orderBy: { level: 'desc' } // Work from leaves upwards
        });

        // 2. Get transaction balances for all posting accounts within the date range
        const postingBalances = await prisma.journalLine.groupBy({
            by: ['accountId'],
            where: {
                OR: [
                    { account: { companyId } },
                    { account: { companyId: null } }
                ],
                entry: {
                    date: { gte: startDate, lte: endDate },
                    status: true
                }
            },
            _sum: { debit: true, credit: true }
        });

        // 3. Map to compute net balances for each account (including roll-ups)
        const accountBalances = new Map<string, number>();

        // Phase A: Identify individual posting balances
        for (const acc of allAccounts) {
            const b = postingBalances.find(item => item.accountId === acc.id);
            const debits = b?._sum.debit?.toNumber() || 0;
            const credits = b?._sum.credit?.toNumber() || 0;

            // For P&L:
            // INCOME: Credit is positive, Debit is negative (Credit - Debit)
            // EXPENSE: Debit is positive, Credit is negative (Debit - Credit)
            let net = 0;
            if (acc.type === AccountType.INCOME) {
                net = credits - debits;
            } else {
                net = debits - credits;
            }

            accountBalances.set(acc.id, net);
        }

        // Phase B: Roll up balances to parents
        // Sorted by level desc ensures children are processed before parents
        for (const acc of allAccounts) {
            if (acc.parentId) {
                const childBalance = accountBalances.get(acc.id) || 0;
                const parentBalance = accountBalances.get(acc.parentId) || 0;
                accountBalances.set(acc.parentId, parentBalance + childBalance);
            }
        }

        // 4. Construct the Report Structure
        const buildSection = (type: AccountType) => {
            // Get Groups (Level 1 Parents) e.g., Operating Income, COGS
            // Note: Adjust level filter if your root accounts are at Level 0
            const groups = allAccounts
                .filter(a => a.type === type && a.level === 0)
                .sort((a, b) => a.code.localeCompare(b.code));

            const resultGroups: any[] = [];
            const ungroupedItems: any[] = [];

            // Helper to build recursive tree
            const buildTree = (parentId: string): any[] => {
                return allAccounts
                    .filter(a => a.parentId === parentId)
                    .sort((a, b) => a.code.localeCompare(b.code))
                    .map(a => {
                        const bal = accountBalances.get(a.id) || 0;
                        const children = buildTree(a.id);
                        if (Math.abs(bal) < 0.001) return null; // Hide zero balance items

                        return {
                            name: a.name,
                            code: a.code,
                            amount: bal,
                            level: a.level,
                            isPosting: a.isPosting,
                            children: children.length > 0 ? children : undefined
                        };
                    })
                    .filter(item => item !== null);
            };

            for (const group of groups) {
                const groupBalance = accountBalances.get(group.id) || 0;
                if (Math.abs(groupBalance) < 0.001) continue;

                const children = buildTree(group.id);

                resultGroups.push({
                    name: group.name,
                    code: group.code,
                    amount: groupBalance,
                    level: group.level,
                    isPosting: group.isPosting,
                    children
                });
            }

            return resultGroups;
        };

        const incomeSection = buildSection(AccountType.INCOME);
        const expenseSection = buildSection(AccountType.EXPENSE);

        // Calculate Grand Totals
        // Use Level 0 accounts for strict summation to avoid double counting
        const totalIncome = allAccounts
            .filter(a => a.type === AccountType.INCOME && a.level === 0)
            .reduce((sum, a) => sum + (accountBalances.get(a.id) || 0), 0);

        const totalExpense = allAccounts
            .filter(a => a.type === AccountType.EXPENSE && a.level === 0)
            .reduce((sum, a) => sum + (accountBalances.get(a.id) || 0), 0);

        return {
            income: incomeSection,
            expense: expenseSection,
            totalIncome,
            totalExpense,
            netProfit: totalIncome - totalExpense
        };
    }

    /**
     * Cash Flow Statement
     */
    static async getCashFlow(companyId: string, startDate: Date, endDate: Date) {
        const cashAccounts = await prisma.account.findMany({
            where: {
                companyId,
                OR: [
                    { name: { contains: 'Cash' } },
                    { name: { contains: 'Bank' } }
                ],
                isPosting: true
            }
        });

        const cashAccountIds = cashAccounts.map(a => a.id);

        const lines = await prisma.journalLine.findMany({
            where: {
                accountId: { in: cashAccountIds },
                account: { companyId },
                entry: { date: { gte: startDate, lte: endDate }, status: true }
            },
            include: { entry: { include: { lines: { include: { account: true } } } } }
        });

        const inflows: any[] = [];
        const outflows: any[] = [];
        let netCashFlow = 0;

        for (const line of lines) {
            const amount = (line.debit?.toNumber() || 0) - (line.credit?.toNumber() || 0);
            const otherLines = line.entry.lines.filter(l => l.id !== line.id);
            const category = otherLines[0]?.account.type || 'UNCATEGORIZED';

            if (amount > 0) {
                inflows.push({ date: line.entry.date, amount, category, ref: line.entry.number });
                netCashFlow += amount;
            } else if (amount < 0) {
                outflows.push({ date: line.entry.date, amount: Math.abs(amount), category, ref: line.entry.number });
                netCashFlow += amount;
            }
        }

        return { inflows, outflows, netCashFlow };
    }

    /**
     * Balance Sheet - Professional Hierarchical View
     */
    static async getBalanceSheet(companyId: string, endDate: Date) {
        // 1. Fetch all accounts related to the company/global BS (Asset, Liability, Equity)
        const allAccounts = await prisma.account.findMany({
            where: {
                OR: [{ companyId }, { companyId: null }],
                type: { in: [AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY] }
            },
            orderBy: { level: 'desc' } // Work from leaves upwards
        });

        // 2. Get transaction balances for all posting accounts
        const postingBalances = await prisma.journalLine.groupBy({
            by: ['accountId'],
            where: {
                OR: [
                    { account: { companyId } },
                    { account: { companyId: null } }
                ],
                entry: { date: { lte: endDate }, status: true }
            },
            _sum: { debit: true, credit: true }
        });

        // 3. Map to compute net balances for each account (including roll-ups)
        const accountBalances = new Map<string, number>();

        // Phase A: Identify individual posting balances
        for (const acc of allAccounts) {
            const b = postingBalances.find(item => item.accountId === acc.id);
            const debits = b?._sum.debit?.toNumber() || 0;
            const credits = b?._sum.credit?.toNumber() || 0;
            const opening = acc.openingBalance?.toNumber() || 0;
            // Net Debit = Opening(DR) + Debits - Credits
            const netDebit = (acc.openingBalanceType === 'DR' ? opening : -opening) + debits - credits;
            accountBalances.set(acc.id, netDebit);
        }

        // Phase B: Roll up balances to parents
        // Sort by level descending to ensure children are processed before parents
        const sortedForRollup = [...allAccounts].sort((a, b) => (b.level || 0) - (a.level || 0));
        for (const acc of sortedForRollup) {
            if (acc.parentId) {
                const childBalance = accountBalances.get(acc.id) || 0;
                const parentBalance = accountBalances.get(acc.parentId) || 0;
                accountBalances.set(acc.parentId, parentBalance + childBalance);
            }
        }

        // 4. Calculate Net Profit (Income - Expense) to date
        const plBalances = await prisma.journalLine.groupBy({
            by: ['accountId'],
            where: {
                OR: [
                    { account: { companyId, type: { in: [AccountType.INCOME, AccountType.EXPENSE] } } },
                    { account: { companyId: null, type: { in: [AccountType.INCOME, AccountType.EXPENSE] } } }
                ],
                entry: { date: { lte: endDate }, status: true }
            },
            _sum: { debit: true, credit: true }
        });
        const incomeExpenseAccounts = await prisma.account.findMany({
            where: {
                OR: [{ companyId }, { companyId: null }],
                type: { in: [AccountType.INCOME, AccountType.EXPENSE] }
            }
        });
        let currentPeriodProfit = 0;
        for (const b of plBalances) {
            const acc = incomeExpenseAccounts.find(a => a.id === b.accountId);
            if (!acc) continue;
            const net = (b._sum.debit?.toNumber() || 0) - (b._sum.credit?.toNumber() || 0);
            if (acc.type === AccountType.INCOME) currentPeriodProfit += (-net);
            else currentPeriodProfit -= net;
        }

        // --------------------------------------------------------------------------
        // CONDENSED REPORT CONSTRUCTION (Apple Inc. Style)
        // --------------------------------------------------------------------------
        const buildSection = (type: AccountType) => {
            // Get Groups (Level 1 Parents) e.g., Current Assets
            const groups = allAccounts
                .filter(a => a.type === type && a.level === 1)
                .sort((a, b) => a.code.localeCompare(b.code));

            const resultGroups: any[] = [];

            for (const group of groups) {
                const groupBalance = accountBalances.get(group.id) || 0;

                // Find L2 Children (Items) e.g. Cash, AR
                const items = allAccounts
                    .filter(a => a.parentId === group.id && a.type === type && a.level === 2)
                    .sort((a, b) => a.code.localeCompare(b.code))
                    .map(a => {
                        const bal = accountBalances.get(a.id) || 0;
                        return {
                            name: a.name,
                            code: a.code,
                            amount: (type === AccountType.ASSET) ? bal : -bal,
                            level: a.level
                        };
                    })
                    .filter(i => Math.abs(i.amount) > 0.001);

                // If group has children items, add as a group
                if (items.length > 0) {
                    resultGroups.push({
                        name: group.name,
                        items,
                        total: (type === AccountType.ASSET) ? groupBalance : -groupBalance
                    });
                }
            }

            return resultGroups;
        };

        const assetSection = buildSection(AccountType.ASSET);
        const liabilitySection = buildSection(AccountType.LIABILITY);

        // Equity is usually flat Level 1
        const equityItems = allAccounts
            .filter(a => a.type === AccountType.EQUITY && a.level === 1)
            .map(a => {
                const bal = accountBalances.get(a.id) || 0;
                return {
                    name: a.name,
                    code: a.code,
                    amount: -bal,
                    level: a.level
                };
            })
            .filter(i => Math.abs(i.amount) > 0.001);

        if (Math.abs(currentPeriodProfit) > 0.001) {
            equityItems.push({
                name: "Current Year Profit / (Loss)",
                code: "PL-CUR",
                amount: currentPeriodProfit,
                level: 1
            });
        }

        // Calculate Totals strictly from Level 1
        const totalAssets = allAccounts
            .filter(a => a.type === AccountType.ASSET && a.level === 1)
            .reduce((sum, a) => sum + (accountBalances.get(a.id) || 0), 0);

        const totalLiabilities = allAccounts
            .filter(a => a.type === AccountType.LIABILITY && a.level === 1)
            .reduce((sum, a) => sum + -(accountBalances.get(a.id) || 0), 0);

        const totalEquity = allAccounts
            .filter(a => a.type === AccountType.EQUITY && a.level === 1)
            .reduce((sum, a) => sum + -(accountBalances.get(a.id) || 0), 0) + currentPeriodProfit;

        return {
            assetSection,
            liabilitySection,
            equityItems,
            totalAssets,
            totalLiabilities,
            totalEquity
        };
    }

    /**
     * Aging Report
     */
    static async getAgingReport(companyId: string, accountType: AccountType, endDate: Date) {
        const accounts = await prisma.account.findMany({
            where: { companyId, type: accountType, isPosting: true }
        });

        const report: any[] = [];

        for (const acc of accounts) {
            const lines = await prisma.journalLine.findMany({
                where: {
                    accountId: acc.id,
                    account: { companyId },
                    entry: { date: { lte: endDate }, status: true }
                },
                include: { entry: true },
                orderBy: { entry: { date: 'asc' } }
            });

            const netBalance = lines.reduce((s, l) => s + (l.debit?.toNumber() || 0) - (l.credit?.toNumber() || 0), 0);
            if (Math.abs(netBalance) < 0.01) continue;

            let b0_30 = 0, b31_60 = 0, b61_90 = 0, b90_plus = 0;
            const now = endDate.getTime();
            for (const l of lines) {
                const diffDays = Math.floor((now - l.entry.date.getTime()) / (1000 * 60 * 60 * 24));
                const amount = (l.debit?.toNumber() || 0) - (l.credit?.toNumber() || 0);
                if (diffDays <= 30) b0_30 += amount;
                else if (diffDays <= 60) b31_60 += amount;
                else if (diffDays <= 90) b61_90 += amount;
                else b90_plus += amount;
            }

            report.push({
                accountName: acc.name,
                accountCode: acc.code,
                total: netBalance,
                buckets: { "0-30": b0_30, "31-60": b31_60, "61-90": b61_90, "90+": b90_plus }
            });
        }

        return report;
    }

    /**
     * Stock Summary
     */
    static async getStockSummary(companyId: string, warehouseId?: string, productId?: string, variantId?: string) {
        const where: any = {};
        if (warehouseId) where.warehouseId = warehouseId;
        if (productId) where.productId = productId;
        if (variantId) where.variantId = variantId;

        const summary = await prisma.stockLedger.groupBy({
            by: ['productId', 'warehouseId'],
            where,
            _sum: { qtyIn: true, qtyOut: true }
        });

        const products = await prisma.product.findMany();
        const warehouses = await prisma.warehouse.findMany();

        return summary.map(s => {
            const prod = products.find(p => p.id === s.productId);
            const wh = warehouses.find(w => w.id === s.warehouseId);
            const stock = (s._sum.qtyIn?.toNumber() || 0) - (s._sum.qtyOut?.toNumber() || 0);
            return {
                productName: prod?.name,
                productCode: prod?.code,
                warehouse: wh?.name,
                stock
            };
        });
    }

    /**
     * Item-wise Stock Report (Aggregated across warehouses)
     */
    static async getStockItemWise(companyId: string, warehouseId?: string, variantId?: string) {
        const where: any = {};
        if (warehouseId) where.warehouseId = warehouseId;
        if (variantId) where.variantId = variantId;

        const summary = await prisma.stockLedger.groupBy({
            by: ['productId', 'variantId'],
            where,
            _sum: { qtyIn: true, qtyOut: true }
        });

        const products = await prisma.product.findMany({
            include: { baseUnit: true, category: true, variants: true }
        });

        return summary.map(s => {
            const prod = products.find(p => p.id === s.productId);
            const variant = prod?.variants.find(v => v.id === s.variantId);
            const stock = (s._sum.qtyIn?.toNumber() || 0) - (s._sum.qtyOut?.toNumber() || 0);
            return {
                id: s.productId,
                variantId: s.variantId,
                productName: prod?.name,
                variantName: variant?.name || '-',
                productCode: variant?.sku || prod?.code,
                category: prod?.category?.name || '-',
                unit: prod?.baseUnit?.name || '-',
                stock
            };
        });
    }

    /**
     * Stock Ledger
     */
    static async getStockLedger(companyId: string, productId: string, warehouseId?: string | undefined, startDate?: Date, endDate?: Date, variantId?: string) {
        const where: any = { productId };
        if (warehouseId) where.warehouseId = warehouseId;
        if (variantId) where.variantId = variantId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.date = { gte: startDate }; // Changed from createdAt to date
            if (endDate) where.date = { lte: endDate };
        }

        const entries = await prisma.stockLedger.findMany({
            where,
            orderBy: { date: 'asc' }, // Changed from createdAt to date
            include: { product: true, warehouse: true }
        });

        // Collect Ref IDs for batch fetching
        const grnIds = entries.filter(e => e.refType === 'GRN').map(e => e.refId);
        const piIds = entries.filter(e => ['PURCHASE', 'INVOICE'].includes(e.refType)).map(e => e.refId);
        const siIds = entries.filter(e => ['SALE', 'SALES_INVOICE'].includes(e.refType)).map(e => e.refId);
        const returnIds = entries.filter(e => e.refType === 'RETURN').map(e => e.refId);
        const salesReturnIds = entries.filter(e => e.refType === 'SALES_RETURN').map(e => e.refId);

        // Fetch Metadata
        const grns = await prisma.gRN.findMany({
            where: { id: { in: grnIds } },
            select: { id: true, grnNo: true }
        });
        const purchaseInvoices = await prisma.purchaseInvoice.findMany({
            where: { id: { in: piIds } },
            select: { id: true, invoiceNo: true }
        });
        const salesInvoices = await prisma.salesInvoice.findMany({
            where: { id: { in: siIds } },
            select: { id: true, invoiceNo: true }
        });
        const purchaseReturns = await prisma.purchaseReturn.findMany({
            where: { id: { in: returnIds } },
            select: { id: true, returnNo: true }
        });
        const salesReturns = await prisma.salesReturn.findMany({
            where: { id: { in: salesReturnIds } },
            select: { id: true, returnNo: true }
        });

        let balance = 0;
        return entries.map(e => {
            const inward = e.qtyIn?.toNumber() || 0;
            const outward = e.qtyOut?.toNumber() || 0;
            balance += (inward - outward);

            let refNo = e.refId;
            if (e.refType === 'GRN') refNo = grns.find(g => g.id === e.refId)?.grnNo || e.refId;

            if (['PURCHASE', 'INVOICE'].includes(e.refType)) {
                refNo = purchaseInvoices.find(p => p.id === e.refId)?.invoiceNo || e.refId;
            }

            if (e.refType === 'RETURN') {
                refNo = purchaseReturns.find(r => r.id === e.refId)?.returnNo || e.refId;
            }

            if (['SALE', 'SALES_INVOICE'].includes(e.refType)) {
                refNo = salesInvoices.find(s => s.id === e.refId)?.invoiceNo || e.refId;
            }

            if (e.refType === 'SALES_RETURN') {
                refNo = salesReturns.find(s => s.id === e.refId)?.returnNo || e.refId;
            }

            return {
                ...e,
                refNo,
                balance
            };
        });
    }

    /**
     * Dashboard Statistics
     */
    static async getDashboardStats(companyId: string) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const sales = await prisma.journalLine.aggregate({
            where: {
                account: { type: AccountType.INCOME, companyId },
                entry: { date: { gte: startOfMonth }, status: true }
            },
            _sum: { credit: true }
        });

        const receivables = await prisma.journalLine.aggregate({
            where: {
                account: { name: { contains: 'Receivable' }, companyId },
                entry: { status: true }
            },
            _sum: { debit: true, credit: true }
        });

        const stock = await prisma.stockLedger.groupBy({
            by: ['productId'],
            where: { companyId }, // Fixed: Added companyId filter
            _sum: { qtyIn: true, qtyOut: true }
        });

        return {
            monthlySales: sales._sum.credit?.toNumber() || 0,
            totalReceivables: (receivables._sum.debit?.toNumber() || 0) - (receivables._sum.credit?.toNumber() || 0),
            totalStockItems: stock.length,
            netProfit: 0 // Placeholder, requires P&L calculation
        };
    }

    /**
     * Super Admin Dashboard Stats (Global)
     */
    static async getSuperAdminStats() {
        // 1. Total Companies
        const companiesCount = await prisma.company.count({ where: { deletedAt: null } });

        // 2. Total Users
        const usersCount = await prisma.user.count();

        // 3. Global Revenue (This Month)
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const globalSales = await prisma.journalLine.aggregate({
            where: {
                account: { type: AccountType.INCOME },
                entry: { date: { gte: startOfMonth }, status: true }
            },
            _sum: { credit: true }
        });

        // 4. Companies created this month
        const newCompanies = await prisma.company.count({
            where: { createdAt: { gte: startOfMonth } }
        });

        return {
            totalCompanies: companiesCount,
            totalUsers: usersCount,
            globalMonthlyRevenue: globalSales._sum.credit?.toNumber() || 0,
            newCompaniesThisMonth: newCompanies
        };
    }

    /**
     * Role-Based Stats
     */
    static async getRoleBasedStats(companyId: string, role: string) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        if (role === 'SALES') {
            const mySales = await prisma.salesInvoice.aggregate({
                where: { companyId, date: { gte: startOfMonth } },
                _sum: { totalAmount: true },
                _count: { id: true }
            });
            const pendingOrders = await prisma.salesOrder.count({
                where: { companyId, status: 'PENDING' }
            });
            return {
                monthlySales: mySales._sum.totalAmount?.toNumber() || 0,
                invoiceCount: mySales._count.id,
                pendingOrders
            };
        }

        if (role === 'PURCHASE') {
            const monthPurchases = await prisma.purchaseInvoice.aggregate({
                where: { companyId, date: { gte: startOfMonth } },
                _sum: { totalAmount: true }
            });
            const pendingPO = await prisma.purchaseOrder.count({
                where: { companyId, status: 'PENDING' }
            });
            return {
                monthlyPurchases: monthPurchases._sum.totalAmount?.toNumber() || 0,
                pendingPO
            };
        }

        if (role === 'WAREHOUSE') {
            const lowStock = await prisma.product.count({
                where: {
                    companyId,
                    // simplified low stock check, ideally needs stock ledger calculation
                }
            });
            return {
                lowStockItems: 0,
                pendingDelivery: await prisma.salesOrder.count({ where: { companyId, status: { in: ['APPROVED', 'PENDING'] } } }),
                pendingGRN: await prisma.purchaseOrder.count({ where: { companyId, status: { in: ['APPROVED', 'PENDING'] } } })
            };
        }

        return {};
    }

    /**
     * Tax Summary
     */
    static async getTaxSummary(companyId: string, startDate: Date, endDate: Date) {
        const taxes = await prisma.journalLine.groupBy({
            by: ['accountId'],
            where: {
                account: { name: { contains: 'Tax' }, companyId },
                entry: { date: { gte: startDate, lte: endDate }, status: true }
            },
            _sum: { debit: true, credit: true }
        });

        const accounts = await prisma.account.findMany({ where: { companyId } });

        return taxes.map(t => {
            const acc = accounts.find(a => a.id === t.accountId);
            const net = (t._sum.credit?.toNumber() || 0) - (t._sum.debit?.toNumber() || 0);
            return {
                name: acc?.name,
                code: acc?.code,
                netTax: net
            };
        });
    }

    /**
     * Voucher Register
     */
    static async getVoucherRegister(companyId: string, type: string, startDate: Date, endDate: Date) {
        const where: any = {
            lines: { some: { account: { companyId } } },
            date: { gte: startDate, lte: endDate },
            status: true
        };
        if (type !== 'ALL') {
            where.type = type;
        }

        return await prisma.journalEntry.findMany({
            where,
            include: {
                lines: { include: { account: true } }
            },
            orderBy: { date: 'asc' }
        });
    }

    /**
     * Trading Account (Gross Profit)
     */
    static async getTradingAccount(companyId: string, startDate: Date, endDate: Date) {
        // 1. Opening Stock (Value at startDate)
        const calculateStockValue = async (date: Date) => {
            const entries = await prisma.stockLedger.findMany({
                where: {
                    date: { lt: date }
                }
            });

            const stockMap = new Map<string, { qty: number, value: number }>();

            for (const entry of entries) {
                const key = `${entry.productId}-${entry.variantId || 'null'}`;
                const curr = stockMap.get(key) || { qty: 0, value: 0 };

                const qtyIn = entry.qtyIn?.toNumber() || 0;
                const qtyOut = entry.qtyOut?.toNumber() || 0;
                const rate = entry.costRate?.toNumber() || 0;

                curr.value += (qtyIn * rate) - (qtyOut * rate);
                curr.qty += (qtyIn - qtyOut);
                stockMap.set(key, curr);
            }

            let totalValue = 0;
            for (const val of stockMap.values()) {
                totalValue += val.value;
            }
            return totalValue;
        };

        const openingStock = await calculateStockValue(startDate);
        const closingStock = await calculateStockValue(endDate);

        // 2. Purchases (Direct Expenses)
        const expenseAccounts = await prisma.account.findMany({
            where: {
                companyId,
                type: AccountType.EXPENSE,
                isPosting: true
            }
        });

        const directExpenseAccounts = expenseAccounts.filter(a =>
            a.name.toLowerCase().includes('purchase') ||
            a.name.toLowerCase().includes('cost of goods') ||
            a.name.toLowerCase().includes('cogs') ||
            a.name.toLowerCase().includes('freight') ||
            a.name.toLowerCase().includes('wages') ||
            a.name.toLowerCase().includes('custom')
        );
        const directAccountIds = directExpenseAccounts.map(a => a.id);

        const purchaseLines = await prisma.journalLine.aggregate({
            where: {
                accountId: { in: directAccountIds },
                entry: { date: { gte: startDate, lte: endDate }, status: true }
            },
            _sum: { debit: true, credit: true }
        });

        const purchasesTotal = (purchaseLines._sum.debit?.toNumber() || 0) - (purchaseLines._sum.credit?.toNumber() || 0);

        // 3. Sales (Revenue)
        const incomeAccounts = await prisma.account.findMany({
            where: { companyId, type: AccountType.INCOME, isPosting: true }
        });
        const incomeAccountIds = incomeAccounts.map(a => a.id);

        const salesLines = await prisma.journalLine.aggregate({
            where: {
                accountId: { in: incomeAccountIds },
                entry: { date: { gte: startDate, lte: endDate }, status: true }
            },
            _sum: { debit: true, credit: true }
        });

        const salesTotal = (salesLines._sum.credit?.toNumber() || 0) - (salesLines._sum.debit?.toNumber() || 0);

        // 4. Structure Result
        const debitSide = [
            { name: "Opening Stock", amount: openingStock },
            { name: "Purchases & Direct Expenses", amount: purchasesTotal }
        ];

        const creditSide = [
            { name: "Sales / Revenue", amount: salesTotal },
            { name: "Closing Stock", amount: closingStock }
        ];

        const totalDebits = openingStock + purchasesTotal;
        const totalCredits = salesTotal + closingStock;
        const grossProfit = totalCredits - totalDebits;

        return {
            debitSide,
            creditSide,
            totalDebits,
            totalCredits,
            grossProfit
        };
    }

    static async getConsolidatedTrialBalance(endDate: Date) {
        // 1. Fetch all active companies
        const companies = await prisma.company.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });

        // 2. Fetch TB for each company
        const consolidatedMap = new Map<string, {
            code: string,
            name: string,
            type: string,
            companies: Record<string, number>,
            totalDebit: number,
            totalCredit: number
        }>();

        for (const company of companies) {
            const tb = await this.getTrialBalance(company.id, endDate);
            for (const line of tb) {
                const key = line.accountCode;
                const existing = consolidatedMap.get(key) || {
                    code: line.accountCode,
                    name: line.accountName,
                    type: line.type,
                    companies: {},
                    totalDebit: 0,
                    totalCredit: 0
                };

                existing.companies[company.id] = line.debit - line.credit; // Net val
                existing.totalDebit += line.debit;
                existing.totalCredit += line.credit;

                consolidatedMap.set(key, existing);
            }
        }

        // 3. Format Result
        const report = Array.from(consolidatedMap.values()).sort((a, b) => a.code.localeCompare(b.code));

        return {
            companies,
            report
        };
    }

    /**
     * Helper to merge hierarchical reports
     */
    private static mergeTrees(
        baseNodes: any[],
        newNodes: any[],
        companyId: string,
        mergedFn: (node: any, amount: number, companyId: string) => void
    ) {
        // Flatten newNodes for easier lookup
        const flatten = (nodes: any[]): any[] => {
            let res: any[] = [];
            for (const n of nodes) {
                res.push(n);
                if (n.children) res = res.concat(flatten(n.children));
                if (n.items) res = res.concat(flatten(n.items)); // For BS structure
            }
            return res;
        };
        const flatNew = flatten(newNodes);

        // Recursive merge into baseNodes
        // Actually, better to rebuild the tree from a Map of all codes
        return; // This approach is too complex for simple merge.
    }

    // SIMPLIFIED APPROACH:
    // We already have generic "Get Report for Company"
    // We will return a structure that mimics the single report but amounts are objects { [compId]: val, total: val }
    // To do this, we'll collect all nodes from all companies into a Map<Code, Node>
    // Then reconstruct the tree.

    static async getConsolidatedProfitLoss(startDate: Date, endDate: Date) {
        const companies = await prisma.company.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });

        // Map<Code, { name, level, isPosting, type, amounts: {}, total: 0 }>
        const accountMap = new Map<string, any>();

        // We need to fetch flat structures to build the map easily.
        // Re-using getProfitLoss internal logic would be best but it's private.
        // We'll call getProfitLoss and flatten the result.

        const flattenTree = (nodes: any[], type: string) => {
            let res: any[] = [];
            for (const node of nodes) {
                res.push({ ...node, reportType: type });
                if (node.children) res = res.concat(flattenTree(node.children, type));
            }
            return res;
        };

        for (const company of companies) {
            const pl = await this.getProfitLoss(company.id, startDate, endDate);
            const flatIncome = flattenTree(pl.income, 'INCOME');
            const flatExpense = flattenTree(pl.expense, 'EXPENSE');

            [...flatIncome, ...flatExpense].forEach(item => {
                const key = item.code;
                const existing = accountMap.get(key) || {
                    code: item.code,
                    name: item.name,
                    level: item.level,
                    isPosting: item.isPosting,
                    reportType: item.reportType,
                    companies: {},
                    total: 0
                };

                existing.companies[company.id] = item.amount;
                existing.total += item.amount;
                accountMap.set(key, existing);
            });
        }

        // Rebuild Trees
        const buildTree = (type: string) => {
            const nodes = Array.from(accountMap.values())
                .filter(n => n.reportType === type)
                .sort((a, b) => a.code.localeCompare(b.code));

            // Basic hierarchy reconstruction based on levels
            // Assuming strict COA structure where parent code is prefix? Or just using levels.
            // Since we don't have parentId here easily, we rely on the fact that getProfitLoss returned a tree.
            // But we flattened it.
            // To reconstruct, we need parent linkage. 
            // The simpliest way for Consolidated View is FLATTENED LIST with indentation (level).
            // Frontend can render it.
            return nodes;
        };

        return {
            companies,
            income: buildTree('INCOME'),
            expense: buildTree('EXPENSE')
        };
    }

    static async getConsolidatedBalanceSheet(endDate: Date) {
        const companies = await prisma.company.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });

        const accountMap = new Map<string, any>();

        const flattenBS = (section: any[], type: string) => {
            let res: any[] = [];
            for (const group of section) {
                // Groups in BS (Level 1)
                res.push({ code: group.code, name: group.name, amount: group.total || group.amount, level: 1, type }); // Group Header
                if (group.items) {
                    for (const item of group.items) {
                        res.push({ ...item, level: 2, type });
                    }
                }
            }
            return res;
        };

        for (const company of companies) {
            const bs = await this.getBalanceSheet(company.id, endDate);

            // Assets
            const assets = flattenBS(bs.assetSection, 'ASSET');
            // Liabilities
            const liabilities = flattenBS(bs.liabilitySection, 'LIABILITY');
            // Equity
            const equity = bs.equityItems.map((i: any) => ({ ...i, type: 'EQUITY' }));

            [...assets, ...liabilities, ...equity].forEach(item => {
                if (!item.code) return; // Skip if no code (e.g. profit line might need handling)
                const key = item.code;
                const existing = accountMap.get(key) || {
                    code: item.code,
                    name: item.name,
                    level: item.level,
                    type: item.type,
                    companies: {},
                    total: 0
                };

                existing.companies[company.id] = item.amount;
                existing.total += item.amount;
                accountMap.set(key, existing);
            });
        }

        const buildList = (type: string) => {
            return Array.from(accountMap.values())
                .filter(n => n.type === type)
                .sort((a, b) => a.code.localeCompare(b.code));
        }

        return {
            companies,
            assets: buildList('ASSET'),
            liabilities: buildList('LIABILITY'),
            equity: buildList('EQUITY')
        };
    }
}
