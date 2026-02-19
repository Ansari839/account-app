import { AccountController } from "@/controllers/account.controller";

export async function POST(req: Request) {
    return AccountController.setupDefault(req);
}
