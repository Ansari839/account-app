import prisma from "@/lib/prisma";

export class StockService {
    /**
     * Get current stock of a product in a specific warehouse, optionally filtered by variant
     */
    static async getStock(productId: string, warehouseId?: string, variantId?: string) {
        const where: any = { productId };
        if (warehouseId) where.warehouseId = warehouseId;
        if (variantId) where.variantId = variantId;

        const aggregate = await prisma.stockLedger.aggregate({
            where,
            _sum: {
                qtyIn: true,
                qtyOut: true
            }
        });

        const qtyIn = aggregate._sum.qtyIn?.toNumber() || 0;
        const qtyOut = aggregate._sum.qtyOut?.toNumber() || 0;

        return qtyIn - qtyOut;
    }

    /**
     * Check if enough stock is available for a list of items
     * Throws an error if any item is insufficient
     */
    static async validateStockAvailability(warehouseId: string, items: { productId: string, variantId?: string, qty: number, name?: string }[]) {
        for (const item of items) {
            const currentStock = await this.getStock(item.productId, warehouseId, item.variantId);
            if (currentStock < item.qty) {
                const variantSuffix = item.variantId ? ` (Variant: ${item.variantId})` : "";
                throw new Error(`Insufficient stock for product ${item.name || item.productId}${variantSuffix}. Available: ${currentStock}, Requested: ${item.qty}`);
            }
        }
    }
}
