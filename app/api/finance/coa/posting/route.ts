
import { AccountController } from '@/controllers/account.controller';

export async function GET(req: Request) {
    return AccountController.getPostingAccounts(req);
}
