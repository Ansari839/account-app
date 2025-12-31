import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

export class FinancialYearService {
    /**
     * Create a new Financial Year
     */
    static async createYear(data: {
        name: string;
        startDate: Date;
        endDate: Date;
    }) {
        return await prisma.financialYear.create({
            data: {
                name: data.name,
                startDate: data.startDate,
                endDate: data.endDate,
                isOpen: true
            }
        });
    }

    /**
     * Get the active financial year for a given date
     */
    static async getActiveYear(date: Date = new Date()) {
        const year = await prisma.financialYear.findFirst({
            where: {
                startDate: { lte: date },
                endDate: { gte: date },
                isOpen: true,
                lockedAt: null
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!year) {
            throw new Error(`No active Financial Year found for date: ${date.toDateString()}`);
        }

        return year;
    }

    /**
     * Terminate/Close a Year (Soft Close)
     */
    static async closeYear(id: string) {
        return await prisma.financialYear.update({
            where: { id },
            data: { isOpen: false, lockedAt: new Date() }
        });
    }

    /**
     * List all financial years
     */
    static async listYears() {
        return await prisma.financialYear.findMany({
            orderBy: { startDate: 'desc' }
        });
    }
}
