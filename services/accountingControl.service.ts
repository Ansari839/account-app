import prisma from "@/lib/prisma";
import { CompanySettingsService } from "./settings.service";

export class AccountingControlService {
    /**
     * Check if a specific date is locked for transactions
     */
    static async isDateLocked(companyId: string, date: Date) {
        const lockDateStr = await CompanySettingsService.get(companyId, "FINANCE_LOCK_DATE");
        if (!lockDateStr) return false;

        const lockDate = new Date(lockDateStr);
        return date <= lockDate; // Locked if on or before lock date
    }

    /**
     * Check if a voucher can be edited based on its creation time
     */
    static async isEditWindowOpen(companyId: string, createdAt: Date) {
        const windowHours = parseInt(await CompanySettingsService.get(companyId, "VOUCHER_EDIT_WINDOW_HOURS") || "24");
        const now = new Date();
        const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

        return diffHours <= windowHours;
    }

    /**
     * Validate a transaction against all controls
     */
    static async validateTransaction(companyId: string, date: Date, voucherId?: string) {
        // 1. Check Date Lock
        if (await this.isDateLocked(companyId, date)) {
            throw new Error(`Transaction date ${date.toDateString()} is within a locked period.`);
        }

        // 2. Check Edit Window if it's an update
        if (voucherId) {
            const voucher = await prisma.journalEntry.findUnique({ where: { id: voucherId } });
            if (voucher && !(await this.isEditWindowOpen(companyId, voucher.createdAt))) {
                throw new Error("Voucher edit window has closed.");
            }
        }

        return true;
    }
}
