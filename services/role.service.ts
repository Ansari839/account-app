import prisma from "@/lib/prisma";

export class RoleService {
    /**
     * Create or update a Role
     */
    static async upsertRole(name: string, description?: string, permissions?: string[], companyId: string | null = null) {
        return await prisma.role.upsert({
            where: {
                companyId_name: {
                    name,
                    companyId: companyId as string // forced cast if nullable, or handle null specific logic if Prisma generates optional fields differently
                }
            },
            update: {
                description,
                permissions: permissions ? {
                    deleteMany: {},
                    create: permissions.map(pId => ({ permissionId: pId }))
                } : undefined
            },
            create: {
                name,
                companyId,
                description,
                permissions: permissions ? {
                    create: permissions.map(pId => ({ permissionId: pId }))
                } : undefined
            }
        });
    }

    /**
     * Get all roles with permissions
     */
    static async listRoles() {
        return await prisma.role.findMany({
            include: { permissions: { include: { permission: true } } }
        });
    }

    /**
     * Get all available permissions
     */
    static async listPermissions() {
        return await prisma.permission.findMany();
    }
}
