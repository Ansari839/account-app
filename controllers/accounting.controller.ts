import { NextResponse } from 'next/server';
import { ReportService } from "../services/report.service";
import { FinancialYearService } from "@/services/financial-year.service";
import { ClosingService } from "../services/closing.service";

import { AuthUtils } from '@/lib/auth-utils';

async function getAuthUser(req: Request) {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) return null;
    return AuthUtils.verifyToken(token);
}

export class AccountingController {
    /**
     * Get Ledger Report
     */
    static async getLedger(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const { searchParams } = new URL(req.url);
            const accountId = searchParams.get('accountId');
            const startDate = searchParams.get('startDate');
            const endDate = searchParams.get('endDate');

            if (!accountId || !startDate || !endDate) {
                return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
            }

            const data = await ReportService.getLedger(
                user.companyId,
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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const { searchParams } = new URL(req.url);
            const endDate = searchParams.get('endDate');

            if (!endDate) {
                return NextResponse.json({ success: false, error: "End date is required" }, { status: 400 });
            }

            const data = await ReportService.getTrialBalance(user.companyId, new Date(endDate));
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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const { searchParams } = new URL(req.url);
            const startDate = searchParams.get('startDate');
            const endDate = searchParams.get('endDate');

            if (!startDate || !endDate) {
                return NextResponse.json({ success: false, error: "Start and end dates are required" }, { status: 400 });
            }

            const data = await ReportService.getProfitLoss(user.companyId, new Date(startDate), new Date(endDate));
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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const { searchParams } = new URL(req.url);
            const endDate = searchParams.get('endDate');

            if (!endDate) {
                return NextResponse.json({ success: false, error: "End date is required" }, { status: 400 });
            }

            const data = await ReportService.getBalanceSheet(user.companyId, new Date(endDate));
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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const { searchParams } = new URL(req.url);
            const type = searchParams.get('type');
            const endDate = searchParams.get('endDate');

            if (!type || !endDate) {
                return NextResponse.json({ success: false, error: "Type and end date are required" }, { status: 400 });
            }

            const data = await ReportService.getAgingReport(user.companyId, type as any, new Date(endDate));
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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const { searchParams } = new URL(req.url);
            const warehouseId = searchParams.get('warehouseId');

            const data = await ReportService.getStockSummary(user.companyId, warehouseId || undefined);
            return NextResponse.json({ success: true, data });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Get Stock Item Wise
     */
    static async getStockItemWise(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const data = await ReportService.getStockItemWise(user.companyId);
            return NextResponse.json({ success: true, data });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Get Dashboard Stats
     */
    static async getDashboardStats(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const data = await ReportService.getDashboardStats(user.companyId);
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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const { searchParams } = new URL(req.url);
            const startDate = searchParams.get('startDate');
            const endDate = searchParams.get('endDate');

            if (!startDate || !endDate) {
                return NextResponse.json({ success: false, error: "Start and end dates are required" }, { status: 400 });
            }

            const data = await ReportService.getCashFlow(user.companyId, new Date(startDate), new Date(endDate));
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
            const user = await getAuthUser(req);
            if (user?.role !== 'ADMIN') return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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
