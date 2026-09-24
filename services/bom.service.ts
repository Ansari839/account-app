import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export class BOMService {
    
    // Create new BOM Template
    static async create(companyId: string, data: any, txClient?: Prisma.TransactionClient) {
        const client = txClient || prisma;
        
        return await client.bOMTemplate.create({
            data: {
                companyId,
                name: data.name,
                outputProductId: data.outputProductId,
                outputQuantity: data.outputQuantity,
                inputs: {
                    create: data.inputs.map((item: any) => ({
                        productId: item.productId,
                        quantity: item.quantity
                    }))
                }
            },
            include: {
                inputs: {
                    include: {
                        product: true
                    }
                },
                outputProduct: true
            }
        });
    }

    // Get all BOM Templates for a company
    static async getAll(companyId: string) {
        return await prisma.bOMTemplate.findMany({
            where: { companyId },
            include: {
                outputProduct: true,
                inputs: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    // Get a specific BOM Template
    static async getById(companyId: string, id: string) {
        return await prisma.bOMTemplate.findUnique({
            where: { id },
            include: {
                outputProduct: true,
                inputs: {
                    include: {
                        product: true
                    }
                }
            }
        });
    }

    // Update a BOM Template
    static async update(companyId: string, id: string, data: any) {
        return await prisma.$transaction(async (tx) => {
            // First delete existing inputs
            await tx.bOMInputItem.deleteMany({
                where: { bomId: id }
            });

            // Update template and recreate inputs
            return await tx.bOMTemplate.update({
                where: { id },
                data: {
                    name: data.name,
                    outputProductId: data.outputProductId,
                    outputQuantity: data.outputQuantity,
                    inputs: {
                        create: data.inputs.map((item: any) => ({
                            productId: item.productId,
                            quantity: item.quantity
                        }))
                    }
                },
                include: {
                    outputProduct: true,
                    inputs: {
                        include: {
                            product: true
                        }
                    }
                }
            });
        });
    }

    // Delete a BOM Template
    static async delete(companyId: string, id: string) {
        return await prisma.bOMTemplate.delete({
            where: { id }
        });
    }
}
