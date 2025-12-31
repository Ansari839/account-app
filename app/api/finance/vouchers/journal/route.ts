import { NextRequest, NextResponse } from "next/server";
import { VoucherController } from "@/controllers/voucher.controller";

export async function GET(req: NextRequest) {
    try {
        const mockRes = { json: (data: any) => data, status: (code: number) => ({ json: (data: any) => data }) } as any;
        const data = await VoucherController.listJournals({} as any, mockRes);
        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const mockReq = { body } as any;
        const mockRes = { json: (data: any) => data, status: (code: number) => ({ json: (data: any) => data }) } as any;

        const data = await VoucherController.createJournal(mockReq, mockRes);
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
