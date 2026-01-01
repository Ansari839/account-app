import { NextRequest } from "next/server";
import { FinancialYearController } from "@/controllers/financial-year.controller";

export async function GET(req: NextRequest) {
    return FinancialYearController.list(req);
}

export async function POST(req: NextRequest) {
    return FinancialYearController.create(req);
}

export async function PUT(req: NextRequest) {
    return FinancialYearController.update(req);
}

export async function DELETE(req: NextRequest) {
    return FinancialYearController.delete(req);
}
