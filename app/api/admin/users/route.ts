import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth-utils';

export async function GET(req: Request) {
    try {
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                fullName: true,
                isActive: true,
                isSuperAdmin: true,
                lastLoginAt: true,
                createdAt: true,
                companies: {
                    select: {
                        company: { select: { id: true, name: true } },
                        role: true,
                        isDefault: true
                    }
                }
            }
        });

        return NextResponse.json({ success: true, data: users });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const authUser = await AuthUtils.getAuthUser(req);
        if (!authUser || !authUser.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { email, password, fullName, isSuperAdmin } = body;

        if (!email || !password) {
            return NextResponse.json({ success: false, error: 'Email and Password are required' }, { status: 400 });
        }

        const passwordHash = await AuthUtils.hashPassword(password);

        const newUser = await prisma.user.create({
            data: {
                email,
                passwordHash,
                fullName,
                isSuperAdmin: !!isSuperAdmin,
                mustChangePass: true
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                isSuperAdmin: true,
                createdAt: true
            }
        });

        return NextResponse.json({ success: true, data: newUser });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ success: false, error: 'Email already exists' }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
