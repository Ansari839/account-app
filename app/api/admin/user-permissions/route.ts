import { NextRequest, NextResponse } from "next/server";
import { AuthUtils } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const auth = await AuthUtils.getAuthUser(req);
        if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const companyId = req.nextUrl.searchParams.get('companyId');
        if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });

        // Get users and their direct permissions
        const users = await prisma.userCompany.findMany({
            where: { companyId },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        isSuperAdmin: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const allPermissions = await prisma.userPermission.findMany({
            where: { companyId }
        });

        return NextResponse.json({
            success: true,
            data: {
                users: users.map(uc => ({
                    id: uc.user.id,
                    fullName: uc.user.fullName,
                    email: uc.user.email,
                    companyRole: uc.role,
                    isSuperAdmin: uc.user.isSuperAdmin,
                    permissions: allPermissions
                        .filter(p => p.userId === uc.user.id)
                        .map(p => ({
                            module: p.module,
                            canRead: p.canRead,
                            canWrite: p.canWrite,
                            canDelete: p.canDelete,
                            canViewFinance: p.canViewFinance
                        }))
                }))
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await AuthUtils.getAuthUser(req);
        if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { companyId, userId, modules, action, value } = await req.json();
        
        // Verify requester has permission to modify access (must be SUPER_ADMIN or COMPANY ADMIN/OWNER)
        const requester = await prisma.user.findUnique({ where: { id: auth.userId } });
        let canManage = requester?.isSuperAdmin || false;
        
        if (!canManage) {
            const requesterCompany = await prisma.userCompany.findUnique({
                where: { userId_companyId: { userId: auth.userId, companyId } }
            });
            canManage = !!requesterCompany && (requesterCompany.role === 'ADMIN' || requesterCompany.role === 'OWNER');
        }

        if (!canManage) {
            return NextResponse.json({ error: "Only Super Admins or Company Admins can manage permissions" }, { status: 403 });
        }

        if (!companyId || !userId || !modules || !Array.isArray(modules) || !action) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Action can be: 'read', 'write', 'delete', 'finance'
        const updateData: any = {};
        if (action === 'read') updateData.canRead = value;
        if (action === 'write') updateData.canWrite = value;
        if (action === 'delete') updateData.canDelete = value;
        if (action === 'finance') updateData.canViewFinance = value;

        const results = [];
        for (const mod of modules) {
            const permission = await prisma.userPermission.upsert({
                where: {
                    userId_companyId_module: {
                        userId,
                        companyId,
                        module: mod
                    }
                },
                update: updateData,
                create: {
                    userId,
                    companyId,
                    module: mod,
                    ...updateData
                }
            });
            results.push(permission);
        }

        return NextResponse.json({ success: true, data: results });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
