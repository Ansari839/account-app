import { NextRequest, NextResponse } from "next/server";
import { AuthUtils } from "@/lib/auth-utils";
import { ProductionService } from "@/services/production.service";

export async function GET(request: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(request);
        if (error) return error;

        const records = await ProductionService.getAll(companyId!);
        return NextResponse.json({ success: true, data: records });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(request);
        if (error) return error;

        const user: any = await AuthUtils.getAuthUser(request);
        const userId = user?.id || "system";

        const body = await request.json();
        const production = await ProductionService.create(companyId!, userId, body);
        
        return NextResponse.json({ success: true, data: production });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
