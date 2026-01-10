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
    const productId = searchParams.get('productId');
    const warehouseId = searchParams.get('warehouseId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!productId) {
        return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    try {
        const data = await ReportService.getStockLedger(
            user.companyId,
            productId,
            warehouseId ?? undefined,
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined
        );
        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
