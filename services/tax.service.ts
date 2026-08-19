import prisma from "@/lib/prisma";

export class TaxService {
    /**
     * Create a new Tax Code (scoped to company)
     */
    static async createTaxCode(companyId: string, data: {
        name: string;
        code: string;
        rate: number;
        accountId?: string;
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
                accountId: data.accountId || null
            },
        });
    }

    /**
     * Get all Tax Codes (scoped to company)
     */
    static async getAllTaxCodes(companyId: string) {
        return prisma.taxCode.findMany({
            where: { companyId },
            include: { account: true }, // Include account to show in UI or populate form
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
    static async updateTaxCode(id: string, data: any) {
        if (data.rate !== undefined && data.rate < 0) throw new Error("Tax rate cannot be negative.");
        return prisma.taxCode.update({ 
            where: { id }, 
            data: {
                name: data.name,
                code: data.code,
                rate: data.rate,
                accountId: data.accountId || null
            } 
        });
    }
}
