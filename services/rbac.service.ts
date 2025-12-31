import { prisma } from "@/lib/prisma";

export class RBACService {
    /**
     * Check if a user has a specific permission via their roles.
     * 
     * @param userId - ID of the user
     * @param module - Target module (e.g. INVOICE)
     * @param action - Action performed (e.g. CREATE)
     */
    static async hasPermission(
        userId: string,
        module: string,
        action: string
    ): Promise<boolean> {
        // 1. Fetch user roles
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                roles: {
                    select: {
                        roleId: true,
                    },
                },
            },
        });

        if (!user || user.roles.length === 0) return false;

        const roleIds = user.roles.map((r) => r.roleId);

        // 2. Check if any role has the required permission
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
}
