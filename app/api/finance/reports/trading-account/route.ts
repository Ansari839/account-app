
import { NextResponse } from "next/server";
import { ReportService } from "@/services/report.service";
import { AuthUtils } from "@/lib/auth-utils";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        if (!startDate || !endDate) {
            return NextResponse.json({ success: false, error: "Missing start or end date" }, { status: 400 });
        }

        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const data = await ReportService.getTradingAccount(
            companyId,
            new Date(startDate),
            new Date(endDate)
        );

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error("Trading Account Error", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
