import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth-utils';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const authUser = await AuthUtils.getAuthUser(req);
        if (!authUser || !authUser.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const userId = params.id;
        const body = await req.json();
        const { companyId, role, isDefault } = body;

        if (!companyId || !role) {
            return NextResponse.json({ success: false, error: 'Company and Role are required' }, { status: 400 });
        }

        // Check if assignment exists
        const existing = await prisma.userCompany.findFirst({
            where: { userId, companyId }
        });

        if (existing) {
            // Update role
            const updated = await prisma.userCompany.update({
                where: { id: existing.id },
                data: { role, isDefault: !!isDefault }
            });
            return NextResponse.json({ success: true, data: updated });
        }

        // Create new assignment
        const assignment = await prisma.userCompany.create({
            data: {
                userId,
                companyId,
                role,
                isDefault: !!isDefault
            }
        });

        return NextResponse.json({ success: true, data: assignment });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const authUser = await AuthUtils.getAuthUser(req);
        if (!authUser || !authUser.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const userId = params.id;
        const { searchParams } = new URL(req.url);
        const companyId = searchParams.get('companyId');

        if (!companyId) {
            return NextResponse.json({ success: false, error: 'Company ID required' }, { status: 400 });
        }

        await prisma.userCompany.deleteMany({
            where: { userId, companyId }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
