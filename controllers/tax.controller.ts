
import { NextResponse } from 'next/server';
import { TaxService } from '@/services/tax.service';

export class TaxController {
    static async getAll() {
        try {
            const taxes = await TaxService.getAllTaxCodes();
            return NextResponse.json({ success: true, data: taxes });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async create(req: Request) {
        try {
            const body = await req.json();
            const tax = await TaxService.createTaxCode(body);
            return NextResponse.json({ success: true, data: tax });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }
}
