
import { WarehouseController } from '@/controllers/warehouse.controller';

export async function GET(req: Request) {
    return WarehouseController.getAll();
}

export async function POST(req: Request) {
    return WarehouseController.create(req);
}
