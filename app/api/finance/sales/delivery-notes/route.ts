import { NextRequest } from "next/server";
import { SalesController } from "@/controllers/sales.controller";

export async function GET(req: NextRequest) {
    return SalesController.listDeliveryNotes(req);
}

export async function POST(req: NextRequest) {
    return SalesController.createDeliveryNote(req);
}
