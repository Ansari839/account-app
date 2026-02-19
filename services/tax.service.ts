import prisma from "@/lib/prisma";

export class TaxService {
    /**
     * Create a new Tax Code (scoped to company)
     */
    static async createTaxCode(companyId: string, data: {
        name: string;
        code: string;
        rate: number;
    }) {
        if (data.rate < 0) {
            throw new Error("Tax rate cannot be negative.");
        }

        return prisma.taxCode.create({
            data: {
                companyId,
                name: data.name,
                code: data.code,
                rate: data.rate,
            },
        });
    }

    /**
     * Get all Tax Codes (scoped to company)
     */
    static async getAllTaxCodes(companyId: string) {
        return prisma.taxCode.findMany({
            where: { companyId },
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Delete a Tax Code
     */
    static async deleteTaxCode(id: string) {
        return prisma.taxCode.delete({ where: { id } });
    }

    /**
     * Update a Tax Code
     */
    static async updateTaxCode(id: string, data: { name?: string; code?: string; rate?: number }) {
        if (data.rate !== undefined && data.rate < 0) throw new Error("Tax rate cannot be negative.");
        return prisma.taxCode.update({ where: { id }, data });
    }
}
