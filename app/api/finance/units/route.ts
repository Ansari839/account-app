
import { UnitController } from '@/controllers/unit.controller';

export async function GET(req: Request) {
    return UnitController.getAll();
}

export async function POST(req: Request) {
    return UnitController.create(req);
}
export async function PUT(req: Request) {
    return UnitController.update(req);
}

export async function DELETE(req: Request) {
    return UnitController.delete(req);
}
