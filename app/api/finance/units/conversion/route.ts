
import { UnitController } from '@/controllers/unit.controller';

export async function POST(req: Request) {
    return UnitController.addConversion(req);
}
