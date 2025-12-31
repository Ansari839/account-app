
import { TaxController } from '@/controllers/tax.controller';

export async function GET(req: Request) {
    return TaxController.getAll();
}

export async function POST(req: Request) {
    return TaxController.create(req);
}
