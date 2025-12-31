import { Request, Response } from "express";
import { ReportService } from "../services/report.service";
import { FinancialYearService } from "../services/financialYear.service";
import { ClosingService } from "../services/closing.service";

export class AccountingController {
    /**
     * Get Ledger Report
     */
    static async getLedger(req: Request, res: Response) {
        try {
            const { accountId, startDate, endDate } = req.query;
            const data = await ReportService.getLedger(
                accountId as string,
                new Date(startDate as string),
                new Date(endDate as string)
            );
            res.json(data);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get Trial Balance
     */
    static async getTrialBalance(req: Request, res: Response) {
        try {
            const { endDate } = req.query;
            const data = await ReportService.getTrialBalance(new Date(endDate as string));
            res.json(data);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Close Financial Year
     */
    static async closeYear(req: Request, res: Response) {
        try {
            const { yearId, closingDate, pnlAccountId, retainedEarningsAccountId } = req.body;
            const result = await ClosingService.performYearClosing(
                yearId,
                new Date(closingDate),
                pnlAccountId,
                retainedEarningsAccountId
            );
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get All Financial Years
     */
    static async listYears(req: Request, res: Response) {
        try {
            const years = await FinancialYearService.listYears();
            res.json(years);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
