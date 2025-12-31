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
