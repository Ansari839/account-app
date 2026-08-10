import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

export class UserService {
    /**
     * Create a new user with default password
     */
    static async createUser(data: { email: string; fullName?: string; isSuperAdmin?: boolean }) {
        // Default password is 'Welcome@123'
        const passwordHash = await bcrypt.hash("Welcome@123", 10);

        return await prisma.user.create({
            data: {
                email: data.email,
                fullName: data.fullName,
                passwordHash,
                mustChangePass: true,
                isSuperAdmin: data.isSuperAdmin || false
            }
        });
    }

    /**
     * Update user status or properties
     */
    static async updateUser(userId: string, data: { fullName?: string; isActive?: boolean; isSuperAdmin?: boolean }) {
        return await prisma.user.update({
            where: { id: userId },
            data
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
     * List Users
     */
    static async listUsers() {
        return await prisma.user.findMany({
            where: { deletedAt: null },
            include: { companies: true, permissions: true }
        });
    }
}
