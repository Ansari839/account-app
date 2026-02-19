
import prisma from "../lib/prisma";
import { Warehouse } from '@prisma/client';

export class WarehouseService {
    /**
     * Create a new Warehouse (scoped to company)
     */
    static async createWarehouse(companyId: string, data: {
        code: string;
        name: string;
        address?: string;
        isDefault?: boolean;
    }) {
        if (data.isDefault) {
            await prisma.warehouse.updateMany({
                where: { companyId, isDefault: true },
                data: { isDefault: false }
            });
        }

        return prisma.warehouse.create({
            data: {
                companyId,
                code: data.code,
                name: data.name,
                address: data.address,
                isDefault: data.isDefault || false,
            },
        });
    }

    /**
     * Get All Warehouses (scoped to company)
     */
    static async getAllWarehouses(companyId: string) {
        return prisma.warehouse.findMany({
            where: { companyId },
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Get Default Warehouse (scoped to company)
     */
    static async getDefaultWarehouse(companyId: string) {
        return prisma.warehouse.findFirst({
            where: { companyId, isDefault: true }
        });
    }

    /**
     * Update Warehouse
     */
    static async updateWarehouse(companyId: string, id: string, data: { name: string; address?: string; isDefault?: boolean }) {
        if (data.isDefault) {
            await prisma.warehouse.updateMany({
                where: { companyId, isDefault: true, id: { not: id } },
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
