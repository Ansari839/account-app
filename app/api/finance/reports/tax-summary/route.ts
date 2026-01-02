import { NextRequest, NextResponse } from "next/server";
import { ReportService } from "@/services/report.service";
import { AuthUtils } from '@/lib/auth-utils';

async function getAuthUser(req: Request) {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) return null;
    return AuthUtils.verifyToken(token);
}

export async function GET(req: NextRequest) {
    const user = await getAuthUser(req);
    if (!user?.companyId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
        return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
    }

    try {
        const data = await ReportService.getTaxSummary(user.companyId, new Date(startDate), new Date(endDate));
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
