import prisma from "@/lib/prisma";
import { VoucherType, Prisma } from "@/app/generated/prisma/client";

export interface JournalLineInput {
    accountId: string;
    debit?: number;
    credit?: number;
    narration?: string;
}

export interface JournalEntryInput {
    number: string;
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
        // 1. Validation: Balance Check
        const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
        const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Journal Entry must be balanced. Total Debit (${totalDebit.toFixed(2)}) != Total Credit (${totalCredit.toFixed(2)})`);
        }

        if (data.lines.length < 2) {
            throw new Error("Journal Entry must have at least two lines.");
        }

        const execute = async (client: any) => {
            return await client.journalEntry.create({
                data: {
                    number: data.number,
                    date: data.date,
                    type: data.type,
                    reference: data.reference,
                    narration: data.narration,
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
