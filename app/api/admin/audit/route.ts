import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth-utils';

export async function GET(req: Request) {
    try {
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const logs = await prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100, // Limit to last 100
            include: {
                User: {
                    select: { fullName: true, email: true }
                }
            }
        });

        const formatted = logs.map(l => ({
            ...l,
            user: l.User
        }));

        return NextResponse.json({ success: true, data: formatted });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
