import { NextRequest, NextResponse } from "next/server";
import { AccountingController } from "@/controllers/accounting.controller";

export async function POST(req: NextRequest) {
    try {
        const data = await AccountingController.closeYear(req);
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
