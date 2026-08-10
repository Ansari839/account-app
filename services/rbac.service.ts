import prisma from "@/lib/prisma";

export class RBACService {
    /**
     * Check if a user has a specific permission.
     * Super Admins always have all permissions.
     */
    static async hasPermission(
        userId: string,
        companyId: string,
        module: string,
        action: 'read' | 'write' | 'delete' | 'finance'
    ): Promise<boolean> {
        // Super admins bypass all permission checks
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isSuperAdmin: true },
        });

        if (!user) return false;
        if (user.isSuperAdmin) return true;

        const perm = await prisma.userPermission.findUnique({
            where: {
                userId_companyId_module: {
                    userId,
                    companyId,
                    module
                }
            }
        });

        if (!perm) return false;
        
        if (action === 'read') return perm.canRead;
        if (action === 'write') return perm.canWrite;
        if (action === 'delete') return perm.canDelete;
        if (action === 'finance') return perm.canViewFinance;

        return false;
    }

    /**
     * Get all permissions for a user within a company.
     * Returns a map of modules and their permissions.
     */
    static async getUserPermissions(
        userId: string,
        companyId: string
    ): Promise<Record<string, { canRead: boolean; canWrite: boolean; canDelete: boolean; canViewFinance: boolean }>> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isSuperAdmin: true },
        });

        if (!user) return {};

        // For super admin, we could return a proxy that always returns true, 
        // but it's better to just check `isSuperAdmin` at the component level.
        // For simplicity, we just return actual stored permissions here.
        // The middleware/UI should handle isSuperAdmin overrides.

        const perms = await prisma.userPermission.findMany({
            where: { userId, companyId }
        });

        const result: Record<string, { canRead: boolean; canWrite: boolean; canDelete: boolean; canViewFinance: boolean }> = {};
        for (const p of perms) {
            result[p.module] = {
                canRead: p.canRead,
                canWrite: p.canWrite,
                canDelete: p.canDelete,
                canViewFinance: p.canViewFinance
            };
        }

        return result;
    }
}
