import { NextRequest, NextResponse } from "next/server";
import { AuthUtils } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/roles/company-users?companyId=xxx
 * Returns all users in a company with their assigned RBAC roles.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await AuthUtils.getAuthUser(req);
        if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const companyId = req.nextUrl.searchParams.get('companyId');
        if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });

        // Get all users linked to this company
        const userCompanies = await prisma.userCompany.findMany({
            where: { companyId },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        isSuperAdmin: true,
                        isActive: true,
                        lastLoginAt: true,
                        roles: {
                            include: {
                                role: {
                                    select: {
                                        id: true,
                                        name: true,
                                        description: true,
                                        companyId: true,
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Get all roles for this company
        const companyRoles = await prisma.role.findMany({
            where: { companyId, deletedAt: null },
            include: {
                _count: { select: { permissions: true } }
            },
            orderBy: { name: 'asc' }
        });

        const users = userCompanies.map(uc => {
            // Filter user's roles to only this company's roles
            const companyUserRoles = uc.user.roles
                .filter(ur => ur.role.companyId === companyId || ur.role.companyId === null)
                .map(ur => ({
                    userRoleId: ur.id,
                    roleId: ur.role.id,
                    roleName: ur.role.name,
                    roleDescription: ur.role.description,
                }));

            return {
                id: uc.user.id,
                fullName: uc.user.fullName,
                email: uc.user.email,
                isSuperAdmin: uc.user.isSuperAdmin,
                isActive: uc.user.isActive,
                lastLoginAt: uc.user.lastLoginAt,
                companyRole: uc.role, // The simple OWNER/ADMIN/USER string from UserCompany
                assignedRoles: companyUserRoles, // RBAC roles
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                users,
                roles: companyRoles.map(r => ({
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    permissionCount: r._count.permissions,
                })),
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
