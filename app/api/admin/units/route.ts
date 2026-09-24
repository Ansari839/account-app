import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const units = await prisma.unit.findMany({
            where: { companyId },
            orderBy: { name: 'asc' }
        });
        return NextResponse.json({ success: true, data: units });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch units' }, { status: 500 });
    }
}
