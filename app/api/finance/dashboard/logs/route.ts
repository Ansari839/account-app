import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        // Fetch BP, BR, CP, CR vouchers (Bank Payment, Bank Receipt, Cash Payment, Cash Receipt)
        const logs = await prisma.journalEntry.findMany({
            where: {
                companyId,
                type: { in: ['PAYMENT', 'RECEIPT'] }
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                createdBy: {
                    select: { fullName: true, email: true }
                },
                lines: {
                    include: { Account: true }
                }
            }
        });

        const mappedLogs = logs.map((log: any) => ({
            ...log,
            lines: (log.lines || []).map((l: any) => ({
                ...l,
                account: l.Account || l.account
            }))
        }));

        return NextResponse.json({ success: true, data: mappedLogs });
    } catch (err: any) {
        console.error("GET /api/finance/dashboard/logs ERROR:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
