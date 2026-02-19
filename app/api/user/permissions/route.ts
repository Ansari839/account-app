import { NextRequest, NextResponse } from "next/server";
import { AuthUtils } from "@/lib/auth-utils";
import { RBACService } from "@/services/rbac.service";

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

        const companyId = req.nextUrl.searchParams.get("companyId") || undefined;

        const permissions = await RBACService.getUserPermissions(auth.userId, companyId);

        return NextResponse.json({
            success: true,
            data: permissions,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
