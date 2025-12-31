import { NextRequest, NextResponse } from "next/server";
import { VoucherController } from "@/controllers/voucher.controller";

export async function GET(req: NextRequest) {
    return VoucherController.listJournals();
}

export async function POST(req: NextRequest) {
    return VoucherController.createJournal(req);
}
