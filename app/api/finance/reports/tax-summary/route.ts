import { NextRequest, NextResponse } from "next/server";
import { ReportService } from "@/services/report.service";
import { AuthUtils } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
    const { companyId, error } = AuthUtils.getCompanyId(req);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
        return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
    }

    try {
        const data = await ReportService.getTaxSummary(companyId, new Date(startDate), new Date(endDate));
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
