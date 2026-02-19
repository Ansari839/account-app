
import { NextResponse } from 'next/server';
import { PartyService } from '@/services/party.service';
import { AuthUtils } from '@/lib/auth-utils';

export class PartyController {
    static async createCustomer(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const customer = await PartyService.createCustomer(companyId, body);
            return NextResponse.json({ success: true, data: customer });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    static async createSupplier(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const supplier = await PartyService.createSupplier(companyId, body);
            return NextResponse.json({ success: true, data: supplier });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    static async getCustomer(req: Request) {
        return NextResponse.json({ success: true, message: "Not implemented yet" });
    }
}
