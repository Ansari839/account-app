import { NextRequest, NextResponse } from "next/server";
import { AccountingController } from "@/controllers/accounting.controller";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const mockReq = { query: Object.fromEntries(searchParams) } as any;
    const mockRes = { json: (data: any) => data, status: (code: number) => ({ json: (data: any) => data }) } as any;

    try {
        const { startDate, endDate } = Object.fromEntries(searchParams);
        const data = await AccountingController.getCashFlow(mockReq, mockRes);
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
