import prisma from "../lib/prisma";
import { Customer, Supplier, AccountType } from '@prisma/client';
import { AccountService } from "./account.service";

export class PartyService {
    /**
     * Create a new Customer (scoped to company)
     */
    static async createCustomer(companyId: string, data: {
        code: string;
        name: string;
        taxId?: string;
        currencyCode: string;
        creditLimit?: number;
        receivableAccountId: string;
    }) {
        const isPosting = await AccountService.validatePostingAccount(data.receivableAccountId);
        if (!isPosting) {
            throw new Error("Receivable Account must be a valid posting account.");
        }

        return prisma.customer.create({
            data: {
                companyId,
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
     * Create a new Supplier (scoped to company)
     */
    static async createSupplier(companyId: string, data: {
        code: string;
        name: string;
        taxId?: string;
        currencyCode: string;
        payableAccountId: string;
    }) {
        const isPosting = await AccountService.validatePostingAccount(data.payableAccountId);
        if (!isPosting) {
            throw new Error("Payable Account must be a valid posting account.");
        }

        return prisma.supplier.create({
            data: {
                companyId,
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
