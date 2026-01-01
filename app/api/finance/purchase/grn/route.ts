import { NextRequest } from "next/server";
import { PurchaseController } from "@/controllers/purchase.controller";

export async function GET(req: NextRequest) {
    return PurchaseController.listGRNs(req);
}
