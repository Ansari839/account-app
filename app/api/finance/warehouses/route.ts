
import { WarehouseController } from '@/controllers/warehouse.controller';

export async function GET(req: Request) {
    return WarehouseController.getAll(req);
}

export async function POST(req: Request) {
    return WarehouseController.create(req);
}
