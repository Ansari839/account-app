
import prisma from "../lib/prisma";
import { Warehouse } from '@prisma/client';

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
    /**
     * Update Warehouse
     */
    static async updateWarehouse(id: string, data: { name: string; address?: string; isDefault?: boolean }) {
        if (data.isDefault) {
            await prisma.warehouse.updateMany({
                where: { isDefault: true, id: { not: id } },
                data: { isDefault: false }
            });
        }

        return prisma.warehouse.update({
            where: { id },
            data: {
                name: data.name,
                address: data.address,
                isDefault: data.isDefault
            }
        });
    }

    /**
     * Delete Warehouse
     */
    static async deleteWarehouse(id: string) {
        const transactions = await prisma.stockLedger.count({ where: { warehouseId: id } });
        if (transactions > 0) throw new Error("Cannot delete warehouse with stock transactions.");

        return prisma.warehouse.delete({ where: { id } });
    }
}
