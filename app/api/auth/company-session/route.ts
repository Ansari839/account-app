import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth-utils';
import { SignJWT } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_CHANGE_ME_IN_PROD';

export async function POST(request: NextRequest) {
    try {
        const token = request.headers.get('Authorization')?.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await AuthUtils.verifyToken(token);
        if (!payload) {
            console.log('[company-session] Invalid Token');
            return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
        }
        console.log('[company-session] decoded payload:', payload);

        const { companyId } = await request.json();
        console.log('[company-session] requested companyId:', companyId);

        if (!companyId) {
            return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
        }

        const { userId, isSuperAdmin } = payload as any;

        let role = 'USER';
        let permissions: string[] | null = null;

        if (isSuperAdmin) {
            role = 'SUPER_ADMIN';
            permissions = null;
        } else {
            console.log('[company-session] checking access for:', { userId, companyId });
            let userCompany = await prisma.userCompany.findFirst({
                where: {
                    userId,
                    companyId
                }
            });
            console.log('[company-session] userCompany result:', userCompany);

            if (!userCompany) {
                // Fallback for legacy users who have companyId directly on the User table
                console.log('[company-session] checking legacy fallback for:', { userId, companyId });
                const legacyUser = await prisma.user.findFirst({
                    where: { id: userId, companyId }
                });
                console.log('[company-session] legacy fallback result:', !!legacyUser);

                if (legacyUser) {
                    userCompany = {
                        id: 'legacy',
                        userId,
                        companyId,
                        role: 'ADMIN',
                        isDefault: true,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                } else {
                    console.log('[company-session] Access Denied. No userCompany and no legacy fallback.');
                    return NextResponse.json({ error: 'User does not belong to this company' }, { status: 403 });
                }
            }

            role = userCompany.role;

            if (role === 'ADMIN' || role === 'OWNER') {
                permissions = null;
            } else {
                const userPermissions = await prisma.userPermission.findMany({
                    where: {
                        userId,
                        companyId,
                        canRead: true
                    }
                });

                permissions = userPermissions.map(p => `${p.module}.VIEW`);
            }
        }

        const secret = new TextEncoder().encode(JWT_SECRET);
        const sessionToken = await new SignJWT({ userId, companyId, role, permissions })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('8h')
            .sign(secret);

        const response = NextResponse.json({ success: true });
        response.cookies.set('__session', sessionToken, {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 8 * 60 * 60, // 8 hours
        });

        return response;

    } catch (error) {
        console.error('Company session error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
