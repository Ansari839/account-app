import prisma from "@/lib/prisma";

export class FinancialYearService {
    /**
     * Create a new Financial Year (scoped to company)
     */
    static async createYear(companyId: string, data: {
        name: string;
        startDate: Date | string;
        endDate: Date | string;
    }) {
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error("Invalid start date or end date provided.");
        }

        const existing = await prisma.financialYear.findUnique({
            where: { companyId_name: { companyId, name: String(data.name).trim() } }
        });
        
        if (existing) {
            throw new Error(`Financial Year "${data.name}" already exists.`);
        }

        return prisma.financialYear.create({
            data: {
                companyId,
                name: String(data.name).trim(),
                startDate,
                endDate,
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
    static async updateYear(id: string, data: { name?: string; startDate?: Date | string; endDate?: Date | string; isOpen?: boolean }) {
        const updateData: any = { ...data };

        if (data.startDate) {
            const sd = new Date(data.startDate);
            if (!isNaN(sd.getTime())) updateData.startDate = sd;
        }

        if (data.endDate) {
            const ed = new Date(data.endDate);
            if (!isNaN(ed.getTime())) updateData.endDate = ed;
        }

        return prisma.financialYear.update({
            where: { id },
            data: updateData
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
