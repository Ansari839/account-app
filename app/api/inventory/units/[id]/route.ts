
import { NextRequest } from "next/server";
import { InventoryController } from "@/controllers/inventory.controller";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const { id } = await params;
    return InventoryController.updateUnit(req, id);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const { id } = await params;
    return InventoryController.deleteUnit(id);
}
