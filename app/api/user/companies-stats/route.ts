import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth-utils';

export async function GET(req: Request) {
    try {
        const user = await AuthUtils.getAuthUser(req);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Get companies the user belongs to
        const userCompanies = await prisma.userCompany.findMany({
            where: { userId: user.id },
            select: { companyId: true }
        });

        const companyIds = userCompanies.map(uc => uc.companyId);

        const stats: Record<string, { sales: number; users: number }> = {};
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        for (const companyId of companyIds) {
            // 1. Monthly Sales
            const sales = await prisma.salesInvoice.aggregate({
                where: {
                    companyId,
                    date: { gte: startOfMonth }
                },
                _sum: { totalAmount: true }
            });

            // 2. Active Users
            const userCount = await prisma.userCompany.count({
                where: { companyId }
            });

            stats[companyId] = {
                sales: sales._sum.totalAmount?.toNumber() || 0,
                users: userCount
            };
        }

        return NextResponse.json({ success: true, data: stats });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
