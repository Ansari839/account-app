import prisma from "../lib/prisma";
import { Customer, Supplier, AccountType } from '@prisma/client';
import { AccountService } from "./account.service";

export class PartyService {
    /**
     * Create a new Customer
     */
    static async createCustomer(data: {
        code: string;
        name: string;
        taxId?: string;
        currencyCode: string;
        creditLimit?: number;
        receivableAccountId: string;
    }) {
        // 1. Validate Receivable Account
        const isPosting = await AccountService.validatePostingAccount(data.receivableAccountId);
        if (!isPosting) {
            throw new Error("Receivable Account must be a valid posting account.");
        }

        // 2. Validate Currency (Optional: assuming foreign key constraint handles existence, but good to check)
        // For strictness we could check, but let's rely on FK for now or add check if needed.

        return prisma.customer.create({
            data: {
                code: data.code,
                name: data.name,
                taxId: data.taxId,
                currencyCode: data.currencyCode,
                creditLimit: data.creditLimit,
                receivableAccountId: data.receivableAccountId,
            },
        });
    }

    /**
     * Create a new Supplier
     */
    static async createSupplier(data: {
        code: string;
        name: string;
        taxId?: string;
        currencyCode: string;
        payableAccountId: string;
    }) {
        // 1. Validate Payable Account
        const isPosting = await AccountService.validatePostingAccount(data.payableAccountId);
        if (!isPosting) {
            throw new Error("Payable Account must be a valid posting account.");
        }

        return prisma.supplier.create({
            data: {
                code: data.code,
                name: data.name,
                taxId: data.taxId,
                currencyCode: data.currencyCode,
                payableAccountId: data.payableAccountId,
            },
        });
    }

    /**
     * Get Customer by ID
     */
    static async getCustomer(id: string) {
        return prisma.customer.findUnique({
            where: { id },
            include: { currency: true, receivableAccount: true }
        });
    }
}
