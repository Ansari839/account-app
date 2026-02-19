
import { TaxController } from '@/controllers/tax.controller';

export async function GET(req: Request) {
    return TaxController.getAll(req);
}

export async function POST(req: Request) {
    return TaxController.create(req);
}
export async function PUT(req: Request) {
    return TaxController.update(req);
}

export async function DELETE(req: Request) {
    return TaxController.delete(req);
}
