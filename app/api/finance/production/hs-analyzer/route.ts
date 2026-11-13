import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";

// Business Knowledge-Base for Pakistan Textile / App specific mapping
const HS_MAPPING_RULES: Record<string, {
    outputTitle: string;
    description: string;
    stages: Array<{
        stageName: string;
        type: 'SERVICE' | 'PROCESSING' | 'RAW_MATERIAL';
        wastagePercent: number;
        mode: 'OUT_HOUSE' | 'IN_HOUSE_OR_OUT_HOUSE' | 'PHYSICAL_RM';
        note: string;
    }>;
    allowedInputHsCodes: Array<{
        code: string;
        name: string;
        typicalUse: string;
    }>;
}> = {
    // 1. Scarf / Shawl
    "6214.3000": {
        outputTitle: "SCARF / SHAWL (Synthetic Fibres)",
        description: "Finished shawls, scarves, mufflers, mantillas, veils and the like of synthetic fibres.",
        stages: [
            {
                stageName: "Dyeing / Processing",
                type: "SERVICE",
                wastagePercent: 0,
                mode: "OUT_HOUSE",
                note: "100% Out-house Job Work / Vendor Service Bill with Sales Tax (No chemical RM required)."
            },
            {
                stageName: "Weaving / Knitting",
                type: "PROCESSING",
                wastagePercent: 4.0,
                mode: "IN_HOUSE_OR_OUT_HOUSE",
                note: "Grey fabric production. In-house weaving charge (e.g. Rs. 10/KG) or Out-house vendor weaving bill."
            },
            {
                stageName: "Yarn Consumption",
                type: "RAW_MATERIAL",
                wastagePercent: 4.0,
                mode: "PHYSICAL_RM",
                note: "Physical Polyester Filament Yarn consumed from warehouse stock (EFS or Non-EFS)."
            }
        ],
        allowedInputHsCodes: [
            { code: "5402.3300", name: "Polyester DTY (Textured Yarn)", typicalUse: "Main yarn (DEN 75/36, DEN 75/72, DEN 100/36)" },
            { code: "5402.4700", name: "Polyester FDY (Flat / Other Yarn)", typicalUse: "Fine / border yarn (DEN 50/36, DEN 40/12)" }
        ]
    },
    // 2. Knitted / Dyed Fabric
    "6006.3200": {
        outputTitle: "POLYESTER KNITTED DYED FABRIC / NET",
        description: "Other knitted or crocheted fabrics of synthetic fibres, dyed.",
        stages: [
            {
                stageName: "Dyeing / Processing",
                type: "SERVICE",
                wastagePercent: 0,
                mode: "OUT_HOUSE",
                note: "Outside dye-house service charges + Sales Tax."
            },
            {
                stageName: "Knitting (Grey Net/Fabric)",
                type: "PROCESSING",
                wastagePercent: 4.0,
                mode: "IN_HOUSE_OR_OUT_HOUSE",
                note: "In-house knitting or Out-house job work."
            },
            {
                stageName: "Yarn Consumption",
                type: "RAW_MATERIAL",
                wastagePercent: 4.0,
                mode: "PHYSICAL_RM",
                note: "Polyester DTY / FDY Yarn."
            }
        ],
        allowedInputHsCodes: [
            { code: "5402.3300", name: "Polyester DTY (Textured Yarn)", typicalUse: "DEN 75/36, DEN 100/36" },
            { code: "5402.4700", name: "Polyester FDY Yarn", typicalUse: "DEN 50/36, DEN 40/12" }
        ]
    },
    // 3. Men's Vest / T-Shirt
    "6109.9090": {
        outputTitle: "MEN'S VEST / KNITTED T-SHIRT",
        description: "T-shirts, singlets and other vests, knitted or crocheted, of other textile materials.",
        stages: [
            {
                stageName: "Stitching & Finishing",
                type: "PROCESSING",
                wastagePercent: 3.0,
                mode: "IN_HOUSE_OR_OUT_HOUSE",
                note: "Garment stitching, trimming and packing."
            },
            {
                stageName: "Dyeing",
                type: "SERVICE",
                wastagePercent: 0,
                mode: "OUT_HOUSE",
                note: "Fabric dyeing (Out-house vendor bill)."
            },
            {
                stageName: "Circular Knitting",
                type: "PROCESSING",
                wastagePercent: 4.0,
                mode: "IN_HOUSE_OR_OUT_HOUSE",
                note: "Single jersey / interlock knitting."
            },
            {
                stageName: "Yarn Consumption",
                type: "RAW_MATERIAL",
                wastagePercent: 4.0,
                mode: "PHYSICAL_RM",
                note: "PC Yarn / Cotton / Polyester blended yarn."
            }
        ],
        allowedInputHsCodes: [
            { code: "5509.5300", name: "Polyester / Cotton Blended Yarn (PC Yarn)", typicalUse: "24/1 PC Yarn, 30/1 PC Yarn" },
            { code: "5402.3300", name: "Polyester Filament Yarn", typicalUse: "DTY Yarn for knitting" }
        ]
    },
    // 4. Other Synthetic Garments
    "6203.4300": {
        outputTitle: "MEN'S TROUSERS / SHORTS (Synthetic)",
        description: "Men's or boys' trousers, bib and brace overalls, breeches and shorts of synthetic fibres.",
        stages: [
            {
                stageName: "Stitching / CMT",
                type: "PROCESSING",
                wastagePercent: 5.0,
                mode: "IN_HOUSE_OR_OUT_HOUSE",
                note: "Cut, Make, Trim in-house or outsourced."
            },
            {
                stageName: "Fabric Dyeing / Finishing",
                type: "SERVICE",
                wastagePercent: 0,
                mode: "OUT_HOUSE",
                note: "Out-house dyeing service."
            },
            {
                stageName: "Weaving",
                type: "PROCESSING",
                wastagePercent: 4.0,
                mode: "IN_HOUSE_OR_OUT_HOUSE",
                note: "In-house loom or out-house weaving."
            },
            {
                stageName: "Yarn",
                type: "RAW_MATERIAL",
                wastagePercent: 4.0,
                mode: "PHYSICAL_RM",
                note: "Spun / filament synthetic yarn."
            }
        ],
        allowedInputHsCodes: [
            { code: "5402.3300", name: "Polyester DTY Yarn", typicalUse: "Warp / Weft yarn" },
            { code: "5509.5300", name: "PC / Polyester Spun Yarn", typicalUse: "Heavy fabric weave" }
        ]
    }
};

