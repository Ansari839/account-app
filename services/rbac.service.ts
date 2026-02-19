import prisma from "@/lib/prisma";

export class RBACService {
    /**
     * Check if a user has a specific permission via their roles.
     * Super Admins always have all permissions.
     */
    static async hasPermission(
        userId: string,
        module: string,
        action: string
    ): Promise<boolean> {
        // Super admins bypass all permission checks
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isSuperAdmin: true, roles: { select: { roleId: true } } },
        });

        if (!user) return false;
        if (user.isSuperAdmin) return true;
        if (user.roles.length === 0) return false;

        const roleIds = user.roles.map((r) => r.roleId);

        // Check if any role has the required permission
        const count = await prisma.rolePermission.count({
            where: {
                roleId: { in: roleIds },
                permission: {
                    module: module,
                    action: action,
                },
            },
        });

        return count > 0;
    }

    /**
     * Get all permission keys for a user (e.g., ["SALES.VIEW", "SALES.CREATE", ...])
     * Optionally scoped to a company's roles.
     */
    static async getUserPermissions(
        userId: string,
        companyId?: string
    ): Promise<string[]> {
        // Super admins get all permissions
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isSuperAdmin: true },
        });

        if (user?.isSuperAdmin) {
            const allPerms = await prisma.permission.findMany();
            return allPerms.map(p => `${p.module}.${p.action}`);
        }

        // Get ALL role IDs for this user
        const userRoles = await prisma.userRole.findMany({
            where: { userId },
            include: { role: true },
        });

        // If companyId is provided, filter roles to that company only
        let roleIds: string[];
        if (companyId) {
            roleIds = userRoles
                .filter(ur => ur.role.companyId === companyId || ur.role.companyId === null)
                .map(ur => ur.roleId);
        } else {
            roleIds = userRoles.map(ur => ur.roleId);
        }

        if (roleIds.length === 0) return [];

        // Get all permissions linked to these roles
        const rolePermissions = await prisma.rolePermission.findMany({
            where: { roleId: { in: roleIds } },
            include: { permission: true },
        });

        // Deduplicate
        const permSet = new Set<string>();
        for (const rp of rolePermissions) {
            permSet.add(`${rp.permission.module}.${rp.permission.action}`);
        }

        return Array.from(permSet);
    }
}
