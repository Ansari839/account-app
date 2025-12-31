import { NextRequest, NextResponse } from "next/server";
import { ReportService } from "@/services/report.service";

export async function GET(req: NextRequest) {
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
            productId,
            warehouseId || undefined,
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined
        );
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
