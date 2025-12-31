
import { UnitController } from '@/controllers/unit.controller';

export async function GET(req: Request) {
    return UnitController.getAll();
}

export async function POST(req: Request) {
    return UnitController.create(req);
}
