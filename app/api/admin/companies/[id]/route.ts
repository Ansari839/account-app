import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth-utils';
import { CompanySettingsService } from '@/services/settings.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const company = await prisma.company.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { UserCompany: true }
                }
            }
        });

        if (!company) {
            return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 });
        }

        const isManufacturing = await CompanySettingsService.getBoolean(id, "ENABLE_MANUFACTURING", false);

        return NextResponse.json({
            success: true,
            data: { ...company, isManufacturing }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();
        const { name, email, phone, website, address, isManufacturing } = body;

        console.log('[PUT /api/admin/companies/:id] incoming:', { id, name, isManufacturing });

        if (!name?.trim()) {
            return NextResponse.json({ success: false, error: 'Company name is required' }, { status: 400 });
        }

        // Check if company exists first
        const existing = await prisma.company.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ success: false, error: `Company with ID ${id} not found` }, { status: 404 });
        }

        const updatedCompany = await prisma.company.update({
            where: { id },
            data: {
                name: name.trim(),
                email: email?.trim() || null,
                phone: phone?.trim() || null,
                website: website?.trim() || null,
                address: address?.trim() || null,
            }
        });

        if (typeof isManufacturing !== 'undefined') {
            await CompanySettingsService.set(
                id,
                "ENABLE_MANUFACTURING",
                String(!!isManufacturing),
                "BOOLEAN"
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                ...updatedCompany,
                isManufacturing: !!isManufacturing
            }
        });
    } catch (error: any) {
        console.error('[PUT /api/admin/companies/:id Error]:', error);
        return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
    }
}
