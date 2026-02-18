import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";
import { AuditService } from "./audit.service";

export class AuthService {
    /**
     * Authenticate a user and return a token + assigned companies.
     * JWT no longer contains companyId — company is selected dynamically.
     */
    static async login(email: string, password: string, ipAddress?: string): Promise<{
        token: string;
        user: any;
        companies: any[];
    } | null> {
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

        // Fetch user's assigned companies with roles
        const userCompanies = await prisma.userCompany.findMany({
            where: { userId: user.id },
            include: {
                company: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        logo: true,
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        // If user has no UserCompany entries, fallback to their default companyId
        let companies = userCompanies.map(uc => ({
            id: uc.company.id,
            name: uc.company.name,
            email: uc.company.email,
            phone: uc.company.phone,
            logo: uc.company.logo,
            role: uc.role,
            isDefault: uc.isDefault,
        }));

        // Fallback: if no UserCompany entries but user has companyId, include that
        if (companies.length === 0 && user.companyId) {
            const fallbackCompany = await prisma.company.findUnique({
                where: { id: user.companyId },
                select: { id: true, name: true, email: true, phone: true, logo: true }
            });
            if (fallbackCompany) {
                companies = [{
                    ...fallbackCompany,
                    role: 'ADMIN' as const,
                    isDefault: true,
                }];
            }
        }

        // Generate Token — NO companyId in JWT, just user identity
        const token = await AuthUtils.signToken({
            userId: user.id,
            email: user.email,
            isSuperAdmin: user.isSuperAdmin || false,
            mustChangePass: user.mustChangePass,
        });

        // Audit Log
        await AuditService.log(user.id, "LOGIN", "AUTH", undefined, undefined, { ipAddress });

        // Update Last Login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                isSuperAdmin: user.isSuperAdmin || false,
            },
            companies,
        };
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
                mustChangePass: false,
            },
        });

        await AuditService.log(userId, "CHANGE_PASSWORD", "AUTH");
    }

    /**
     * Verify that a user has access to a specific company.
     */
    static async verifyCompanyAccess(userId: string, companyId: string): Promise<{
        hasAccess: boolean;
        role?: string;
    }> {
        // Super admins have access to all companies
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user?.isSuperAdmin) {
            return { hasAccess: true, role: 'SUPER_ADMIN' };
        }

        const userCompany = await prisma.userCompany.findUnique({
            where: { userId_companyId: { userId, companyId } }
        });

        if (userCompany) {
            return { hasAccess: true, role: userCompany.role };
        }

        // Fallback: check user.companyId
        if (user?.companyId === companyId) {
            return { hasAccess: true, role: 'ADMIN' };
        }

        return { hasAccess: false };
    }
}
