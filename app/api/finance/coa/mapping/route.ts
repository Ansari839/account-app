import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth-utils';

// ─── GET: Return all system account mappings for this company ─────────────────
export async function GET(request: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(request);
        if (error) return error;
        if (!companyId) return NextResponse.json({ error: 'No active company session' }, { status: 400 });

        const mappings = await prisma.systemAccountMapping.findMany({
            where: { companyId },
            include: {
                account: {
                    select: { id: true, code: true, name: true, type: true }
                }
            }
        });

        // Convert array to a key-value object for easy frontend usage
        const result = mappings.reduce<Record<string, {
            accountId: string;
            account: { id: string; code: string; name: string; type: string }
        }>>((acc, m) => {
            acc[m.key] = { accountId: m.accountId, account: m.account };
            return acc;
        }, {});

        return NextResponse.json({ success: true, data: result });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// ─── POST: Upsert a single mapping (key → accountId) ─────────────────────────
export async function POST(request: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(request);
        if (error) return error;
        if (!companyId) return NextResponse.json({ error: 'No active company session' }, { status: 400 });

        const body = await request.json();
        const { key, accountId } = body;

        if (!key || !accountId) {
            return NextResponse.json({ error: 'key and accountId are required' }, { status: 400 });
        }

        // Validate the account belongs to this company
        const account = await prisma.account.findFirst({
            where: { id: accountId, companyId }
        });
        if (!account) {
            return NextResponse.json({ error: 'Account not found in this company' }, { status: 404 });
        }

        const mapping = await prisma.systemAccountMapping.upsert({
            where: { companyId_key: { companyId, key } },
            update: { accountId },
            create: { companyId, key, accountId },
            include: {
                account: { select: { id: true, code: true, name: true, type: true } }
            }
        });

        return NextResponse.json({ success: true, data: mapping });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
