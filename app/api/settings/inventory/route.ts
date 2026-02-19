import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { AuthUtils } from '@/lib/auth-utils';

// GET /api/settings/inventory
export async function GET(req: Request) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const settings = await prisma.companySetting.findMany({
            where: {
                companyId,
                key: { in: ['INVENTORY_GRN_MANDATORY', 'INVENTORY_DO_MANDATORY'] }
            }
        });

        const data: any = {};
        settings.forEach(s => data[s.key] = s.value);

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST /api/settings/inventory
export async function POST(req: Request) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const body = await req.json();
        const { INVENTORY_GRN_MANDATORY, INVENTORY_DO_MANDATORY } = body;

        // Upsert settings per company
        await prisma.companySetting.upsert({
            where: { companyId_key: { companyId, key: 'INVENTORY_GRN_MANDATORY' } },
            create: { companyId, key: 'INVENTORY_GRN_MANDATORY', value: String(INVENTORY_GRN_MANDATORY), type: 'BOOLEAN', group: 'INVENTORY' },
            update: { value: String(INVENTORY_GRN_MANDATORY) }
        });

        await prisma.companySetting.upsert({
            where: { companyId_key: { companyId, key: 'INVENTORY_DO_MANDATORY' } },
            create: { companyId, key: 'INVENTORY_DO_MANDATORY', value: String(INVENTORY_DO_MANDATORY), type: 'BOOLEAN', group: 'INVENTORY' },
            update: { value: String(INVENTORY_DO_MANDATORY) }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
