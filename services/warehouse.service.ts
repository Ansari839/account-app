
import prisma from "../lib/prisma";
import { Warehouse } from '@/app/generated/prisma/client';

export class WarehouseService {
    /**
     * Create a new Warehouse
     */
    static async createWarehouse(data: {
        code: string;
        name: string;
        address?: string;
        isDefault?: boolean;
    }) {
        // If setting as default, unset other defaults? 
        // Logic: specific business rule, usually yes.
        if (data.isDefault) {
            await prisma.warehouse.updateMany({
                where: { isDefault: true },
                data: { isDefault: false }
            });
        }

        return prisma.warehouse.create({
            data: {
                code: data.code,
                name: data.name,
                address: data.address,
                isDefault: data.isDefault || false,
            },
        });
    }

    /**
     * Get All Warehouses
     */
    static async getAllWarehouses() {
        return prisma.warehouse.findMany({
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Get Default Warehouse
     */
    static async getDefaultWarehouse() {
        return prisma.warehouse.findFirst({
            where: { isDefault: true }
        });
    }
}
