import prisma from "@/lib/prisma";

export class ABACService {
    /**
     * Check if user has limit for a module
     */
    static async checkLimit(userId: string, module: string, amount: number) {
        const limits = await prisma.userRoleLimit.findMany({
            where: { userId, module, limitType: 'AMOUNT' }
        });

        if (limits.length === 0) return true; // No limit means unlimited

        const maxLimit = Math.max(...limits.map(l => parseFloat(l.limitValue)));
        return amount <= maxLimit;
    }

    /**
     * Check if user has access to a specific warehouse
     */
    static async checkWarehouseAccess(userId: string, warehouseId: string) {
        const limits = await prisma.userRoleLimit.findMany({
            where: { userId, limitType: 'WAREHOUSE_ID' }
        });

        if (limits.length === 0) return true; // No warehouse limits = access all

        return limits.some(l => l.limitValue === warehouseId);
    }
}
