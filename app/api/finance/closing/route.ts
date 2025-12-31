import { NextRequest, NextResponse } from "next/server";
import { AccountingController } from "@/controllers/accounting.controller";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const mockReq = { body } as any;
        const mockRes = { json: (data: any) => data, status: (code: number) => ({ json: (data: any) => data }) } as any;

        const data = await AccountingController.closeYear(mockReq, mockRes);
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
