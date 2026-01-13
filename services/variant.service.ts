
import prisma from "../lib/prisma";
import { ProductVariant } from "@prisma/client";

export class VariantService {
    /**
     * Create a new variant for a product
     */
    static async createVariant(data: {
        productId: string;
        name: string;
        sku?: string;
        price?: number;
    }) {
        return prisma.productVariant.create({
            data: {
                productId: data.productId,
                name: data.name,
                sku: data.sku,
                price: data.price
            }
        });
    }

    /**
     * Get variants by product ID
     */
    static async getByProduct(productId: string) {
        return prisma.productVariant.findMany({
            where: { productId },
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Update a variant
     */
    static async updateVariant(id: string, data: Partial<Omit<ProductVariant, 'id' | 'productId' | 'createdAt' | 'updatedAt'>>) {
        return prisma.productVariant.update({
            where: { id },
            data
        });
    }

    /**
     * Delete a variant
     */
    static async deleteVariant(id: string) {
        // Check for transactions in stock or other documents
        const stockCount = await prisma.stockLedger.count({ where: { variantId: id } });
        if (stockCount > 0) throw new Error("Cannot delete variant with existing stock transactions.");

        // Check in other item models if needed (e.g. PurchaseOrderItem)
        // Since we added these relations, we should check them or use onDelete: Restrict
        const poItemCount = await prisma.purchaseOrderItem.count({ where: { variantId: id } });
        if (poItemCount > 0) throw new Error("Cannot delete variant used in Purchase Orders.");

        const siItemCount = await prisma.salesInvoiceItem.count({ where: { variantId: id } });
        if (siItemCount > 0) throw new Error("Cannot delete variant used in Sales Invoices.");

        return prisma.productVariant.delete({ where: { id } });
    }

    /**
     * Get variant by SKU
     */
    static async getBySku(sku: string) {
        return prisma.productVariant.findUnique({
            where: { sku },
            include: { product: true }
        });
    }
}
