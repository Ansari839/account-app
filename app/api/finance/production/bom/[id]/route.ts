import { NextRequest, NextResponse } from "next/server";
import { AuthUtils } from "@/lib/auth-utils";
import { BOMService } from "@/services/bom.service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(request);
        if (error) return error;

        const resolvedParams = await params;
        const template = await BOMService.getById(companyId!, resolvedParams.id);
        if (!template) {
            return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: template });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(request);
        if (error) return error;

        const body = await request.json();
        const resolvedParams = await params;
        const template = await BOMService.update(companyId!, resolvedParams.id, body);
        return NextResponse.json({ success: true, data: template });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(request);
        if (error) return error;

        const resolvedParams = await params;
        await BOMService.delete(companyId!, resolvedParams.id);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
