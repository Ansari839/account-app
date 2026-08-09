import prisma from "@/lib/prisma";

export class UnitService {
    /**
     * Create a new Unit (scoped to company)
     */
    static async createUnit(companyId: string, data: { name: string; code: string }) {
        if (!data.name || !data.code) {
            throw new Error("Unit name and code are required.");
        }
        
        const existing = await prisma.unit.findUnique({
            where: { companyId_code: { companyId, code: String(data.code).trim() } }
        });
        
        if (existing) {
            throw new Error(`Unit with code "${data.code}" already exists.`);
        }

        return prisma.unit.create({
            data: {
                companyId,
                name: String(data.name).trim(),
                code: String(data.code).trim(),
            },
        });
    }

    /**
     * Create a Conversion Factor (scoped to company)
     */
    static async addConversion(companyId: string, data: {
        fromUnitId: string;
        toUnitId: string;
        factor: number;
    }) {
        if (data.fromUnitId === data.toUnitId) {
            throw new Error("Cannot convert unit to itself.");
        }

        if (data.factor <= 0) {
            throw new Error("Conversion factor must be positive.");
        }

        return prisma.unitConversion.create({
            data: {
                companyId,
                fromUnitId: data.fromUnitId,
                toUnitId: data.toUnitId,
                factor: data.factor,
            },
        });
    }

    /**
     * Get all units (scoped to company)
     */
    static async getAllUnits(companyId: string) {
        return prisma.unit.findMany({
            where: { companyId },
            orderBy: { name: 'asc' },
            include: {
                conversionsFrom: { include: { toUnit: true } },
                conversionsTo: { include: { fromUnit: true } }
            }
        });
    }

    /**
     * Delete a Unit
     */
    static async deleteUnit(id: string) {
        return prisma.unit.delete({ where: { id } });
    }

    /**
     * Update a Unit
     */
    static async updateUnit(id: string, data: { name?: string; code?: string }) {
        const updateData: any = {};
        if (data.name !== undefined) updateData.name = String(data.name).trim();
        if (data.code !== undefined) updateData.code = String(data.code).trim();
        return prisma.unit.update({ where: { id }, data: updateData });
    }
}
