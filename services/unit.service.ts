
import prisma from "../lib/prisma";
import { Unit } from '@/app/generated/prisma/client';

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

        // Check if conversion already exists (optional, unique constraint would handle this too)

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
}
