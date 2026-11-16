import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";
import { 
    ScenarioInput, 
    calculateReverseConsumption 
} from "@/lib/reverse-consumption";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const body: ScenarioInput = await req.json();

        if (!body.exportHsCode) {
            return NextResponse.json(
                { success: false, error: "Export HS Code is required." },
                { status: 400 }
            );
        }

        // Fetch custom rules from DB if exists
        let dbRules: any[] = [];
        try {
            dbRules = await prisma.hsConsumptionRule.findMany({
                where: { outputHsCode: body.exportHsCode.trim() },
                orderBy: { stageOrder: "asc" }
            });
        } catch (dbErr) {
            console.warn("Could not query hsConsumptionRule, using fallback rules:", dbErr);
        }

        const calculation = calculateReverseConsumption(body, dbRules);

        return NextResponse.json({
            success: true,
            data: calculation
        });
    } catch (err: any) {
        console.error("Consumption calculation error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to calculate reverse consumption." },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        // Return available presets from DB
        const rules = await prisma.hsConsumptionRule.findMany({
            select: {
                outputHsCode: true,
                constructionType: true,
                fiberType: true
            },
            distinct: ["outputHsCode", "fiberType"]
        });

        return NextResponse.json({
            success: true,
            presets: rules
        });
    } catch (err: any) {
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
