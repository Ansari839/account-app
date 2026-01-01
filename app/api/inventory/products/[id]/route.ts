
import { NextRequest } from "next/server";
import { InventoryController } from "@/controllers/inventory.controller";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return InventoryController.updateProduct(req, id);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return InventoryController.deleteProduct(id);
}
