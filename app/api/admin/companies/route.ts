import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth-utils';

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
        const { name, email, phone, address, website } = body;

        if (!name) {
            return NextResponse.json({ success: false, error: 'Company Name is required' }, { status: 400 });
        }

        const company = await prisma.company.create({
            data: {
                name,
                email,
                phone,
                address,
                website
            }
        });

        return NextResponse.json({ success: true, data: company });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
