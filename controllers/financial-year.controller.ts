import { NextResponse } from 'next/server';
import { FinancialYearService } from '@/services/financial-year.service';

export class FinancialYearController {
    static async list(req: Request) {
        try {
            const years = await FinancialYearService.listYears();
            return NextResponse.json({ success: true, data: years });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async create(req: Request) {
        try {
            const body = await req.json();
            const year = await FinancialYearService.createYear(body);
            return NextResponse.json({ success: true, data: year });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    static async update(req: Request) {
        try {
            const body = await req.json();
            if (!body.id) throw new Error("ID required");
            const year = await FinancialYearService.updateYear(body.id, body);
            return NextResponse.json({ success: true, data: year });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    static async delete(req: Request) {
        try {
            const { searchParams } = new URL(req.url);
            const id = searchParams.get('id');
            if (!id) return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });
            await FinancialYearService.deleteYear(id);
            return NextResponse.json({ success: true });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}
