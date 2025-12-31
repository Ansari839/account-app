import prisma from "@/lib/prisma";
import { VoucherType, Prisma } from "@/app/generated/prisma/client";
import { VoucherService } from "./voucher.service";
import { FinancialYearService } from "./financialYear.service";
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
    id?: string; // For updates
    userId?: string; // Added for ABAC and Audit
    number?: string; // Made optional for auto-generation
    date: Date;
    type: VoucherType;
    reference?: string;
    narration?: string;
    lines: JournalLineInput[];
}

export class JournalService {
    /**
     * Creates a balanced Journal Entry (Voucher)
     */
    static async createEntry(data: JournalEntryInput, tx?: Prisma.TransactionClient) {
        const client = tx || prisma;

        // 1. Accounting Controls
        await AccountingControlService.validateTransaction(data.date, data.id);

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

        // 4. Financial Year Handling
        const activeYear = await FinancialYearService.getActiveYear(data.date);
        if (!activeYear.isOpen) {
            throw new Error(`Financial Year ${activeYear.name} is closed. Cannot post transaction.`);
        }

        // 5. Voucher Number Handling
        let voucherNo = data.number;

        const execute = async (txClient: Prisma.TransactionClient) => {
            if (!voucherNo) {
                voucherNo = await VoucherService.generateNumber(data.type, txClient);
            } else {
                await VoucherService.validateNumber(voucherNo, txClient);
            }

            const entry = await txClient.journalEntry.create({
                data: {
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

    static async getEntryByNumber(number: string) {
        return prisma.journalEntry.findUnique({
            where: { number },
            include: { lines: { include: { account: true } } }
        });
    }
}