export async function GET(req: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const { searchParams } = new URL(req.url);
        const hsCode = searchParams.get("hsCode")?.trim() || "";
        const targetQty = parseFloat(searchParams.get("qty") || "1000");

        // 1. Fetch all distinct HS Codes from existing Products in Company DB
        const existingProducts = await prisma.product.findMany({
            where: { companyId, deletedAt: null },
            select: {
                id: true,
                code: true,
                name: true,
                hsCode: true,
                stage: true,
                isService: true
            }
        });

        // 2. If specific HS Code requested, build response
        if (hsCode) {
            // Find rule or fallback to generic synthetic textile rule
            let rule = HS_MAPPING_RULES[hsCode];
            if (!rule) {
                // If it starts with 62 or 61 (Garments / Made ups)
                if (hsCode.startsWith("62") || hsCode.startsWith("61")) {
                    rule = {
                        outputTitle: `Apparel / Textile Finished Goods (HS ${hsCode})`,
                        description: "Manufactured garment / textile product requiring weaving/knitting & yarn.",
                        stages: [
                            { stageName: "Dyeing / Processing", type: "SERVICE", wastagePercent: 0, mode: "OUT_HOUSE", note: "Out-house Dyeing Service Bill" },
                            { stageName: "Weaving / Knitting", type: "PROCESSING", wastagePercent: 4.0, mode: "IN_HOUSE_OR_OUT_HOUSE", note: "Fabric construction" },
                            { stageName: "Yarn", type: "RAW_MATERIAL", wastagePercent: 4.0, mode: "PHYSICAL_RM", note: "Raw Yarn consumed" }
                        ],
                        allowedInputHsCodes: [
                            { code: "5402.3300", name: "Polyester DTY (Yarn)", typicalUse: "General Filament Yarn" },
                            { code: "5402.4700", name: "Polyester FDY (Yarn)", typicalUse: "Flat Filament Yarn" },
                            { code: "5509.5300", name: "PC / Spun Yarn", typicalUse: "Blended Yarn" }
                        ]
                    };
                } else if (hsCode.startsWith("60")) {
                    // Knitted Fabric
                    rule = {
                        outputTitle: `Knitted Fabric (HS ${hsCode})`,
                        description: "Knitted or crocheted fabric requiring yarn.",
                        stages: [
                            { stageName: "Dyeing Service", type: "SERVICE", wastagePercent: 0, mode: "OUT_HOUSE", note: "Out-house Dyeing Service" },
                            { stageName: "Knitting", type: "PROCESSING", wastagePercent: 4.0, mode: "IN_HOUSE_OR_OUT_HOUSE", note: "In-house or Out-house knitting" },
                            { stageName: "Yarn", type: "RAW_MATERIAL", wastagePercent: 4.0, mode: "PHYSICAL_RM", note: "Yarn Input" }
                        ],
                        allowedInputHsCodes: [
                            { code: "5402.3300", name: "Polyester DTY (Yarn)", typicalUse: "Textured Yarn" },
                            { code: "5402.4700", name: "Polyester FDY (Yarn)", typicalUse: "Flat Yarn" }
                        ]
                    };
                } else {
                    rule = {
                        outputTitle: `Custom Item (HS ${hsCode})`,
                        description: "Custom textile goods.",
                        stages: [
                            { stageName: "Processing / Service", type: "SERVICE", wastagePercent: 0, mode: "OUT_HOUSE", note: "Outside Vendor Service" },
                            { stageName: "Raw Material", type: "RAW_MATERIAL", wastagePercent: 4.0, mode: "PHYSICAL_RM", note: "Input Yarn / Material" }
                        ],
                        allowedInputHsCodes: [
                            { code: "5402.3300", name: "Polyester Yarn", typicalUse: "Primary RM" }
                        ]
                    };
                }
            }

            // Calculate backward stage quantities
            let currentQty = targetQty;
            const calculatedStages = rule.stages.map((st) => {
                const wastage = st.wastagePercent;
                const reqQty = wastage > 0 ? Math.round((currentQty / ((100 - wastage) / 100)) * 100) / 100 : currentQty;
                const wastageQty = Math.round((reqQty - currentQty) * 100) / 100;
                const result = {
                    ...st,
                    outputQty: currentQty,
                    requiredQty: reqQty,
                    wastageQty
                };
                // Next stage backwards needs reqQty
                currentQty = reqQty;
                return result;
            });

            // Find matching products in Company Inventory for allowed input HS codes
            const allowedCodes = rule.allowedInputHsCodes.map(c => c.code);
            const matchedProducts = existingProducts.filter(p => p.hsCode && allowedCodes.includes(p.hsCode));

            // Fetch live stock for matched products
            const productIds = matchedProducts.map(p => p.id);
            let stockByProduct: Record<string, { totalQty: number; avgCost: number }> = {};
            if (productIds.length > 0) {
                const stockLedgerRows = await prisma.stockLedger.groupBy({
                    by: ['productId'],
                    where: { companyId, productId: { in: productIds } },
                    _sum: { qtyIn: true, qtyOut: true }
                });
                for (const row of stockLedgerRows) {
                    const inQty = Number(row._sum.qtyIn || 0);
                    const outQty = Number(row._sum.qtyOut || 0);
                    stockByProduct[row.productId] = {
                        totalQty: Math.max(0, inQty - outQty),
                        avgCost: 0
                    };
                }
            }

            const inventoryMatches = matchedProducts.map(p => ({
                id: p.id,
                code: p.code,
                name: p.name,
                hsCode: p.hsCode,
                stage: p.stage,
                availableStock: stockByProduct[p.id]?.totalQty || 0
            }));

            return NextResponse.json({
                success: true,
                data: {
                    hsCode,
                    targetQty,
                    rule: {
                        ...rule,
                        calculatedStages
                    },
                    requiredYarnQty: currentQty,
                    inventoryMatches
                }
            });
        }

        // Default response: Return list of available presets and configured rules
        return NextResponse.json({
            success: true,
            presets: Object.keys(HS_MAPPING_RULES).map(k => ({
                hsCode: k,
                title: HS_MAPPING_RULES[k].outputTitle,
                description: HS_MAPPING_RULES[k].description,
                inputCodes: HS_MAPPING_RULES[k].allowedInputHsCodes
            })),
            companyProductsWithHs: existingProducts.filter(p => p.hsCode)
        });
    } catch (error: any) {
        console.error("HS Analyzer Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
