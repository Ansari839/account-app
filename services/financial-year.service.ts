import { prisma } from "@/lib/prisma";

export class FinancialYearService {
    /**
     * Get the currently active financial year.
     * Caches this result in a real app, but queries DB for now.
     */
    static async getActiveYear() {
        return prisma.financialYear.findFirst({
            where: { isOpen: true },
        });
    }

    /**
     * Verify if a transaction date falls within the active financial year.
     * @param date Date of the transaction
     * @returns boolean
     */
    static async validateDate(date: Date): Promise<boolean> {
        const activeYear = await this.getActiveYear();
        if (!activeYear) return false;

        return date >= activeYear.startDate && date <= activeYear.endDate;
    }

    /**
     * Create a new financial year.
     * Ensures only one year is open at a time.
     */
    static async createYear(name: string, startDate: Date, endDate: Date) {
        // Check if any year is open
        const openYear = await this.getActiveYear();
        if (openYear) {
            throw new Error("A financial year is already open. Close it first.");
        }

        return prisma.financialYear.create({
            data: {
                name,
                startDate,
                endDate,
                isOpen: true,
            },
        });
    }
}
