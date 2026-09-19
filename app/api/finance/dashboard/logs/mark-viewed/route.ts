import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        // Mark all unread payment/receipt logs as read
        const updated = await prisma.journalEntry.updateMany({
            where: {
                companyId,
                type: { in: ['PAYMENT', 'RECEIPT'] },
                isViewed: false
            },
            data: {
                isViewed: true
            }
        });

        return NextResponse.json({ success: true, count: updated.count });
    } catch (err: any) {
        console.error("POST /api/finance/dashboard/logs/mark-viewed ERROR:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
