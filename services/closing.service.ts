import prisma from "@/lib/prisma";
import { AccountType, FinancialYear, VoucherType } from '@prisma/client';
import { JournalService } from "./journal.service";
import { FinancialYearService } from "./financial-year.service";

export class ClosingService {
    /**
     * Closes a financial year and generates closing JVs (scoped to company)
     */
    static async performYearClosing(companyId: string, yearId: string, closingDate: Date, pnlAccountId: string, retainedEarningsAccountId: string) {
        return await prisma.$transaction(async (tx) => {
            const year = await tx.financialYear.findUnique({ where: { id: yearId } });
            if (!year || !year.isOpen) {
                throw new Error("Year not found or already closed.");
            }

            // 1. Fetch all balances for the year
            const balances = await tx.journalLine.groupBy({
                by: ['accountId'],
                where: {
                    entry: {
                        financialYearId: yearId,
                        status: true
                    }
                },
                _sum: {
                    debit: true,
                    credit: true
                }
            });

            const incomeLines: any[] = [];
            const expenseLines: any[] = [];
            let totalIncomeNet = 0;
            let totalExpenseNet = 0;

            for (const bal of balances) {
                const account = await tx.account.findUnique({ where: { id: bal.accountId } });
                if (!account) continue;

                const netBalance = (bal._sum.debit?.toNumber() || 0) - (bal._sum.credit?.toNumber() || 0);
                if (netBalance === 0) continue;

                if (account.type === AccountType.INCOME) {
                    incomeLines.push({
                        accountId: account.id,
                        debit: netBalance < 0 ? Math.abs(netBalance) : 0,
                        credit: netBalance > 0 ? netBalance : 0,
                        narration: `Closing ${account.name} to P&L`
                    });
                    totalIncomeNet += netBalance;
                } else if (account.type === AccountType.EXPENSE) {
                    expenseLines.push({
                        accountId: account.id,
                        debit: netBalance < 0 ? Math.abs(netBalance) : 0,
                        credit: netBalance > 0 ? netBalance : 0,
                        narration: `Closing ${account.name} to P&L`
                    });
                    totalExpenseNet += netBalance;
                }
            }

            // 2. Generate Income -> P&L Closing JV
            if (incomeLines.length > 0) {
                const incomeNet = incomeLines.reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0);

                await JournalService.createEntry({
                    companyId,
                    date: closingDate,
                    type: VoucherType.CLOSING,
                    narration: `Year End Closing: Income to P&L (${year.name})`,
                    lines: [
                        ...incomeLines,
                        { accountId: pnlAccountId, credit: incomeNet > 0 ? incomeNet : 0, debit: incomeNet < 0 ? Math.abs(incomeNet) : 0 }
                    ]
                }, tx);
            }

            // 3. Generate Expense -> P&L Closing JV
            if (expenseLines.length > 0) {
                const expenseNet = expenseLines.reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0);

                await JournalService.createEntry({
                    companyId,
                    date: closingDate,
                    type: VoucherType.CLOSING,
                    narration: `Year End Closing: Expense to P&L (${year.name})`,
                    lines: [
                        ...expenseLines,
                        { accountId: pnlAccountId, credit: expenseNet > 0 ? expenseNet : 0, debit: expenseNet < 0 ? Math.abs(expenseNet) : 0 }
                    ]
                }, tx);
            }

            // 4. P&L -> Retained Earnings
            const netProfit = (Math.abs(totalIncomeNet) - totalExpenseNet);

            const pnlBalance = await tx.journalLine.aggregate({
                where: { accountId: pnlAccountId, entry: { financialYearId: yearId } },
                _sum: { debit: true, credit: true }
            });
            const pnlNet = (pnlBalance._sum.debit?.toNumber() || 0) - (pnlBalance._sum.credit?.toNumber() || 0);

            if (pnlNet !== 0) {
                await JournalService.createEntry({
                    companyId,
                    date: closingDate,
                    type: VoucherType.CLOSING,
                    narration: `Year End Closing: P&L to Retained Earnings (${year.name})`,
                    lines: [
                        { accountId: pnlAccountId, debit: pnlNet < 0 ? Math.abs(pnlNet) : 0, credit: pnlNet > 0 ? pnlNet : 0 },
                        { accountId: retainedEarningsAccountId, credit: pnlNet < 0 ? Math.abs(pnlNet) : 0, debit: pnlNet > 0 ? pnlNet : 0 }
                    ]
                }, tx);
            }

            // 5. Lock Year
            await tx.financialYear.update({
                where: { id: yearId },
                data: { isOpen: false, lockedAt: new Date() }
            });

            return { success: true, yearClosed: year.name, netProfit };
        });
    }

    /**
     * Carry forward balances to a new financial year (scoped to company)
     */
    static async carryForwardBalances(companyId: string, oldYearId: string, newYearId: string, openingDate: Date) {
        return await prisma.$transaction(async (tx) => {
            const balances = await tx.journalLine.groupBy({
                by: ['accountId'],
                where: {
                    entry: {
                        financialYearId: oldYearId,
                        status: true
                    }
                },
                _sum: {
                    debit: true,
                    credit: true
                }
            });

            const openingLines: any[] = [];

            for (const bal of balances) {
                const account = await tx.account.findUnique({ where: { id: bal.accountId } });
                if (!account) continue;

                const bsTypes: string[] = [AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY];
                if (bsTypes.includes(account.type)) {
                    const netBalance = (bal._sum.debit?.toNumber() || 0) - (bal._sum.credit?.toNumber() || 0);
                    if (Math.abs(netBalance) < 0.01) continue;

                    openingLines.push({
                        accountId: account.id,
                        debit: netBalance > 0 ? netBalance : 0,
                        credit: netBalance < 0 ? Math.abs(netBalance) : 0,
                        narration: `Opening Balance from ${oldYearId}`
                    });
                }
            }

            if (openingLines.length > 0) {
                const totalDebit = openingLines.reduce((s, l) => s + (l.debit || 0), 0);
                const totalCredit = openingLines.reduce((s, l) => s + (l.credit || 0), 0);

                if (Math.abs(totalDebit - totalCredit) > 0.01) {
                    throw new Error(`Trial Balance not zero! DR: ${totalDebit}, CR: ${totalCredit}, Diff: ${totalDebit - totalCredit}. Cannot carry forward.`);
                }

                return await JournalService.createEntry({
                    companyId,
                    date: openingDate,
                    type: VoucherType.OPENING,
                    narration: "Auto-Opening Balances from Previous Year",
                    lines: openingLines
                }, tx);
            }

            return null;
        });
    }
}
