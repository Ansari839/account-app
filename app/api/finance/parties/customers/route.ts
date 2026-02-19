import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const customers = await prisma.customer.findMany({
            where: { companyId },
            orderBy: { name: 'asc' }
        });
        return NextResponse.json({ success: true, data: customers });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
