import prisma from "@/lib/prisma";

export class UnitService {
    /**
     * Create a new Unit
     */
    static async createUnit(data: { name: string; code: string }) {
        return prisma.unit.create({
            data: {
                name: data.name,
                code: data.code,
            },
        });
    }

    /**
     * Create a Conversion Factor
     * e.g. from KG to GM, factor = 1000
     */
    static async addConversion(data: {
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
                fromUnitId: data.fromUnitId,
                toUnitId: data.toUnitId,
                factor: data.factor,
            },
        });
    }

    /**
     * Get all units
     */
    static async getAllUnits() {
        return prisma.unit.findMany({
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
        return prisma.unit.update({ where: { id }, data });
    }
}
