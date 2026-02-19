import { NextRequest, NextResponse } from "next/server";
import { AuthUtils } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/roles?companyId=xxx
 * Returns all roles for a company with their permissions.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await AuthUtils.getAuthUser(req);
        if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const companyId = req.nextUrl.searchParams.get('companyId');
        if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });

        const roles = await prisma.role.findMany({
            where: { companyId, deletedAt: null },
            include: {
                permissions: {
                    include: { permission: true }
                },
                users: {
                    include: { user: { select: { id: true, fullName: true, email: true } } }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Also return all available permissions
        const allPermissions = await prisma.permission.findMany({
            orderBy: [{ module: 'asc' }, { action: 'asc' }]
        });

        return NextResponse.json({
            success: true,
            data: {
                roles: roles.map(r => ({
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    permissions: r.permissions.map(rp => ({
                        id: rp.permission.id,
                        key: `${rp.permission.module}.${rp.permission.action}`,
                        module: rp.permission.module,
                        action: rp.permission.action,
                        description: rp.permission.description,
                    })),
                    users: r.users.map(u => u.user),
                    userCount: r.users.length,
                })),
                allPermissions: allPermissions.map(p => ({
                    id: p.id,
                    key: `${p.module}.${p.action}`,
                    module: p.module,
                    action: p.action,
                    description: p.description,
                })),
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/admin/roles
 * Create or update a role with permissions.
 * Body: { companyId, name, description, permissionIds: string[] }
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await AuthUtils.getAuthUser(req);
        if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Check super admin
        const user = await prisma.user.findUnique({ where: { id: auth.userId } });
        if (!user?.isSuperAdmin) {
            return NextResponse.json({ error: "Only Super Admins can manage roles" }, { status: 403 });
        }

        const { companyId, name, description, permissionIds, roleId } = await req.json();
        if (!companyId || !name) {
            return NextResponse.json({ error: "companyId and name are required" }, { status: 400 });
        }

        let role;
        if (roleId) {
            // Update existing role
            role = await prisma.role.update({
                where: { id: roleId },
                data: { name, description }
            });
        } else {
            // Create new role
            role = await prisma.role.upsert({
                where: { companyId_name: { companyId, name } },
                update: { description },
                create: { name, description, companyId }
            });
        }

        // Update permissions: clear old and add new
        if (permissionIds && Array.isArray(permissionIds)) {
            await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
            for (const permId of permissionIds) {
                await prisma.rolePermission.create({
                    data: { roleId: role.id, permissionId: permId }
                });
            }
        }

        return NextResponse.json({ success: true, data: role });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
