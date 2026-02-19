import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth-utils';
import { CompanyService } from '@/services/company.service';

export async function GET(req: Request) {
    try {
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const companies = await prisma.company.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { users: true }
                }
            }
        });

        return NextResponse.json({ success: true, data: companies });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await AuthUtils.getAuthUser(req);
        if (!user || !user.isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { name, email, phone, address, website, cloneFromId } = body;

        if (!name) {
            return NextResponse.json({ success: false, error: 'Company Name is required' }, { status: 400 });
        }

        let company;

        if (cloneFromId) {
            // Clone logic
            company = await CompanyService.clone(cloneFromId, name, user.userId || user.id);
        } else {
            // Standard Create
            company = await CompanyService.create({
                name,
                email,
                phone,
                address,
                website
            });

            // Also assign the creator as ADMIN
            await prisma.userCompany.create({
                data: {
                    userId: user.userId || user.id,
                    companyId: company.id,
                    role: 'ADMIN',
                    isDefault: true
                }
            });
        }

        return NextResponse.json({ success: true, data: company });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
