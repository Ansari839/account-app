
import prisma from "../lib/prisma";
import { Account, AccountType } from '@prisma/client';

export class AccountService {
    /**
     * Generate automatic account code (scoped to company)
     */
    static async generateCode(companyId: string, parentId: string | null, type: AccountType): Promise<string> {
        if (!parentId) {
            const prefixMap: Record<AccountType, string> = {
                'ASSET': '1000',
                'LIABILITY': '2000',
                'EQUITY': '3000',
                'INCOME': '4000',
                'EXPENSE': '5000'
            };
            const prefix = prefixMap[type];
            const maxRoot = await prisma.account.findFirst({
                where: { companyId, parentId: null, type },
                orderBy: { code: 'desc' },
            });

            if (!maxRoot) return prefix;
            return (parseInt(maxRoot.code) + 1000).toString();
        }

        const parent = await prisma.account.findUnique({ where: { id: parentId } });
        if (!parent) throw new Error('Parent not found');

        const lastChild = await prisma.account.findFirst({
            where: { companyId, parentId },
            orderBy: { code: 'desc' },
        });

        const parentCode = parent.code;
        const parentLevel = parent.level;

        if (!lastChild) {
            if (parentLevel === 0) return (parseInt(parentCode) + 100).toString();
            if (parentLevel === 1) return (parseInt(parentCode) + 10).toString();
            if (parentLevel === 2) return (parseInt(parentCode) + 1).toString();
            return `${parentCode}01`;
        }

        const lastCode = parseInt(lastChild.code);
        if (parentLevel === 0) return (lastCode + 100).toString();
        if (parentLevel === 1) return (lastCode + 10).toString();
        if (parentLevel === 2) return (lastCode + 1).toString();

        return (lastCode + 1).toString();
    }

    /**
     * Setup Default COA Structure (scoped to company)
     */
    static async setupDefaultCOA(companyId: string) {
        const count = await prisma.account.count({ where: { companyId } });
        if (count > 0) throw new Error('Chart of Accounts is not empty for this company');

        const structure = [
            {
                name: 'ASSETS', type: AccountType.ASSET, isPosting: false, children: [
                    {
                        name: 'Non-Current Assets', isPosting: false, children: [
                            { name: 'Fixed Assets', isPosting: true },
                            { name: 'Accumulated Depreciation', isPosting: true }
                        ]
                    },
                    {
                        name: 'Current Assets', isPosting: false, children: [
                            {
                                name: 'Cash & Cash Equivalents', isPosting: false, children: [
                                    { name: 'Cash in Hand', isPosting: true },
                                    { name: 'Bank Accounts', isPosting: true }
                                ]
                            },
                            { name: 'Accounts Receivable', isPosting: true },
                            { name: 'Inventory', isPosting: true },
                            { name: 'Advances, Deposits & Prepayments', isPosting: false }
                        ]
                    }
                ]
            },
            {
                name: 'LIABILITIES', type: AccountType.LIABILITY, isPosting: false, children: [
                    { name: 'Equity and Reserves', isPosting: false },
                    { name: 'Non-Current Liabilities', isPosting: false },
                    {
                        name: 'Current Liabilities', isPosting: false, children: [
                            { name: 'Accounts Payable', isPosting: true },
                            { name: 'Accrued Expenses', isPosting: true }
                        ]
                    }
                ]
            },
            {
                name: 'EQUITY', type: AccountType.EQUITY, isPosting: false, children: [
                    { name: 'Share Capital', isPosting: true },
                    { name: 'Retained Earnings', isPosting: true }
                ]
            },
            {
                name: 'REVENUE', type: AccountType.INCOME, isPosting: false, children: [
                    { name: 'Sales Revenue', isPosting: true },
                    { name: 'Other Income', isPosting: true }
                ]
            },
            {
                name: 'EXPENSES', type: AccountType.EXPENSE, isPosting: false, children: [
                    { name: 'Cost of Goods Sold', isPosting: true },
                    { name: 'Operating Expenses', isPosting: true },
                    { name: 'Financial Charges', isPosting: true }
                ]
            }
        ];

        const createRecursive = async (items: any[], parentId: string | null = null, type?: AccountType) => {
            for (const item of items) {
                const account = await this.createAccount(companyId, {
                    name: item.name,
                    type: type || item.type,
                    parentId,
                    isPosting: item.isPosting,
                });
                if (item.children) {
                    await createRecursive(item.children, account.id, type || item.type);
                }
            }
        };

        await createRecursive(structure);
        return { success: true };
    }

