import { NextRequest } from "next/server";
import { CurrencyController } from "@/controllers/currency.controller";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    return CurrencyController.list(req);
}

export async function POST(req: NextRequest) {
    return CurrencyController.upsert(req);
}

export async function DELETE(req: NextRequest) {
    return CurrencyController.delete(req);
}
