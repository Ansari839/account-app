
import prisma from "@/lib/prisma";

export class CategoryService {
    static async list() {
        // Return hierarchy or flat list. For simplicity, flat sorted by name for now.
        return await prisma.category.findMany({
            include: { parent: true, children: true },
            orderBy: { name: 'asc' }
        });
    }

    static async create(data: { name: string, parentId?: string }) {
        return await prisma.category.create({
            data: {
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
        // Check for products
        const products = await prisma.product.count({ where: { categoryId: id } });
        if (products > 0) throw new Error("Cannot delete category with associated products.");

        // Check for children
        const children = await prisma.category.count({ where: { parentId: id } });
        if (children > 0) throw new Error("Cannot delete category with sub-categories.");

        return await prisma.category.delete({ where: { id } });
    }
}
