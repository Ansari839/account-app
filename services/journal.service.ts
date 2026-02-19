import prisma from "@/lib/prisma";
import { VoucherType, Prisma } from "@prisma/client";
import { VoucherService } from "./voucher.service";
import { FinancialYearService } from "./financial-year.service";
import { AccountingControlService } from "./accountingControl.service";
import { ABACService } from "./abac.service";
import { AuditService } from "./audit.service";

export interface JournalLineInput {
    accountId: string;
    debit?: number;
    credit?: number;
    narration?: string;
}

export interface JournalEntryInput {
    id?: string;
    userId?: string;
    companyId: string;
    number?: string;
    date: Date;
    type: VoucherType;
    reference?: string;
    narration?: string;
    lines: JournalLineInput[];
}

export class JournalService {
    /**
     * Creates a balanced Journal Entry (scoped to company)
     */
    static async createEntry(data: JournalEntryInput, tx?: Prisma.TransactionClient) {
        const client = tx || prisma;
        const { companyId } = data;

        // 1. Accounting Controls
        await AccountingControlService.validateTransaction(companyId, data.date, data.id);

        // 2. ABAC: Value Limits
        if (data.userId) {
            const totalVal = data.lines.reduce((s, l) => s + (l.debit || 0), 0);
            const hasAccess = await ABACService.checkLimit(data.userId, "JOURNAL", totalVal);
            if (!hasAccess) {
                throw new Error(`Transaction amount ${totalVal} exceeds your authorized limit.`);
            }
        }

        // 3. Validation: Balance Check
        const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
        const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Journal Entry must be balanced. Total Debit (${totalDebit.toFixed(2)}) != Total Credit (${totalCredit.toFixed(2)})`);
        }

        if (data.lines.length < 2) {
            throw new Error("Journal Entry must have at least two lines.");
        }

        if (data.lines.some(l => (l.debit || 0) <= 0 && (l.credit || 0) <= 0)) {
            throw new Error("All journal lines must have a value greater than 0.");
        }

        // 4. Financial Year Handling
        const activeYear = await FinancialYearService.getActiveYear(companyId, data.date);

        if (!activeYear) {
            throw new Error(`No Active Financial Year found for date ${data.date}. Please open a Financial Year in Settings.`);
        }

        if (!activeYear.isOpen) {
            throw new Error(`Financial Year ${activeYear.name} is closed. Cannot post transaction.`);
        }

        // 5. Voucher Number Handling
        let voucherNo = data.number;

        const execute = async (txClient: Prisma.TransactionClient) => {
            if (!voucherNo) {
                voucherNo = await VoucherService.generateNumber(companyId, data.type, txClient);
            } else {
                await VoucherService.validateNumber(companyId, voucherNo, txClient);
            }

            const entry = await txClient.journalEntry.create({
                data: {
                    companyId,
                    number: voucherNo,
                    date: data.date,
                    type: data.type,
                    reference: data.reference,
                    narration: data.narration,
                    financialYearId: activeYear.id,
                    lines: {
                        create: data.lines.map(line => ({
                            accountId: line.accountId,
                            debit: line.debit || 0,
                            credit: line.credit || 0,
                            narration: line.narration
                        }))
                    }
                },
                include: { lines: true }
            });

            // Audit Log
            await AuditService.log(data.userId || null, "CREATE", "JOURNAL", entry.id, null, entry);

            return entry;
        };

        if (tx) {
            return await execute(tx);
        } else {
            return await prisma.$transaction(async (t) => await execute(t));
        }
    }

    static async getEntryByNumber(companyId: string, number: string) {
        return prisma.journalEntry.findFirst({
            where: { companyId, number },
            include: { lines: { include: { account: true } } }
        });
    }

    static async getEntries(companyId: string, filters?: { type?: VoucherType }) {
        return prisma.journalEntry.findMany({
            where: {
                companyId,
                ...filters,
            },
            include: { lines: true },
            orderBy: { date: 'desc' }
        });
    }
}
