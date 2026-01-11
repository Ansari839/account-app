import { NextRequest } from "next/server";
import { SalesController } from "@/controllers/sales.controller";

export async function GET(req: NextRequest) {
    return SalesController.listInvoices(req);
}

export async function POST(req: NextRequest) {
    return SalesController.createInvoice(req);
}
