import prisma from "@/lib/prisma";

export class StockService {
    /**
     * Get current stock of a product in a specific warehouse
     */
    static async getStock(productId: string, warehouseId?: string) {
        const where: any = { productId };
        if (warehouseId) where.warehouseId = warehouseId;

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
    static async validateStockAvailability(warehouseId: string, items: { productId: string, qty: number, name?: string }[]) {
        for (const item of items) {
            const currentStock = await this.getStock(item.productId, warehouseId);
            if (currentStock < item.qty) {
                throw new Error(`Insufficient stock for product ${item.name || item.productId}. Available: ${currentStock}, Requested: ${item.qty}`);
            }
        }
    }
}
