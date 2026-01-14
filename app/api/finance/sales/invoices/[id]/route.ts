import { NextRequest } from "next/server";
import { SalesController } from "@/controllers/sales.controller";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return SalesController.getInvoice(req, { params });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return SalesController.deleteInvoice(req, { params });
}
