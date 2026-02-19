import prisma from "@/lib/prisma";

export class FinancialYearService {
    /**
     * Create a new Financial Year (scoped to company)
     */
    static async createYear(companyId: string, data: {
        name: string;
        startDate: Date;
        endDate: Date;
    }) {
        return prisma.financialYear.create({
            data: {
                companyId,
                name: data.name,
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                isOpen: true
            }
        });
    }

    /**
     * Get the active financial year for a given date (scoped to company)
     */
    static async getActiveYear(companyId: string, date: Date = new Date()) {
        const year = await prisma.financialYear.findFirst({
            where: {
                companyId,
                startDate: { lte: date },
                endDate: { gte: date },
                isOpen: true,
                lockedAt: null
            },
            orderBy: { createdAt: 'desc' }
        });
        return year;
    }

    /**
     * List all financial years (scoped to company)
     */
    static async listYears(companyId: string) {
        return prisma.financialYear.findMany({
            where: { companyId },
            orderBy: { startDate: 'desc' }
        });
    }

    /**
     * Update a Financial Year
     */
    static async updateYear(id: string, data: { name?: string; startDate?: Date; endDate?: Date; isOpen?: boolean }) {
        return prisma.financialYear.update({
            where: { id },
            data: {
                ...data,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                endDate: data.endDate ? new Date(data.endDate) : undefined
            }
        });
    }

    /**
     * Terminate/Close a Year (Soft Close)
     */
    static async closeYear(id: string) {
        return prisma.financialYear.update({
            where: { id },
            data: { isOpen: false, lockedAt: new Date() }
        });
    }

    /**
     * Delete a Year (If no dependencies)
     */
    static async deleteYear(id: string) {
        return prisma.financialYear.delete({ where: { id } });
    }
}
