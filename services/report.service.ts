import prisma from "@/lib/prisma";
import { Prisma, AccountType } from "@/app/generated/prisma/client";

export class ReportService {
    /**
     * Ledger Report for a specific account
     */
    static async getLedger(companyId: string, accountId: string, startDate: Date, endDate: Date) {
        // 1. Get Opening Balance (sum of all before startDate)
        const opening = await prisma.journalLine.aggregate({
            where: {
                accountId,
                account: { companyId },
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
                account: { companyId },
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
    static async getTrialBalance(companyId: string, endDate: Date) {
        const balances = await prisma.journalLine.groupBy({
            by: ['accountId'],
            where: {
                account: { companyId },
                entry: {
                    date: { lte: endDate },
                    status: true
                }
            },
            _sum: { debit: true, credit: true }
        });

        const accounts = await prisma.account.findMany({ where: { companyId } });

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
                account: { companyId },
                entry: {
                    date: { gte: startDate, lte: endDate },
                    status: true
                }
            },
            _sum: { debit: true, credit: true }
        });

        const accounts = await prisma.account.findMany({
            where: { companyId, type: { in: [AccountType.INCOME, AccountType.EXPENSE] } }
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
     * Balance Sheet
     */
    static async getBalanceSheet(companyId: string, endDate: Date) {
        const balances = await prisma.journalLine.groupBy({
            by: ['accountId'],
            where: {
                account: { companyId },
                entry: {
                    date: { lte: endDate },
                    status: true
                }
            },
            _sum: { debit: true, credit: true }
        });

        const accounts = await prisma.account.findMany({
            where: { companyId, type: { in: [AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY] } }
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
        // Since Product/Warehouse/StockLedger are currently global, we filter by linked account where possible, 
        // but for now we'll just filter Products that are associated with the company's accounts if possible.
        // Actually, in the current schema, Product is global. We will return all products but only for the relevant warehouse.
        const where: any = {};
        if (warehouseId) where.warehouseId = warehouseId;

        const summary = await prisma.stockLedger.groupBy({
            by: ['productId', 'warehouseId'],
            where,
            _sum: { qtyIn: true, qtyOut: true }
        });

        // Optimization: only find products involved in these ledger entries
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
    static async getStockLedger(companyId: string, productId: string, warehouseId?: string | undefined, startDate?: Date, endDate?: Date) {
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
