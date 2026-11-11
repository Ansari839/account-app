
import prisma from "../lib/prisma";

export class CategoryService {
    static async list(companyId: string) {
        const categories = await prisma.category.findMany({
            where: { companyId },
            include: { 
                Category: true, 
                other_Category: true,
                _count: {
                    select: { Product: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        return categories.map(c => ({
            ...c,
            parent: c.Category,
            children: c.other_Category,
            _count: {
                products: c._count.Product
            }
        }));
    }

    static async get(id: string) {
        const c = await prisma.category.findUnique({
            where: { id },
            include: { Category: true }
        });
        if (!c) return null;
        return {
            ...c,
            parent: c.Category
        };
    }

    static async create(companyId: string, data: { name: string, parentId?: string, isService?: boolean, wipAccountId?: string }) {
        return await prisma.category.create({
            data: {
                companyId,
                name: data.name,
                isService: data.isService || false,
                wipAccountId: data.wipAccountId || null,
                parentId: data.parentId || null
            }
        });
    }

    static async update(id: string, data: { name: string, parentId?: string, isService?: boolean, wipAccountId?: string }) {
        return await prisma.category.update({
            where: { id },
            data: {
                name: data.name,
                isService: data.isService !== undefined ? data.isService : undefined,
                wipAccountId: data.wipAccountId !== undefined ? data.wipAccountId : undefined,
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
