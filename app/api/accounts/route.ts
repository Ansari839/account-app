
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { cookies } from 'next/headers';
import { AuthUtils } from '@/lib/auth-utils';
import { z } from 'zod';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const accountSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'INCOME']),
    description: z.string().optional(),
    parentId: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return null;
        return String(val);
    }, z.string().nullable().optional()),
    openingBalance: z.preprocess((val) => Number(val) || 0, z.number().default(0)),
    openingBalanceType: z.enum(['DR', 'CR']).default('DR'),
});

async function getAuthUser(req: Request) {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) return null;
    return AuthUtils.verifyToken(token);
}

export async function GET(request: Request) {
    const user = await getAuthUser(request);
    if (!user || !user.companyId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const suggestCode = searchParams.get('suggestCode');
    const parentId = searchParams.get('parentId');

    try {
        if (suggestCode && parentId) {
            const pid = parentId;
            const parent = await prisma.account.findUnique({ where: { id: pid } });
            if (!parent) return NextResponse.json({ error: 'Parent not found' }, { status: 404 });

            const lastChild = await prisma.account.findFirst({
                where: { parentId: pid, companyId: user.companyId as string },
                orderBy: { code: 'desc' }
            });

            let nextCode: string;
            const parentCodeInt = parseInt(parent.code);

            if (!lastChild) {
                // Determine increment based on parent code pattern
                if (parent.code.endsWith('000')) nextCode = (parentCodeInt + 100).toString();
                else if (parent.code.endsWith('00')) nextCode = (parentCodeInt + 10).toString();
                else nextCode = (parentCodeInt + 1).toString();
            } else {
                // Increment last child
                const lastCodeInt = parseInt(lastChild.code);
                nextCode = (lastCodeInt + 1).toString();

                // Special case for root-to-level1 jump if only root exists
                if (parent.code.endsWith('000') && lastCodeInt === parentCodeInt) {
                    nextCode = (parentCodeInt + 100).toString();
                }
            }

            return NextResponse.json({ nextCode });
        }

        const accounts = await prisma.account.findMany({
            where: { companyId: user.companyId },
            include: {
                parent: { select: { name: true, code: true } },
                _count: { select: { children: true } }
            },
            orderBy: { code: 'asc' },
        });

        return NextResponse.json({ accounts });
    } catch (error) {
        console.error('Fetch accounts error:', error);
        return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const user = await getAuthUser(req);
    if (!user || !user.companyId || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const validatedData = accountSchema.parse(body);

        let typeVal = validatedData.type;
        if (typeVal === 'REVENUE') typeVal = 'INCOME' as any;

        const account = await prisma.account.create({
            data: {
                code: validatedData.code,
                name: validatedData.name,
                type: typeVal as any,
                description: validatedData.description,
                parentId: validatedData.parentId,
                companyId: user.companyId,
                openingBalance: validatedData.openingBalance,
                openingBalanceType: validatedData.openingBalanceType,
            },
        });

        return NextResponse.json({ account, message: 'Account created successfully' });
    } catch (error) {
        console.error('Create account error:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid data', details: error.issues }, { status: 400 });
        }

        // Handle Prisma Unique Constraint Error
        if ((error as any).code === 'P2002') {
            return NextResponse.json({ error: 'Account code already exists. Please choose a unique code.' }, { status: 409 });
        }

        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const user = await getAuthUser(req);
    if (!user || !user.companyId || (user.role !== 'ADMIN' && user.role !== 'ACCOUNTS')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id, code, name, type, description, parentId, openingBalance, openingBalanceType } = body;

        if (!id) return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });

        let typeVal = type;
        if (typeVal === 'REVENUE') typeVal = 'INCOME';

        const account = await prisma.account.update({
            where: { id: id, companyId: user.companyId },
            data: {
                code,
                name,
                type: typeVal,
                description,
                parentId: parentId || null,
                openingBalance: Number(openingBalance) || 0,
                openingBalanceType: openingBalanceType || 'DR',
            },
        });

        return NextResponse.json({ account, message: 'Account updated successfully' });
    } catch (error) {
        console.error('Update account error:', error);
        return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const user = await getAuthUser(req);
    if (!user || !user.companyId || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });


        // Safety Check 1: Check for children
        const hasChildren = await prisma.account.count({
            where: { parentId: id }
        });
        if (hasChildren > 0) {
            return NextResponse.json({ error: 'Cannot delete account with child accounts' }, { status: 400 });
        }

        // Safety Check 2: Check for transactions (using 'entries' relation)
        // Note: Relation name is 'entries' in Schema.
        const hasTransactions = await prisma.accountEntry.count({
            where: { accountId: id }
        });
        if (hasTransactions > 0) {
            return NextResponse.json({ error: 'Cannot delete account with existing transactions' }, { status: 400 });
        }

        await prisma.account.delete({
            where: { id: id, companyId: user.companyId },
        });

        return NextResponse.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }
}
