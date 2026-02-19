
import { AccountController } from '@/controllers/account.controller';

export async function GET(req: Request) {
    return AccountController.getHierarchy(req);
}

export async function POST(req: Request) {
    return AccountController.create(req);
}
