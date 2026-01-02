import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { AuthUtils } from '@/lib/auth-utils';

async function getAuthUser(req: Request) {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) return null;
    return AuthUtils.verifyToken(token);
}

// GET /api/settings/inventory
export async function GET(req: Request) {
    try {
        const user = await getAuthUser(req);
        if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

        // Retrieve settings from GlobalSetting or similar
        // For now, we will use a workaround if GlobalSetting is not heavily used yet
        // Let's assume we store them in GlobalSetting table

        const settings = await prisma.globalSetting.findMany({
            where: {
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
        const user = await getAuthUser(req);
        if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { INVENTORY_GRN_MANDATORY, INVENTORY_DO_MANDATORY } = body;

        // Upsert settings
        await prisma.globalSetting.upsert({
            where: { key: 'INVENTORY_GRN_MANDATORY' },
            create: { key: 'INVENTORY_GRN_MANDATORY', value: String(INVENTORY_GRN_MANDATORY), type: 'BOOLEAN', group: 'INVENTORY' },
            update: { value: String(INVENTORY_GRN_MANDATORY) }
        });

        await prisma.globalSetting.upsert({
            where: { key: 'INVENTORY_DO_MANDATORY' },
            create: { key: 'INVENTORY_DO_MANDATORY', value: String(INVENTORY_DO_MANDATORY), type: 'BOOLEAN', group: 'INVENTORY' },
            update: { value: String(INVENTORY_DO_MANDATORY) }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
