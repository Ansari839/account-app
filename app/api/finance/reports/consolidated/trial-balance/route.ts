import { NextRequest } from "next/server";
import { AccountingController } from "@/controllers/accounting.controller";

export async function GET(req: NextRequest) {
    return AccountingController.getConsolidatedTrialBalance(req);
}
