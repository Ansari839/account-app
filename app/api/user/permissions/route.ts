import { NextRequest, NextResponse } from "next/server";
import { AuthUtils } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

/**
 * GET /api/user/permissions?companyId=xxx
 * Returns the current user's permission keys for the given company.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await AuthUtils.getAuthUser(req);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const companyId = req.nextUrl.searchParams.get("companyId");
        if (!companyId) {
            return NextResponse.json({ error: "companyId is required" }, { status: 400 });
        }

        const userCompany = await prisma.userCompany.findFirst({
            where: { userId: auth.userId, companyId }
        });

        if (userCompany && (userCompany.role === 'ADMIN' || userCompany.role === 'OWNER')) {
            return NextResponse.json({ success: true, data: ['ALL_ACCESS'] });
        }

        const perms = await prisma.userPermission.findMany({
            where: { userId: auth.userId, companyId }
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
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
