import { AccountController } from "@/controllers/account.controller";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    return AccountController.update(req, { params });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    return AccountController.delete(req, { params });
}
