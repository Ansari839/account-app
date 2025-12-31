import prisma from "@/lib/prisma";
import { Prisma, AccountType } from "@/app/generated/prisma/client";

export class ReportService {
    /**
     * Ledger Report for a specific account
     */
    static async getLedger(accountId: string, startDate: Date, endDate: Date) {
        // 1. Get Opening Balance (sum of all before startDate)
        const opening = await prisma.journalLine.aggregate({
            where: {
                accountId,
                entry: {
                    date: { lt: startDate },
                    status: true
                }
            },
            _sum: { debit: true, credit: true }
        });

        const openingBalance = (opening._sum.debit?.toNumber() || 0) - (opening._sum.credit?.toNumber() || 0);

        // 2. Get Transactions
        const transactions = await prisma.journalLine.findMany({
            where: {
                accountId,
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
     * Trial Balance
     */
    static async getTrialBalance(endDate: Date) {
        const balances = await prisma.journalLine.groupBy({
            by: ['accountId'],
            where: {
                entry: {
                    date: { lte: endDate },
                    status: true
                }
            },
            _sum: { debit: true, credit: true }
        });

        const accounts = await prisma.account.findMany();

        const report = balances.map(b => {
            const acc = accounts.find(a => a.id === b.accountId);
            const net = (b._sum.debit?.toNumber() || 0) - (b._sum.credit?.toNumber() || 0);
            return {
                accountCode: acc?.code,
                accountName: acc?.name,
                type: acc?.type,
                debit: net > 0 ? net : 0,
                credit: net < 0 ? Math.abs(net) : 0
            };
        }).filter(r => r.debit !== 0 || r.credit !== 0);

        return report;
    }

    /**
     * Day Book
     */
    static async getDayBook(date: Date) {
        return await prisma.journalEntry.findMany({
            where: {
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
    static async getProfitLoss(startDate: Date, endDate: Date) {
        const balances = await prisma.journalLine.groupBy({
            by: ['accountId'],
            where: {
                entry: {
                    date: { gte: startDate, lte: endDate },
                    status: true
                }
            },
            _sum: { debit: true, credit: true }
        });

        const accounts = await prisma.account.findMany({
            where: { type: { in: [AccountType.INCOME, AccountType.EXPENSE] } }
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
                // Income normally CR. net = DR - CR. So net -500 is 500 Income.
                const val = Math.abs(net);
                incomeLines.push({ name: acc.name, code: acc.code, amount: val });
                totalIncome += val;
            } else {
                // Expense normally DR. net = DR - CR.
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
     * Cash Flow Statement (Simplified Direct Method)
     */
    static async getCashFlow(startDate: Date, endDate: Date) {
        // Find Cash/Bank Accounts
        const cashAccounts = await prisma.account.findMany({
            where: {
                OR: [
                    { name: { contains: 'Cash' } },
                    { name: { contains: 'Bank' } }
                ],
                isPosting: true
            }
        });

        const cashAccountIds = cashAccounts.map(a => a.id);

        // Fetch all lines for these accounts in the date range
        const lines = await prisma.journalLine.findMany({
            where: {
                accountId: { in: cashAccountIds },
                entry: { date: { gte: startDate, lte: endDate }, status: true }
            },
            include: { entry: { include: { lines: { include: { account: true } } } } }
        });

        const inflows: any[] = [];
        const outflows: any[] = [];
        let netCashFlow = 0;

        for (const line of lines) {
            const amount = (line.debit?.toNumber() || 0) - (line.credit?.toNumber() || 0);

            // Find the "other" side of the transaction to categorize
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

        return {
            inflows,
            outflows,
            netCashFlow
        };
    }

    /**
     * Balance Sheet
     */
    static async getBalanceSheet(endDate: Date) {
        const balances = await prisma.journalLine.groupBy({
            by: ['accountId'],
            where: {
                entry: {
                    date: { lte: endDate },
                    status: true
                }
            },
            _sum: { debit: true, credit: true }
        });

        const accounts = await prisma.account.findMany({
            where: { type: { in: [AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY] } }
        });

        const assets: any[] = [];
        const liabilities: any[] = [];
        const equity: any[] = [];

        for (const b of balances) {
            const acc = accounts.find(a => a.id === b.accountId);
            if (!acc) continue;

            const net = (b._sum.debit?.toNumber() || 0) - (b._sum.credit?.toNumber() || 0);

            if (acc.type === AccountType.ASSET) {
                assets.push({ name: acc.name, code: acc.code, amount: net });
            } else if (acc.type === AccountType.LIABILITY) {
                liabilities.push({ name: acc.name, code: acc.code, amount: Math.abs(net) });
            } else if (acc.type === AccountType.EQUITY) {
                equity.push({ name: acc.name, code: acc.code, amount: Math.abs(net) });
            }
        }

        return {
            assets,
            liabilities,
            equity,
            totalAssets: assets.reduce((s, a) => s + a.amount, 0),
            totalLiabilities: liabilities.reduce((s, l) => s + l.amount, 0),
            totalEquity: equity.reduce((s, e) => s + e.amount, 0)
        };
    }

    /**
     * Aging Report (AR/AP)
     */
    static async getAgingReport(accountType: AccountType, endDate: Date) {
        // Find all posting accounts of the given type (Asset for AR, Liability for AP)
        const accounts = await prisma.account.findMany({
            where: { type: accountType, isPosting: true }
        });

        const report: any[] = [];

        for (const acc of accounts) {
            // Fetch all lines for this account up to endDate
            const lines = await prisma.journalLine.findMany({
                where: {
                    accountId: acc.id,
                    entry: { date: { lte: endDate }, status: true }
                },
                include: { entry: true },
                orderBy: { entry: { date: 'asc' } }
            });

            const netBalance = lines.reduce((s, l) => s + (l.debit?.toNumber() || 0) - (l.credit?.toNumber() || 0), 0);
            if (Math.abs(netBalance) < 0.01) continue;

            // Buckets: 0-30, 31-60, 61-90, 90+
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
     * Stock Summary (Warehouse-wise)
     */
    static async getStockSummary(warehouseId?: string) {
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
     * Stock Ledger (Per Item)
     */
    static async getStockLedger(productId: string, warehouseId?: string, startDate?: Date, endDate?: Date) {
        const where: any = { productId };
        if (warehouseId) where.warehouseId = warehouseId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startDate;
            if (endDate) where.createdAt.lte = endDate;
        }

        return await prisma.stockLedger.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            include: { product: true, warehouse: true }
        });
    }

    /**
     * Dashboard Statistics
     */
    static async getDashboardStats() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // 1. Sales this month
        const sales = await prisma.journalLine.aggregate({
            where: {
                account: { type: AccountType.INCOME },
                entry: { date: { gte: startOfMonth }, status: true }
            },
            _sum: { credit: true }
        });

        // 2. Receivables (Asset type and usually Debit)
        const receivables = await prisma.journalLine.aggregate({
            where: {
                account: { name: { contains: 'Receivable' } },
                entry: { status: true }
            },
            _sum: { debit: true, credit: true }
        });

        // 3. Inventory Value (Simplified)
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
    static async getTaxSummary(startDate: Date, endDate: Date) {
        const taxes = await prisma.journalLine.groupBy({
            by: ['accountId'],
            where: {
                account: { name: { contains: 'Tax' } },
                entry: { date: { gte: startDate, lte: endDate }, status: true }
            },
            _sum: { debit: true, credit: true }
        });

        const accounts = await prisma.account.findMany();

        return taxes.map(t => {
            const acc = accounts.find(a => a.id === t.accountId);
            const net = (t._sum.credit?.toNumber() || 0) - (t._sum.debit?.toNumber() || 0); // Tax usually CR (payable)
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
    static async getVoucherRegister(type: string, startDate: Date, endDate: Date) {
        const where: any = {
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
