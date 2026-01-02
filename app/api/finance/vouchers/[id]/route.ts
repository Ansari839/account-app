import { NextResponse } from 'next/server';
import { JournalEntry } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { AuthUtils } from '@/lib/auth-utils';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function getAuthUser(req: Request) {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) return null;
    return AuthUtils.verifyToken(token);
}

// GET: Fetch Single Voucher by ID
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        const voucher = await prisma.journalEntry.findUnique({
            where: { id: id },
            include: {
                lines: {
                    include: { account: true }
                }
            }
        });

        if (!voucher) {
            return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
        }

        // Security: Ensure at least one line belongs to the user's company
        const belongsToCompany = voucher.lines.some(l => l.account.companyId === user.companyId);
        if (!belongsToCompany) {
            return NextResponse.json({ error: 'Unauthorized access to this voucher' }, { status: 403 });
        }

        return NextResponse.json({ success: true, data: voucher });

    } catch (error) {
        console.error('Fetch voucher error:', error);
        return NextResponse.json({ error: 'Failed to fetch voucher' }, { status: 500 });
    }
}

// PUT: Update Voucher
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        const body = await req.json();
        const { date, narration, reference, lines } = body;

        await prisma.$transaction(async (tx) => {
            // 1. Verify Ownership
            const existing = await tx.journalEntry.findUnique({
                where: { id },
                include: { lines: { include: { account: true } } }
            });

            if (!existing) throw new Error("Voucher not found");
            const belongsToCompany = existing.lines.some(l => l.account.companyId === user.companyId);
            if (!belongsToCompany) throw new Error("Unauthorized");

            // 2. Update Header
            await tx.journalEntry.update({
                where: { id },
                data: {
                    date,
                    narration,
                    reference
                }
            });

            // 3. Replace Lines (Delete All + Create New)
            // Using 'entryId' based on previous error message indicating 'journalEntryId' was invalid
            await tx.journalLine.deleteMany({
                where: { entryId: id }
            });

            if (lines && lines.length > 0) {
                await tx.journalLine.createMany({
                    data: lines.map((l: any) => ({
                        entryId: id,
                        accountId: l.accountId,
                        debit: Number(l.debit),
                        credit: Number(l.credit),
                        narration: l.narration
                    }))
                });
            }
        });

        return NextResponse.json({ success: true, message: 'Voucher updated successfully' });

    } catch (error: any) {
        console.error('Update voucher error:', error);
        return NextResponse.json({ error: error.message || 'Failed to update voucher' }, { status: 500 });
    }
}

// DELETE: Remove Voucher
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getAuthUser(req);
    if (!user || !user.companyId || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Fetch to check ownership and status
            const voucher = await tx.journalEntry.findUnique({
                where: { id },
                include: { lines: { include: { account: true } } }
            });

            if (!voucher) throw new Error("Voucher not found");

            // 2. Check Company
            const belongsToCompany = voucher.lines.some(l => l.account.companyId === user.companyId);
            if (!belongsToCompany) throw new Error("Unauthorized");

            // 3. Delete Lines first
            // Using 'entryId' as fixed field name
            await tx.journalLine.deleteMany({
                where: { entryId: id }
            });

            // 4. Delete Entry
            await tx.journalEntry.delete({
                where: { id }
            });
        });

        return NextResponse.json({ success: true, message: 'Voucher deleted successfully' });

    } catch (error: any) {
        console.error('Delete voucher error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete voucher' }, { status: 500 });
    }
}
