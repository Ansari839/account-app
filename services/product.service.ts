
import prisma from "../lib/prisma";
import { Product } from '@prisma/client';
import { AccountService } from "./account.service";

export class ProductService {

    /**
     * Create a new Product with GL Mappings and Variants
     */
    static async createProduct(data: {
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
        variants?: { name: string; sku?: string; price?: number }[];
    }) {
        // Auto-generate SKU if not provided
        if (!data.code || data.code.trim() === "") {
            const count = await prisma.product.count();
            data.code = `PROD-${(count + 1).toString().padStart(4, '0')}`;
        }
        // Validate Account Mappings (If provided)
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
     * Get Product by Code
     */
    static async getProductByCode(code: string) {
        return prisma.product.findUnique({
            where: { code },
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
     * Get All Products
     */
    static async getAllProducts() {
        return prisma.product.findMany({
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

        // If variants are provided, we handle them carefully.
        // For simplicity: delete existing and recreate (if acceptable) OR upsert.
        // Recreating is risky if linked to stock. 
        // Better strategy: Update or Create. Handle deletion separately if needed.

        // Let's implement basics + overwrite variants if provided (user typically edits full list)
        // CAUTION: If variants have transactions, we cannot delete them.

        return prisma.product.update({
            where: { id },
            data: {
                ...productData,
                // Simple case: add new variants only for now through this API to avoid complexity
                // Or user can manage variants via separate API if needed.
                // We'll support creating new variants here.
                variants: variants ? {
                    upsert: variants.map((v: any) => ({
                        where: { id: v.id || 'new' }, // 'new' won't match, so it creates
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
        // Check for transactions
        const transactions = await prisma.stockLedger.count({ where: { productId: id } });
        if (transactions > 0) throw new Error("Cannot delete product with existing stock transactions.");

        return prisma.product.delete({ where: { id } });
    }
}
