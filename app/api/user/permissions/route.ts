import { NextRequest, NextResponse } from "next/server";
import { AuthUtils } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { CompanySettingsService } from "@/services/settings.service";

/**
 * GET /api/user/permissions?companyId=xxx
 * Returns the current user's permission keys for the given company.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await AuthUtils.getAuthUser(req);
        if (!auth) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // JWT payload uses 'userId' field
        const userId = auth.userId || auth.id || auth.sub;
        if (!userId) {
            return NextResponse.json({ success: false, error: "Invalid token payload" }, { status: 401 });
        }

        const companyId = req.nextUrl.searchParams.get("companyId");
        if (!companyId) {
            return NextResponse.json({ success: false, error: "companyId is required" }, { status: 400 });
        }

        const isManufacturing = await CompanySettingsService.getBoolean(companyId, "ENABLE_MANUFACTURING", false);

        // SuperAdmin gets ALL_ACCESS
        if (auth.isSuperAdmin) {
            return NextResponse.json({ success: true, data: ['ALL_ACCESS'], isManufacturing });
        }

        const userCompany = await prisma.userCompany.findFirst({
            where: { userId, companyId }
        });

        if (userCompany && (userCompany.role === 'ADMIN' || userCompany.role === 'OWNER')) {
            return NextResponse.json({ success: true, data: ['ALL_ACCESS'], isManufacturing });
        }

        const perms = await prisma.userPermission.findMany({
            where: { userId, companyId }
        });

        const permissionKeys: string[] = [];
        for (const p of perms) {
            if (p.canRead) permissionKeys.push(`${p.module}.VIEW`);
            if (p.canWrite) permissionKeys.push(`${p.module}.CREATE`);
            if (p.canDelete) permissionKeys.push(`${p.module}.DELETE`);
            if (p.canViewFinance) permissionKeys.push(`${p.module}.FINANCE`);
        }

        return NextResponse.json({
            success: true,
            data: permissionKeys,
            isManufacturing,
        });
    } catch (error: any) {
        console.error('[Permissions API Error]', error);
        return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
    }
}
