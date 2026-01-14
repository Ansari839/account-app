
import { PurchaseController } from "@/controllers/purchase.controller";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    return await PurchaseController.deleteReturn(req, { params });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    return await PurchaseController.updateReturn(req, { params });
}
