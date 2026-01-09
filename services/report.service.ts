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
    static async getProfitLoss(companyId: string, startDate: Date, endDate: Date) {
        const balances = await prisma.journalLine.groupBy({
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

        const accounts = await prisma.account.findMany({
            where: {
                OR: [{ companyId }, { companyId: null }],
                type: { in: [AccountType.INCOME, AccountType.EXPENSE] }
            }
        });

        const incomeLines: any[] = [];
        const expenseLines: any[] = [];
        let totalIncome = 0;
        let totalExpense = 0;

        for (const b of balances) {
            const acc = accounts.find(a => a.id === b.accountId);
            if (!acc) continue;

            const net = (b._sum.debit?.toNumber() || 0) - (b._sum.credit?.toNumber() || 0);

            if (acc.type === AccountType.INCOME) {
                const val = Math.abs(net);
                incomeLines.push({ name: acc.name, code: acc.code, amount: val });
                totalIncome += val;
            } else {
                expenseLines.push({ name: acc.name, code: acc.code, amount: net });
                totalExpense += net;
            }
        }

        return {
            income: incomeLines,
            expense: expenseLines,
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
    static async getStockSummary(companyId: string, warehouseId?: string) {
        const where: any = {};
        if (warehouseId) where.warehouseId = warehouseId;

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
     * Stock Ledger
     */
    /**
     * Item-wise Stock Report (Aggregated across warehouses)
     */
    static async getStockItemWise(companyId: string) {
        const summary = await prisma.stockLedger.groupBy({
            by: ['productId'],
            _sum: { qtyIn: true, qtyOut: true }
        });

        const products = await prisma.product.findMany({
            include: { baseUnit: true, category: true }
        });

        return summary.map(s => {
            const prod = products.find(p => p.id === s.productId);
            const stock = (s._sum.qtyIn?.toNumber() || 0) - (s._sum.qtyOut?.toNumber() || 0);
            return {
                id: s.productId,
                productName: prod?.name,
                productCode: prod?.code,
                category: prod?.category?.name || '-',
                unit: prod?.baseUnit?.name || '-',
                stock
            };
        });
    }

    /**
     * Stock Ledger
     */
    static async getStockLedger(companyId: string, productId: string, warehouseId?: string | undefined, startDate?: Date, endDate?: Date) {
        const where: any = { productId };
        if (warehouseId) where.warehouseId = warehouseId;
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

        let balance = 0;
        return entries.map(e => {
            const inward = e.qtyIn?.toNumber() || 0;
            const outward = e.qtyOut?.toNumber() || 0;
            balance += (inward - outward);
            return {
                ...e,
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
            _sum: { qtyIn: true, qtyOut: true }
        });

        return {
            monthlySales: sales._sum.credit?.toNumber() || 0,
            totalReceivables: (receivables._sum.debit?.toNumber() || 0) - (receivables._sum.credit?.toNumber() || 0),
            totalStockItems: stock.length
        };
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
}
