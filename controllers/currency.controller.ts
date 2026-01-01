import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";

export class CurrencyController {
    static async list(req: Request) {
        try {
            const currencies = await prisma.currency.findMany({ orderBy: { code: 'asc' } });
            return NextResponse.json({ success: true, data: currencies });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async upsert(req: Request) {
        try {
            const body = await req.json();
            // body: { code, name, symbol, rate, isBase }

            if (body.isBase) {
                // If creating/updating base currency, unset others
                await prisma.currency.updateMany({ data: { isBase: false } });
            }

            const currency = await prisma.currency.upsert({
                where: { code: body.code },
                update: { ...body },
                create: { ...body }
            });
            return NextResponse.json({ success: true, data: currency });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async delete(req: Request) {
        try {
            const { searchParams } = new URL(req.url);
            const id = searchParams.get('id');
            if (!id) return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });

            await prisma.currency.delete({ where: { id } });
            return NextResponse.json({ success: true });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}
