
import prisma from "../lib/prisma";
import { Product } from '@/app/generated/prisma/client';
import { AccountService } from "./account.service";

export class ProductService {
    /**
     * Create a new Product with GL Mappings
     */
    static async createProduct(data: {
        code: string;
        name: string;
        categoryId?: string;
        baseUnitId: string;
        taxCodeId?: string;
        inventoryAccountId?: string;
        cogsAccountId?: string;
        salesAccountId?: string;
        purchaseAccountId?: string;
        openingStock?: number;
    }) {
        // 1. Validate Account Mappings (If provided)
        // Note: For comprehensive accounting, these SHOULD be mandatory, but we'll allow optional for now based on schema
        // However, if provided, they MUST be valid posting accounts.

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
            },
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
                inventoryAccount: true
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
            },
            orderBy: { name: 'asc' }
        });
    }
}
