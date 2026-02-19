import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth-utils';
import { VoucherType } from '@prisma/client';

export async function GET(req: Request) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        // Get all defined voucher types from Prisma enum
        const allTypes = Object.values(VoucherType);

        // Fetch existing sequences
        const sequences = await prisma.voucherSequence.findMany({
            where: { companyId }
        });

        // Merge sequences with all types (some might not exist yet)
        const data = allTypes.map(type => {
            const existing = sequences.find(s => s.type === type);
            return {
                type,
                prefix: existing?.prefix || '',
                nextValue: existing?.nextValue || 1,
                id: existing?.id
            };
        });

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const body = await req.json();
        const { type, prefix, nextValue } = body;

        if (!type || !prefix) {
            return NextResponse.json({ success: false, error: "Type and Prefix are required" }, { status: 400 });
        }

        const sequence = await prisma.voucherSequence.upsert({
            where: { companyId_type: { companyId, type: type as VoucherType } },
            create: {
                companyId,
                type: type as VoucherType,
                prefix,
                nextValue: Number(nextValue) || 1
            },
            update: {
                prefix,
                nextValue: Number(nextValue) || undefined
            }
        });

        return NextResponse.json({ success: true, data: sequence });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
