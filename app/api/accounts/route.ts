import { NextResponse } from 'next/server';
import { JournalEntry } from '@prisma/client';
import { cookies } from 'next/headers';
import { AuthUtils } from '@/lib/auth-utils';
import { z } from 'zod';
import prisma from '@/lib/prisma';
const accountSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'INCOME']),
    description: z.string().optional(),
    parentId: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return null;
        return String(val);
    }, z.string().nullable().optional()),
    isPosting: z.boolean().optional().default(true),
    openingBalance: z.preprocess((val) => Number(val) || 0, z.number().default(0)),
    openingBalanceType: z.enum(['DR', 'CR']).default('DR'),
});

export async function GET(request: Request) {
    const { companyId, error } = AuthUtils.getCompanyId(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const suggestCode = searchParams.get('suggestCode');
    const parentId = searchParams.get('parentId');

    try {
        if (suggestCode && parentId) {
            const pid = parentId;
            const parent = await prisma.account.findUnique({ where: { id: pid } });
            if (!parent) return NextResponse.json({ error: 'Parent not found' }, { status: 404 });

            const lastChild = await prisma.account.findFirst({
                where: { parentId: pid, companyId },
                orderBy: { createdAt: 'desc' }
            });

            let nextCode: string;
            
            // Generate sequence based on parent
            if (!lastChild) {
                if (parent.code.endsWith('000')) {
                    nextCode = (parseInt(parent.code) + 100).toString();
                } else if (parent.code.endsWith('00')) {
                    nextCode = (parseInt(parent.code) + 10).toString();
                } else {
                    // For parents like 1110 or 1121, append -0001
                    nextCode = `${parent.code}-0001`;
                }
            } else {
                if (lastChild.code.includes('-')) {
                    // It has a sequence suffix (e.g., 1110-0045)
                    const parts = lastChild.code.split('-');
                    const seq = parseInt(parts[parts.length - 1]);
                    const nextSeq = (seq + 1).toString().padStart(4, '0');
                    parts[parts.length - 1] = nextSeq;
                    nextCode = parts.join('-');
                } else {
                    // It doesn't have a dash (e.g., 1111)
                    const lastCodeInt = parseInt(lastChild.code);
                    if (parent.code.endsWith('000') && lastCodeInt === parseInt(parent.code)) {
                        nextCode = (parseInt(parent.code) + 100).toString();
                    } else if (parent.code.endsWith('00') || parent.code.endsWith('000')) {
                        nextCode = (lastCodeInt + 1).toString();
                    } else {
                        // The parent is like 1110, last child is 1119. We shouldn't overflow to 1120.
                        // We transition to dash format.
                        nextCode = `${parent.code}-0001`;
                    }
                }
            }

            return NextResponse.json({ nextCode });
        }

        const isPosting = searchParams.get('isPosting');

        const where: any = { companyId };
        if (isPosting === 'true') where.isPosting = true;
        if (isPosting === 'false') where.isPosting = false;

        // Extended filtering (optional)
        const type = searchParams.get('type');
        if (type) where.type = type;

        const accounts = await prisma.account.findMany({
            where,
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
    const { companyId, error } = AuthUtils.getCompanyId(req);
    if (error) return error;

    const user = await AuthUtils.getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let hasAccess = user.isSuperAdmin;
    if (!hasAccess) {
        const userCompany = await prisma.userCompany.findUnique({
            where: { userId_companyId: { userId: user.userId, companyId } }
        });
        if (userCompany && (userCompany.role === 'ADMIN' || userCompany.role === 'OWNER')) {
            hasAccess = true;
        }
    }
    
    if (!hasAccess) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const validatedData = accountSchema.parse(body);

        // Validation: Parent cannot be a posting account
        if (validatedData.parentId) {
            const parent = await prisma.account.findUnique({ where: { id: validatedData.parentId } });
            if (parent?.isPosting) {
                return NextResponse.json({ error: 'Parent account cannot be a posting account. Please convert parent to group first.' }, { status: 400 });
            }
        }

        let typeVal = validatedData.type;
        if (typeVal === 'REVENUE') typeVal = 'INCOME' as any;

        const account = await prisma.account.create({
            data: {
                code: validatedData.code,
                name: validatedData.name,
                type: typeVal as any,
                description: validatedData.description,
                parentId: validatedData.parentId,
                companyId: companyId,
                isPosting: validatedData.isPosting,
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
        if ((error as any).code === 'P2002') {
            return NextResponse.json({ error: 'Account code already exists. Please choose a unique code.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const { companyId, error } = AuthUtils.getCompanyId(req);
    if (error) return error;

    const user = await AuthUtils.getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let hasAccess = user.isSuperAdmin;
    if (!hasAccess) {
        const userCompany = await prisma.userCompany.findUnique({
            where: { userId_companyId: { userId: user.userId, companyId } }
        });
        if (userCompany && (userCompany.role === 'ADMIN' || userCompany.role === 'OWNER' || userCompany.role === 'ACCOUNTS')) {
            hasAccess = true;
        }
    }
    
    if (!hasAccess) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id, code, name, type, description, parentId, isPosting, openingBalance, openingBalanceType } = body;

        if (!id) return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });

        const existingAccount = await prisma.account.findUnique({
            where: { id, companyId }
        });
        if (!existingAccount) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

        // Logic Check 1: Changing from Group (Non-Posting) to Posting (Leaf)
        // Allowed ONLY if it has no children
        if (isPosting === true && existingAccount.isPosting === false) {
            const childCount = await prisma.account.count({ where: { parentId: id } });
            if (childCount > 0) {
                return NextResponse.json({ error: 'Cannot change to Posting account because it has sub-accounts.' }, { status: 400 });
            }
        }

        // Logic Check 2: Changing from Posting (Leaf) to Group (Non-Posting)
        // Allowed ONLY if it has no transactions (journal lines)
        if (isPosting === false && existingAccount.isPosting === true) {
            const txCount = await prisma.journalLine.count({ where: { accountId: id } });
            if (txCount > 0) {
                return NextResponse.json({ error: 'Cannot change to Group account because it has existing transactions.' }, { status: 400 });
            }
        }

        // Logic Check 3: Moving to a new parent
        if (parentId && parentId !== existingAccount.parentId) {
            const newParent = await prisma.account.findUnique({ where: { id: parentId } });
            if (newParent?.isPosting) {
                return NextResponse.json({ error: 'Selected parent is a Posting account. Parent must be a Group account.' }, { status: 400 });
            }
        }

        let typeVal = type;
        if (typeVal === 'REVENUE') typeVal = 'INCOME';

        const account = await prisma.account.update({
            where: { id: id, companyId },
            data: {
                code,
                name,
                type: typeVal,
                description,
                parentId: parentId || null,
                isPosting: typeof isPosting === 'boolean' ? isPosting : existingAccount.isPosting,
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
    const { companyId, error } = AuthUtils.getCompanyId(req);
    if (error) return error;

    const user = await AuthUtils.getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let hasAccess = user.isSuperAdmin;
    if (!hasAccess) {
        const userCompany = await prisma.userCompany.findUnique({
            where: { userId_companyId: { userId: user.userId, companyId } }
        });
        if (userCompany && (userCompany.role === 'ADMIN' || userCompany.role === 'OWNER')) {
            hasAccess = true;
        }
    }
    
    if (!hasAccess) {
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
            where: { id: id, companyId },
        });

        return NextResponse.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }
}
