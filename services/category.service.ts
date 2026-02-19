
import prisma from "@/lib/prisma";

export class CategoryService {
    static async list(companyId: string) {
        return await prisma.category.findMany({
            where: { companyId },
            include: { parent: true, children: true },
            orderBy: { name: 'asc' }
        });
    }

    static async create(companyId: string, data: { name: string, parentId?: string }) {
        return await prisma.category.create({
            data: {
                companyId,
                name: data.name,
                parentId: data.parentId || null
            }
        });
    }

    static async update(id: string, data: { name: string, parentId?: string }) {
        return await prisma.category.update({
            where: { id },
            data: {
                name: data.name,
                parentId: data.parentId || null
            }
        });
    }

    static async delete(id: string) {
        const products = await prisma.product.count({ where: { categoryId: id } });
        if (products > 0) throw new Error("Cannot delete category with associated products.");

        const children = await prisma.category.count({ where: { parentId: id } });
        if (children > 0) throw new Error("Cannot delete category with sub-categories.");

        return await prisma.category.delete({ where: { id } });
    }
}
