
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

        const auth = await AuthUtils.getAuthUser(req);
        if (!auth) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const data = await ReportService.getTradingAccount(
            auth.companyId,
            new Date(startDate),
            new Date(endDate)
        );

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error("Trading Account Error", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
