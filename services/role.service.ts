import prisma from "@/lib/prisma";

export class RoleService {
    /**
     * Create or update a Role
     */
    static async upsertRole(name: string, description?: string, permissions?: string[]) {
        return await prisma.role.upsert({
            where: { name },
            update: {
                description,
                permissions: permissions ? {
                    deleteMany: {},
                    create: permissions.map(pId => ({ permissionId: pId }))
                } : undefined
            },
            create: {
                name,
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
