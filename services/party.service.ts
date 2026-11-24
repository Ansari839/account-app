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
        code?: string;
        name: string;
        taxId?: string;
        currencyCode?: string;
        payableAccountId?: string;
    }) {
        let payableAccountId = data.payableAccountId;
        if (!payableAccountId) {
            const ap = await prisma.account.findFirst({
                where: {
                    companyId,
                    OR: [
                        { code: '2100' },
                        { code: '2110' },
                        { name: { contains: 'Accounts Payable', mode: 'insensitive' } },
                        { name: { contains: 'Trade Creditors', mode: 'insensitive' } },
                        { name: { contains: 'Creditors', mode: 'insensitive' } },
                        { name: { contains: 'Payable', mode: 'insensitive' } }
                    ],
                    isPosting: true
                }
            }) || await prisma.account.findFirst({ where: { companyId, type: 'LIABILITY', isPosting: true } });
            payableAccountId = ap?.id;
        }

        if (payableAccountId) {
            const isPosting = await AccountService.validatePostingAccount(payableAccountId);
            if (!isPosting) {
                throw new Error("Payable Account must be a valid posting account.");
            }
        }

        let currencyCode = data.currencyCode;
        if (!currencyCode) {
            const defCurr = await prisma.currency.findFirst({ where: { companyId } }) || await prisma.currency.findFirst();
            currencyCode = defCurr?.id || 'PKR';
        }

        let code = data.code;
        if (!code) {
            const count = await prisma.supplier.count({ where: { companyId } });
            code = `SUP-${(count + 1).toString().padStart(4, '0')}`;
        }

        return prisma.supplier.create({
            data: {
                companyId,
                code,
                name: data.name,
                taxId: data.taxId,
                currencyCode,
                payableAccountId,
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
