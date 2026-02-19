
import { NextRequest } from "next/server";
import { InventoryController } from "@/controllers/inventory.controller";

export async function GET(req: NextRequest) {
    return InventoryController.listProducts(req);
}

export async function POST(req: NextRequest) {
    return InventoryController.createProduct(req);
}
