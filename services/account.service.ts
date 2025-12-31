
import prisma from "../lib/prisma";
import { Account, AccountType } from '@/app/generated/prisma/client';

export class AccountService {
    /**
     * Generate automatic account code
     */
    static async generateCode(parentId: string | null, type: AccountType): Promise<string> {
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
                where: { parentId: null, type },
                orderBy: { code: 'desc' },
            });

            if (!maxRoot) return prefix;
            return (parseInt(maxRoot.code) + 1000).toString();
        }

        const parent = await prisma.account.findUnique({ where: { id: parentId } });
        if (!parent) throw new Error('Parent not found');

        const lastChild = await prisma.account.findFirst({
            where: { parentId },
            orderBy: { code: 'desc' },
        });

        const parentCode = parent.code;
        const parentLevel = parent.level;

        if (!lastChild) {
            // First child logic based on depth
            // Level 0 -> Level 1 (e.g. 1000 -> 1100)
            if (parentLevel === 0) return (parseInt(parentCode) + 100).toString();
            // Level 1 -> Level 2 (e.g. 1100 -> 1110)
            if (parentLevel === 1) return (parseInt(parentCode) + 10).toString();
            // Level 2 -> Level 3 (e.g. 1110 -> 1111)
            if (parentLevel === 2) return (parseInt(parentCode) + 1).toString();

            return `${parentCode}01`; // Fallback
        }

        const lastCode = parseInt(lastChild.code);
        // Standard increment based on depth
        if (parentLevel === 0) return (lastCode + 100).toString();
        if (parentLevel === 1) return (lastCode + 10).toString();
        if (parentLevel === 2) return (lastCode + 1).toString();

        return (lastCode + 1).toString();
    }

    /**
     * Setup Default COA Structure
     */
    static async setupDefaultCOA() {
        const count = await prisma.account.count();
        if (count > 0) throw new Error('Chart of Accounts is not empty');

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
                const account = await this.createAccount({
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
     * Create a new Account
     */
    static async createAccount(data: {
        name: string;
        type: AccountType;
        parentId?: string | null;
        isPosting: boolean;
        openingBalance?: number;
        openingBalanceType?: 'DR' | 'CR';
    }) {
        // 1. Validate Parent
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

        // 2. Generate Code
        const code = await this.generateCode(data.parentId || null, data.type);

        // 3. Create Account
        return prisma.account.create({
            data: {
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

        // Rule: A summary account with children cannot be converted to a posting account
        if (data.isPosting === true && existing.isPosting === false) {
            const childrenCount = await prisma.account.count({ where: { parentId: id } });
            if (childrenCount > 0) {
                throw new Error('Cannot change a summary account with sub-accounts into a posting account.');
            }
        }

        // Rule: Parent cannot be a posting account
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
        // 1. Check for children
        const children = await prisma.account.count({
            where: { parentId: id },
        });
        if (children > 0) throw new Error('Cannot delete account with sub-accounts');

        // 2. Check for transactions (Journal Lines)
        const transactions = await prisma.journalLine.count({
            where: { accountId: id },
        });
        if (transactions > 0) throw new Error('Cannot delete account with existing transactions');

        // 3. Check if used in masters (Products, Customers, etc.)
        // This is a complex check, but minimal for now:
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
