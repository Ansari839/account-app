
import prisma from "../lib/prisma";
import { Account, AccountType, Product } from '@prisma/client';
import { AccountService } from "./account.service";

export class ProductService {
    /**
     * Helper to find a default account by name and type (scoped to company)
     */
    private static async findDefaultAccount(companyId: string, name: string, type: AccountType) {
        return prisma.account.findFirst({
            where: {
                companyId,
                name: { contains: name, mode: 'insensitive' },
                type: type,
                isPosting: true
            }
        });
    }

    /**
     * Create a new Product with GL Mappings and Variants (scoped to company)
     */
    static async createProduct(companyId: string, data: {
        code?: string;
        name: string;
        categoryId?: string;
        baseUnitId: string;
        taxCodeId?: string;
        inventoryAccountId?: string;
        cogsAccountId?: string;
        salesAccountId?: string;
        purchaseAccountId?: string;
        openingStock?: number;
        hsCode?: string;
        variants?: { name: string; sku?: string; price?: number }[];
    }) {
        // Auto-generate SKU if not provided
        if (!data.code || data.code.trim() === "") {
            const count = await prisma.product.count({ where: { companyId } });
            data.code = `PROD-${(count + 1).toString().padStart(4, '0')}`;
        }

        // --- Assign Default Accounts if Missing ---
        if (!data.inventoryAccountId) {
            const def = await this.findDefaultAccount(companyId, 'Inventory', 'ASSET');
            if (def) data.inventoryAccountId = def.id;
        }
        if (!data.cogsAccountId) {
            const def = await this.findDefaultAccount(companyId, 'Cost of Goods Sold', 'EXPENSE');
            if (def) data.cogsAccountId = def.id;
        }
        if (!data.salesAccountId) {
            const def = await this.findDefaultAccount(companyId, 'Sales', 'INCOME');
            if (def) data.salesAccountId = def.id;
        }
        if (!data.purchaseAccountId) {
            const def = await this.findDefaultAccount(companyId, 'Purchase', 'EXPENSE');
            if (def) {
                data.purchaseAccountId = def.id;
            } else if (data.cogsAccountId) {
                data.purchaseAccountId = data.cogsAccountId;
            } else if (data.inventoryAccountId) {
                data.purchaseAccountId = data.inventoryAccountId;
            }
        }

        // Validate Account Mappings
        const accountsToValidate = [
            { id: data.inventoryAccountId, name: 'Inventory Account' },
            { id: data.cogsAccountId, name: 'COGS Account' },
            { id: data.salesAccountId, name: 'Sales Account' },
            { id: data.purchaseAccountId, name: 'Purchase Account' },
        ];

        for (const account of accountsToValidate) {
            if (account.id) {
                const isPosting = await AccountService.validatePostingAccount(account.id);
                if (!isPosting) {
                    throw new Error(`${account.name} must be a valid posting account.`);
                }
            }
        }

        return prisma.product.create({
            data: {
                companyId,
                code: data.code,
                name: data.name,
                categoryId: data.categoryId,
                baseUnitId: data.baseUnitId,
                taxCodeId: data.taxCodeId,
                inventoryAccountId: data.inventoryAccountId,
                cogsAccountId: data.cogsAccountId,
                salesAccountId: data.salesAccountId,
                purchaseAccountId: data.purchaseAccountId,
                openingStock: data.openingStock,
                hsCode: data.hsCode,
                variants: {
                    create: data.variants?.map(v => ({
                        name: v.name,
                        sku: v.sku,
                        price: v.price
                    }))
                }
            },
            include: { variants: true }
        });
    }

    /**
     * Get Product by Code (scoped to company)
     */
    static async getProductByCode(companyId: string, code: string) {
        return prisma.product.findFirst({
            where: { companyId, code },
            include: {
                category: true,
                baseUnit: true,
                taxCode: true,
                inventoryAccount: true,
                variants: true
            }
        });
    }

    /**
     * Get All Products (scoped to company)
     */
    static async getAllProducts(companyId: string) {
        return prisma.product.findMany({
            where: { companyId },
            include: {
                category: true,
                baseUnit: true,
                taxCode: true,
                variants: true
            },
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Update Product
     */
    static async updateProduct(id: string, data: any) {
        const { variants, ...productData } = data;

        return prisma.product.update({
            where: { id },
            data: {
                ...productData,
                variants: variants ? {
                    upsert: variants.map((v: any) => ({
                        where: { id: v.id || 'new' },
                        create: { name: v.name, sku: v.sku, price: v.price },
                        update: { name: v.name, sku: v.sku, price: v.price }
                    }))
                } : undefined
            }
        });
    }

    /**
     * Delete Product
     */
    static async deleteProduct(id: string) {
        const transactions = await prisma.stockLedger.count({ where: { productId: id } });
        if (transactions > 0) throw new Error("Cannot delete product with existing stock transactions.");

        return prisma.product.delete({ where: { id } });
    }
}
