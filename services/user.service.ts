import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

export class UserService {
    /**
     * Create a new user with default password
     */
    static async createUser(data: { email: string; fullName?: string; roles: string[] }) {
        // Default password is 'Welcome@123'
        const passwordHash = await bcrypt.hash("Welcome@123", 10);

        return await prisma.user.create({
            data: {
                email: data.email,
                fullName: data.fullName,
                passwordHash,
                mustChangePass: true,
                roles: {
                    create: data.roles.map(roleId => ({ roleId }))
                }
            },
            include: { roles: { include: { role: true } } }
        });
    }

    /**
     * Update user roles or status
     */
    static async updateUser(userId: string, data: { fullName?: string; isActive?: boolean; roles?: string[] }) {
        const updateData: any = { ...data };
        delete updateData.roles;

        if (data.roles) {
            // Replace existing roles
            await prisma.userRole.deleteMany({ where: { userId } });
            updateData.roles = {
                create: data.roles.map(roleId => ({ roleId }))
            };
        }

        return await prisma.user.update({
            where: { id: userId },
            data: updateData,
            include: { roles: { include: { role: true } } }
        });
    }

    /**
     * Force Password Change
     */
    static async changePassword(userId: string, newPass: string) {
        const passwordHash = await bcrypt.hash(newPass, 10);
        return await prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash,
                mustChangePass: false
            }
        });
    }

    /**
     * List Users with Roles
     */
    static async listUsers() {
        return await prisma.user.findMany({
            where: { deletedAt: null },
            include: { roles: { include: { role: true } } }
        });
    }
}
