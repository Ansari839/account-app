import prisma from "@/lib/prisma";
import { VoucherType, Prisma, JournalEntry } from '@prisma/client';

export class VoucherService {
    /**
     * Generates a new unique voucher number for the given type and financial year
     */
    static async generateNumber(type: VoucherType, tx?: Prisma.TransactionClient) {
        const execute = async (txClient: Prisma.TransactionClient) => {
            // 1. Get or create sequence for the type
            let sequence = await txClient.voucherSequence.findUnique({
                where: { type }
            });

            if (!sequence) {
                // Initial defaults for types
                const prefixes: Record<VoucherType, string> = {
                    [VoucherType.JOURNAL]: "JV-",
                    [VoucherType.PAYMENT]: "PV-",
                    [VoucherType.RECEIPT]: "RV-",
                    [VoucherType.CONTRA]: "CV-",
                    [VoucherType.PURCHASE]: "PINV-",
                    [VoucherType.SALES]: "SINV-",
                    [VoucherType.PURCHASE_RETURN]: "PRN-",
                    [VoucherType.SALES_RETURN]: "SRN-",
                    [VoucherType.OPENING]: "OP-",
                    [VoucherType.CLOSING]: "CL-"
                };

                sequence = await txClient.voucherSequence.create({
                    data: {
                        type,
                        prefix: prefixes[type] || "V-",
                        nextValue: 1
                    }
                });
            }

            // 2. Generate Number
            const yearSuffix = new Date().getFullYear().toString().slice(-2);
            const voucherNo = `${sequence.prefix}${yearSuffix}-${sequence.nextValue.toString().padStart(5, '0')}`;

            // 3. Increment Sequence
            await txClient.voucherSequence.update({
                where: { id: sequence.id },
                data: { nextValue: { increment: 1 } }
            });

            return voucherNo;
        };

        if (tx) {
            return await execute(tx);
        } else {
            return await prisma.$transaction(async (t) => await execute(t));
        }
    }

    /**
     * Validate if a voucher number is already used
     */
    static async validateNumber(number: string, tx?: Prisma.TransactionClient) {
        const client = tx || prisma;
        const existing = await client.journalEntry.findUnique({
            where: { number }
        });
        if (existing) {
            throw new Error(`Voucher number ${number} is already in use.`);
        }
        return true;
    }
}
