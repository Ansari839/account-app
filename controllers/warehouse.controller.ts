
import { NextResponse } from 'next/server';
import { WarehouseService } from '@/services/warehouse.service';
import { AuthUtils } from '@/lib/auth-utils';

export class WarehouseController {
    static async getAll(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const warehouses = await WarehouseService.getAllWarehouses(companyId);
            return NextResponse.json({ success: true, data: warehouses });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async create(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const warehouse = await WarehouseService.createWarehouse(companyId, body);
            return NextResponse.json({ success: true, data: warehouse });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }
}
