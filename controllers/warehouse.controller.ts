
import { NextResponse } from 'next/server';
import { WarehouseService } from '@/services/warehouse.service';

export class WarehouseController {
    static async getAll() {
        try {
            const warehouses = await WarehouseService.getAllWarehouses();
            return NextResponse.json({ success: true, data: warehouses });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    static async create(req: Request) {
        try {
            const body = await req.json();
            const warehouse = await WarehouseService.createWarehouse(body);
            return NextResponse.json({ success: true, data: warehouse });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
    }
}
