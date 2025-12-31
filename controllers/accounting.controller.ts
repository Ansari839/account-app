import { NextResponse } from 'next/server';
import { ReportService } from "../services/report.service";
import { FinancialYearService } from "../services/financialYear.service";
import { ClosingService } from "../services/closing.service";

export class AccountingController {
    /**
     * Get Ledger Report
     */
    static async getLedger(req: Request) {
        try {
            const { searchParams } = new URL(req.url);
            const accountId = searchParams.get('accountId');
            const startDate = searchParams.get('startDate');
            const endDate = searchParams.get('endDate');

            if (!accountId || !startDate || !endDate) {
                return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
            }

            const data = await ReportService.getLedger(
                accountId,
                new Date(startDate),
                new Date(endDate)
            );
            return NextResponse.json({ success: true, data });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Get Trial Balance
     */
    static async getTrialBalance(req: Request) {
        try {
            const { searchParams } = new URL(req.url);
            const endDate = searchParams.get('endDate');

            if (!endDate) {
                return NextResponse.json({ success: false, error: "End date is required" }, { status: 400 });
            }

            const data = await ReportService.getTrialBalance(new Date(endDate));
            return NextResponse.json({ success: true, data });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Get Profit & Loss
     */
    static async getProfitLoss(req: Request) {
        try {
            const { searchParams } = new URL(req.url);
            const startDate = searchParams.get('startDate');
            const endDate = searchParams.get('endDate');

            if (!startDate || !endDate) {
                return NextResponse.json({ success: false, error: "Start and end dates are required" }, { status: 400 });
            }

            const data = await ReportService.getProfitLoss(new Date(startDate), new Date(endDate));
            return NextResponse.json({ success: true, data });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Get Balance Sheet
     */
    static async getBalanceSheet(req: Request) {
        try {
            const { searchParams } = new URL(req.url);
            const endDate = searchParams.get('endDate');

            if (!endDate) {
                return NextResponse.json({ success: false, error: "End date is required" }, { status: 400 });
            }

            const data = await ReportService.getBalanceSheet(new Date(endDate));
            return NextResponse.json({ success: true, data });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Get Aging Report
     */
    static async getAgingReport(req: Request) {
        try {
            const { searchParams } = new URL(req.url);
            const type = searchParams.get('type');
            const endDate = searchParams.get('endDate');

            if (!type || !endDate) {
                return NextResponse.json({ success: false, error: "Type and end date are required" }, { status: 400 });
            }

            const data = await ReportService.getAgingReport(type as any, new Date(endDate));
            return NextResponse.json({ success: true, data });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Get Stock Summary
     */
    static async getStockSummary(req: Request) {
        try {
            const { searchParams } = new URL(req.url);
            const warehouseId = searchParams.get('warehouseId');

            const data = await ReportService.getStockSummary(warehouseId || undefined);
            return NextResponse.json({ success: true, data });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Get Dashboard Stats
     */
    static async getDashboardStats() {
        try {
            const data = await ReportService.getDashboardStats();
            return NextResponse.json({ success: true, data });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Get Cash Flow
     */
    static async getCashFlow(req: Request) {
        try {
            const { searchParams } = new URL(req.url);
            const startDate = searchParams.get('startDate');
            const endDate = searchParams.get('endDate');

            if (!startDate || !endDate) {
                return NextResponse.json({ success: false, error: "Start and end dates are required" }, { status: 400 });
            }

            const data = await ReportService.getCashFlow(new Date(startDate), new Date(endDate));
            return NextResponse.json({ success: true, data });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Close Financial Year
     */
    static async closeYear(req: Request) {
        try {
            const { yearId, closingDate, pnlAccountId, retainedEarningsAccountId } = await req.json();
            const result = await ClosingService.performYearClosing(
                yearId,
                new Date(closingDate),
                pnlAccountId,
                retainedEarningsAccountId
            );
            return NextResponse.json({ success: true, data: result });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Get All Financial Years
     */
    static async listYears() {
        try {
            const years = await FinancialYearService.listYears();
            return NextResponse.json({ success: true, data: years });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}
