import { NextResponse } from 'next/server';
import { TaxService } from '@/services/tax.service';
import { AuthUtils } from '@/lib/auth-utils';

export class TaxController {
    static async getAll(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const taxes = await TaxService.getAllTaxCodes(companyId);
            return NextResponse.json({ success: true, data: taxes });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async create(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const tax = await TaxService.createTaxCode(companyId, body);
            return NextResponse.json({ success: true, data: tax });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    static async update(req: Request) {
        try {
            const body = await req.json();
            if (!body.id) throw new Error("ID required");
            const tax = await TaxService.updateTaxCode(body.id, body);
            return NextResponse.json({ success: true, data: tax });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    static async delete(req: Request) {
        try {
            const { searchParams } = new URL(req.url);
            const id = searchParams.get('id');
            if (!id) return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });
            await TaxService.deleteTaxCode(id);
            return NextResponse.json({ success: true });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}