    /**
     * Create a new Account (scoped to company)
     */
    static async createAccount(companyId: string, data: {
        name: string;
        type: AccountType;
        parentId?: string | null;
        isPosting: boolean;
        openingBalance?: number;
        openingBalanceType?: 'DR' | 'CR';
    }) {
        let level = 0;
        if (data.parentId) {
            const parent = await prisma.account.findUnique({
                where: { id: data.parentId },
            });
            if (!parent) throw new Error('Parent account not found');
            level = parent.level + 1;

            if (parent.isPosting) {
                throw new Error('Parent account cannot be a posting account.');
            }
        }

        const code = await this.generateCode(companyId, data.parentId || null, data.type);

        return prisma.account.create({
            data: {
                companyId,
                code,
                name: data.name,
                type: data.type,
                parentId: data.parentId,
                level,
                isPosting: data.isPosting,
                openingBalance: data.openingBalance || 0,
                openingBalanceType: (data.openingBalanceType as any) || 'DR',
            },
        });
    }

    /**
     * Get Account Hierarchy (scoped to company)
     */
    static async getAccountHierarchy(companyId: string) {
        const allAccounts = await prisma.account.findMany({
            where: { companyId },
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
     * Get flattened list of posting accounts (for dropdowns, scoped to company)
     */
    static async getPostingAccounts(companyId: string, type?: AccountType) {
        return prisma.account.findMany({
            where: {
                companyId,
                isPosting: true,
                ...(type && { type }),
            },
            orderBy: { code: 'asc' },
        });
    }

    /**
     * Update an Account
     */
    static async updateAccount(id: string, data: {
        code?: string;
        name?: string;
        type?: AccountType;
        parentId?: string | null;
        isPosting?: boolean;
        openingBalance?: number;
        openingBalanceType?: 'DR' | 'CR';
    }) {
        const existing = await prisma.account.findUnique({ where: { id } });
        if (!existing) throw new Error('Account not found');

        if (data.isPosting === true && existing.isPosting === false) {
            const childrenCount = await prisma.account.count({ where: { parentId: id } });
            if (childrenCount > 0) {
                throw new Error('Cannot change a summary account with sub-accounts into a posting account.');
            }
        }

        if (data.parentId) {
            const parent = await prisma.account.findUnique({ where: { id: data.parentId } });
            if (parent?.isPosting) {
                throw new Error('Parent account cannot be a posting account.');
            }
        }

        let level = existing.level;
        if (data.parentId !== undefined && data.parentId !== existing.parentId) {
            if (data.parentId === null) {
                level = 0;
            } else {
                const parent = await prisma.account.findUnique({
                    where: { id: data.parentId },
                });
                if (!parent) throw new Error('Parent account not found');
                level = parent.level + 1;
            }
        }

        return prisma.account.update({
            where: { id },
            data: {
                ...data,
                level,
                openingBalanceType: data.openingBalanceType as any
            },
        });
    }

    /**
     * Delete an Account
     */
    static async deleteAccount(id: string) {
        const children = await prisma.account.count({
            where: { parentId: id },
        });
        if (children > 0) throw new Error('Cannot delete account with sub-accounts');

        const transactions = await prisma.journalLine.count({
            where: { accountId: id },
        });
        if (transactions > 0) throw new Error('Cannot delete account with existing transactions');

        const productUsage = await prisma.product.count({
            where: {
                OR: [
                    { inventoryAccountId: id },
                    { cogsAccountId: id },
                    { salesAccountId: id },
                    { purchaseAccountId: id },
                ]
            }
        });
        if (productUsage > 0) throw new Error('Account is being used in product configurations');

        return prisma.account.delete({
            where: { id },
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
