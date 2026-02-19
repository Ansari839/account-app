import { NextRequest, NextResponse } from "next/server";
import { ReportService } from "@/services/report.service";
import { AuthUtils } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
    const { companyId, error } = AuthUtils.getCompanyId(req);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const warehouseId = searchParams.get('warehouseId');
    const variantId = searchParams.get('variantId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!productId) {
        return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    try {
        const data = await ReportService.getStockLedger(
            companyId,
            productId,
            warehouseId ?? undefined,
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined,
            variantId ?? undefined
        );
        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
