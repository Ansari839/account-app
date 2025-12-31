import { AccountController } from "@/controllers/account.controller";

export async function POST() {
    return AccountController.setupDefault();
}
