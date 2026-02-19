import { NextResponse } from 'next/server';
import { ReportService } from "../services/report.service";
import { FinancialYearService } from "@/services/financial-year.service";
import { ClosingService } from "../services/closing.service";
import { AuthUtils } from '@/lib/auth-utils';
import prisma from "@/lib/prisma";

export class AccountingController {
    /**
     * Get Ledger Report
     */
    static async getLedger(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const { searchParams } = new URL(req.url);
            const accountId = searchParams.get('accountId');
            const startDate = searchParams.get('startDate');
            const endDate = searchParams.get('endDate');

            if (!accountId || !startDate || !endDate) {
                return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
            }

            const data = await ReportService.getLedger(
                companyId,
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const { searchParams } = new URL(req.url);
            const endDate = searchParams.get('endDate');

            if (!endDate) {
                return NextResponse.json({ success: false, error: "End date is required" }, { status: 400 });
            }

            const data = await ReportService.getTrialBalance(companyId, new Date(endDate));
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const { searchParams } = new URL(req.url);
            const startDate = searchParams.get('startDate');
            const endDate = searchParams.get('endDate');

            if (!startDate || !endDate) {
                return NextResponse.json({ success: false, error: "Start and end dates are required" }, { status: 400 });
            }

            const data = await ReportService.getProfitLoss(companyId, new Date(startDate), new Date(endDate));
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const { searchParams } = new URL(req.url);
            const endDate = searchParams.get('endDate');

            if (!endDate) {
                return NextResponse.json({ success: false, error: "End date is required" }, { status: 400 });
            }

            const data = await ReportService.getBalanceSheet(companyId, new Date(endDate));
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const { searchParams } = new URL(req.url);
            const type = searchParams.get('type');
            const endDate = searchParams.get('endDate');

            if (!type || !endDate) {
                return NextResponse.json({ success: false, error: "Type and end date are required" }, { status: 400 });
            }

            const data = await ReportService.getAgingReport(companyId, type as any, new Date(endDate));
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const { searchParams } = new URL(req.url);
            const warehouseId = searchParams.get('warehouseId');
            const productId = searchParams.get('productId');
            const variantId = searchParams.get('variantId');

            const data = await ReportService.getStockSummary(companyId, warehouseId || undefined, productId || undefined, variantId || undefined);
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const data = await ReportService.getStockItemWise(companyId);
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
            const user = await AuthUtils.getAuthUser(req);
            if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

            const { searchParams } = new URL(req.url);
            const mode = searchParams.get('mode'); // 'global' or undefined
            const role = searchParams.get('role'); // 'SALES', 'PURCHASE', etc.

            // 1. Super Admin Global View
            if (mode === 'global' && user.isSuperAdmin) {
                const data = await ReportService.getSuperAdminStats();
                return NextResponse.json({ success: true, data, type: 'GLOBAL' });
            }

            // 2. Company Context View
            // We need companyId. If user is SuperAdmin but mode is not global, they might be viewing a specific company.
            // AuthUtils.getCompanyId(req) checks headers first.
            const companyId = req.headers.get('x-company-id');

            if (!companyId) {
                // If no company selected, maybe default to global if super admin?
                if (user.isSuperAdmin) {
                    const data = await ReportService.getSuperAdminStats();
                    return NextResponse.json({ success: true, data, type: 'GLOBAL' });
                }
                return NextResponse.json({ success: false, error: 'Company ID required' }, { status: 400 });
            }

            // 3. Role-Based Stats
            let activeRole = role;

            if (!activeRole) {
                const userCompany = await prisma.userCompany.findUnique({
                    where: { userId_companyId: { userId: user.userId || user.id, companyId } }
                });
                activeRole = userCompany?.role || null;
            }

            if (activeRole && ['SALES', 'PURCHASE', 'WAREHOUSE'].includes(activeRole)) {
                const data = await ReportService.getRoleBasedStats(companyId, activeRole);
                return NextResponse.json({ success: true, data, type: 'ROLE_BASED', role: activeRole, isSuperAdmin: user.isSuperAdmin });
            }

            // 4. Default Company Admin/Owner Stats
            const data = await ReportService.getDashboardStats(companyId);
            return NextResponse.json({ success: true, data, type: 'COMPANY', isSuperAdmin: user.isSuperAdmin });

        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Get Cash Flow
     */
    static async getCashFlow(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const { searchParams } = new URL(req.url);
            const startDate = searchParams.get('startDate');
            const endDate = searchParams.get('endDate');

            if (!startDate || !endDate) {
                return NextResponse.json({ success: false, error: "Start and end dates are required" }, { status: 400 });
            }

            const data = await ReportService.getCashFlow(companyId, new Date(startDate), new Date(endDate));
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
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const { yearId, closingDate, pnlAccountId, retainedEarningsAccountId } = await req.json();
            const result = await ClosingService.performYearClosing(
                companyId,
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
    static async listYears(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const years = await FinancialYearService.listYears(companyId);
            return NextResponse.json({ success: true, data: years });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
    static async getConsolidatedTrialBalance(req: Request) {
        try {
            const user = await AuthUtils.getAuthUser(req);
            if (!user || !user.isSuperAdmin) {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
            }

            const { searchParams } = new URL(req.url);
            const endDate = searchParams.get('endDate');

            if (!endDate) {
                return NextResponse.json({ success: false, error: "End date is required" }, { status: 400 });
            }

            const data = await ReportService.getConsolidatedTrialBalance(new Date(endDate));
            return NextResponse.json({ success: true, data });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async getConsolidatedProfitLoss(req: Request) {
        try {
            const user = await AuthUtils.getAuthUser(req);
            if (!user || !user.isSuperAdmin) {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
            }

            const { searchParams } = new URL(req.url);
            const startDate = searchParams.get('startDate');
            const endDate = searchParams.get('endDate');

            if (!startDate || !endDate) {
                return NextResponse.json({ success: false, error: "Start and End date required" }, { status: 400 });
            }

            const data = await ReportService.getConsolidatedProfitLoss(new Date(startDate), new Date(endDate));
            return NextResponse.json({ success: true, data });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async getConsolidatedBalanceSheet(req: Request) {
        try {
            const user = await AuthUtils.getAuthUser(req);
            if (!user || !user.isSuperAdmin) {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
            }

            const { searchParams } = new URL(req.url);
            const endDate = searchParams.get('endDate');

            if (!endDate) {
                return NextResponse.json({ success: false, error: "End date is required" }, { status: 400 });
            }

            const data = await ReportService.getConsolidatedBalanceSheet(new Date(endDate));
            return NextResponse.json({ success: true, data });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}
