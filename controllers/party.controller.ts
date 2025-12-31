
import { NextResponse } from 'next/server';
import { PartyService } from '@/services/party.service';

export class PartyController {
    static async createCustomer(req: Request) {
        try {
            const body = await req.json();
            const customer = await PartyService.createCustomer(body);
            return NextResponse.json({ success: true, data: customer });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    static async createSupplier(req: Request) {
        try {
            const body = await req.json();
            const supplier = await PartyService.createSupplier(body);
            return NextResponse.json({ success: true, data: supplier });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }

    static async getCustomer(req: Request) {
        // Implementation for fetching single or list
        // For simplicity returning empty for now or implementation similar to above
        return NextResponse.json({ success: true, message: "Not implemented yet" });
    }
}
