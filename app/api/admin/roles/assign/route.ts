import { NextRequest, NextResponse } from "next/server";
import { AuthUtils } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

/**
 * POST /api/admin/roles/assign
 * Assign a role to a user.
 * Body: { userId, roleId }
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await AuthUtils.getAuthUser(req);
        if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { id: auth.userId } });
        if (!user?.isSuperAdmin) {
            return NextResponse.json({ error: "Only Super Admins can assign roles" }, { status: 403 });
        }

        const { userId, roleId } = await req.json();
        if (!userId || !roleId) {
            return NextResponse.json({ error: "userId and roleId are required" }, { status: 400 });
        }

        const userRole = await prisma.userRole.upsert({
            where: { userId_roleId: { userId, roleId } },
            update: {},
            create: { userId, roleId }
        });

        return NextResponse.json({ success: true, data: userRole });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/roles/assign
 * Remove a role from a user.
 * Body: { userId, roleId }
 */
export async function DELETE(req: NextRequest) {
    try {
        const auth = await AuthUtils.getAuthUser(req);
        if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { id: auth.userId } });
        if (!user?.isSuperAdmin) {
            return NextResponse.json({ error: "Only Super Admins can remove roles" }, { status: 403 });
        }

        const { userId, roleId } = await req.json();
        if (!userId || !roleId) {
            return NextResponse.json({ error: "userId and roleId are required" }, { status: 400 });
        }

        await prisma.userRole.deleteMany({ where: { userId, roleId } });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
