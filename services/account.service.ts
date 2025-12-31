
import prisma from "../lib/prisma";
import { Account, AccountType } from '@/app/generated/prisma/client';

export class AccountService {
    /**
     * Create a new Account
     */
    static async createAccount(data: {
        code: string;
        name: string;
        type: AccountType;
        parentId?: string;
        isPosting: boolean;
    }) {
        // 1. Validate Parent
        let level = 0;
        if (data.parentId) {
            const parent = await prisma.account.findUnique({
                where: { id: data.parentId },
            });
            if (!parent) throw new Error('Parent account not found');
            level = parent.level + 1;

            // Ensure parent is NOT a posting account (must be a summary account)
            if (parent.isPosting) {
                throw new Error('Parent account cannot be a posting account. It must be a summary account.');
            }
        }

        // 2. Create Account
        return prisma.account.create({
            data: {
                code: data.code,
                name: data.name,
                type: data.type,
                parentId: data.parentId,
                level,
                isPosting: data.isPosting,
            },
        });
    }

    /**
     * Get Account Hierarchy
     */
    static async getAccountHierarchy() {
        const allAccounts = await prisma.account.findMany({
            orderBy: { code: 'asc' },
        });

        const buildTree = (accounts: Account[], parentId: string | null = null): any[] => {
            return accounts
                .filter((acc) => acc.parentId === parentId)
                .map((acc) => ({
                    ...acc,
                    children: buildTree(accounts, acc.id),
                }));
        };

        return buildTree(allAccounts);
    }

    /**
     * Get flattened list of posting accounts (for dropdowns)
     */
    static async getPostingAccounts(type?: AccountType) {
        return prisma.account.findMany({
            where: {
                isPosting: true,
                ...(type && { type }),
            },
            orderBy: { code: 'asc' },
        });
    }

    /**
     * Validate if an account can be posted to
     */
    static async validatePostingAccount(accountId: string) {
        const account = await prisma.account.findUnique({
            where: { id: accountId },
        });

        if (!account) return false;
        return account.isPosting;
    }
}
