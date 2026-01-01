import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const units = await prisma.unit.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json({ success: true, data: units });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch units' }, { status: 500 });
    }
}
