import { NextRequest, NextResponse } from "next/server";
import { AuthUtils } from "@/lib/auth-utils";
import { BOMService } from "@/services/bom.service";

export async function GET(request: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(request);
        if (error) return error;

        const templates = await BOMService.getAll(companyId!);
        return NextResponse.json({ success: true, data: templates });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(request);
        if (error) return error;

        const body = await request.json();
        const template = await BOMService.create(companyId!, body);
        
        return NextResponse.json({ success: true, data: template });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
