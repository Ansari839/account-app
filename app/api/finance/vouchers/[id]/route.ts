import { NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';

// GET: Fetch Single Voucher by ID
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { companyId, error } = AuthUtils.getCompanyId(req);
    if (error) return error;

    const { id } = await params;

    try {
        const voucher = await prisma.journalEntry.findFirst({
            where: { id, companyId },
            include: {
                lines: {
                    include: { account: true }
                }
            }
        });

        if (!voucher) {
            return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: voucher });

    } catch (error) {
        console.error('Fetch voucher error:', error);
        return NextResponse.json({ error: 'Failed to fetch voucher' }, { status: 500 });
    }
}

// PUT: Update Voucher
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { companyId, error } = AuthUtils.getCompanyId(req);
    if (error) return error;

    const { id } = await params;

    try {
        const body = await req.json();
        const { date, narration, reference, lines } = body;

        await prisma.$transaction(async (tx) => {
            // 1. Verify Ownership
            const existing = await tx.journalEntry.findFirst({
                where: { id, companyId }
            });

            if (!existing) throw new Error("Voucher not found");

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
    const { companyId, error } = AuthUtils.getCompanyId(req);
    if (error) return error;

    const { id } = await params;

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Fetch to check ownership
            const voucher = await tx.journalEntry.findFirst({
                where: { id, companyId }
            });

            if (!voucher) throw new Error("Voucher not found");

            // 2. Delete Lines first
            await tx.journalLine.deleteMany({
                where: { entryId: id }
            });

            // 3. Delete Entry
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
