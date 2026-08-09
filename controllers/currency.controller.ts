import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { AuthUtils } from '@/lib/auth-utils';

export class CurrencyController {
    static async list(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const currencies = await prisma.currency.findMany({
                where: { companyId },
                orderBy: { code: 'asc' }
            });
            return NextResponse.json({ success: true, data: currencies });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async upsert(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            // body: { code, name, symbol, rate, isBase }
            
            const isBase = body.isBase === true || body.isBase === 'true';
            const rate = parseFloat(body.rate) || 1.0;

            if (isBase) {
                // If creating/updating base currency, unset others
                await prisma.currency.updateMany({
                    where: { companyId },
                    data: { isBase: false }
                });
            }

            const payload = {
                code: body.code,
                name: body.name,
                symbol: body.symbol,
                rate,
                isBase
            };

            const currency = await prisma.currency.upsert({
                where: { companyId_code: { companyId, code: payload.code } },
                update: { ...payload },
                create: { ...payload, companyId }
            });
            return NextResponse.json({ success: true, data: currency });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async delete(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const { searchParams } = new URL(req.url);
            const id = searchParams.get('id');
            if (!id) return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });

            await prisma.currency.delete({
                where: { id, companyId }
            });
            return NextResponse.json({ success: true });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}
