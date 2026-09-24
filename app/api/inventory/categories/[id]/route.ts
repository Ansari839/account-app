
import { NextRequest } from "next/server";
import { InventoryController } from "@/controllers/inventory.controller";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return InventoryController.getCategory(id);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return InventoryController.updateCategory(req, id);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return InventoryController.deleteCategory(id);
}
