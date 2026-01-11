import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth-utils';

async function getAuthUser(req: Request) {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) return null;
    return AuthUtils.verifyToken(token);
}

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user?.companyId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // Fetch suppliers from Supplier table filtered by company
        const suppliers = await prisma.supplier.findMany({
            where: {
                payableAccount: {
                    companyId: user.companyId
                }
            },
            orderBy: { name: 'asc' }
        });
        return NextResponse.json({ success: true, data: suppliers });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
