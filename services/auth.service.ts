import { prisma } from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";
import { AuditService } from "./audit.service";

export class AuthService {
    /**
     * Authenticate a user and return a token.
     */
    static async login(email: string, password: string, ipAddress?: string): Promise<{ token: string; user: any } | null> {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user || !user.isActive) {
            return null;
        }

        const isValid = await AuthUtils.comparePassword(password, user.passwordHash);
        if (!isValid) {
            return null;
        }

        // Generate Token
        const token = await AuthUtils.signToken({
            userId: user.id,
            email: user.email,
            mustChangePass: user.mustChangePass,
        });

        // Audit Log
        await AuditService.logAction({
            userId: user.id,
            action: "LOGIN",
            module: "AUTH",
            ipAddress,
        });

        // Update Last Login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        return { token, user };
    }

    /**
     * Change password and unlock account if it was locked due to first login.
     */
    static async changePassword(userId: string, newPass: string) {
        const hash = await AuthUtils.hashPassword(newPass);

        await prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash: hash,
                mustChangePass: false, // Unlock user
            },
        });

        await AuditService.logAction({
            userId,
            action: "CHANGE_PASSWORD",
            module: "AUTH",
        });
    }
}
