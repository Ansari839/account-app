import { NextRequest } from "next/server";
import { PurchaseController } from "@/controllers/purchase.controller";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return PurchaseController.getOrder(req, { params });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return PurchaseController.updateOrder(req, { params });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return PurchaseController.deleteOrder(req, { params });
}
