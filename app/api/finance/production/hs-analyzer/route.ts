import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";

// Comprehensive Pakistan Customs & Textile Industry Standard Rules
const HS_MAPPING_RULES: Record<string, {
    outputTitle: string;
    description: string;
    standardSpecs: string;
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
        standardSharePercent: number; // typical share in finished product
    }>;
}> = {
    // 1. Scarf / Shawl (Synthetic)
    "6214.3000": {
        outputTitle: "SCARF / SHAWL (Synthetic Fibres)",
        description: "Shawls, scarves, mufflers, mantillas, veils and the like of synthetic fibres.",
        standardSpecs: "Standard Export Weave: 85-90% Textured DTY Body + 10-15% Flat FDY Border/Selvedge",
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
            { 
                code: "5402.3300", 
                name: "Polyester DTY (Textured Yarn)", 
                typicalUse: "Main body yarn (DEN 75/36, DEN 75/72, DEN 100/36)",
                standardSharePercent: 85 
            },
            { 
                code: "5402.4700", 
                name: "Polyester FDY (Flat Yarn)", 
                typicalUse: "Border, selvedge, shine yarn (DEN 50/36, DEN 40/12)",
                standardSharePercent: 15 
            }
        ]
    },
    // 2. Knitted / Dyed Fabric
    "6006.3200": {
        outputTitle: "POLYESTER KNITTED DYED FABRIC / NET",
        description: "Other knitted or crocheted fabrics of synthetic fibres, dyed.",
        standardSpecs: "Standard Circular Knit: 100% DTY or DTY/FDY mesh combination",
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
            { 
                code: "5402.3300", 
                name: "Polyester DTY (Textured Yarn)", 
                typicalUse: "Main knitting yarn (DEN 75/36, DEN 100/36)",
                standardSharePercent: 90 
            },
            { 
                code: "5402.4700", 
                name: "Polyester FDY Yarn", 
                typicalUse: "Net structure / fine knitting (DEN 50/36, DEN 40/12)",
                standardSharePercent: 10 
            }
        ]
    },
    // 3. Men's Vest / T-Shirt
    "6109.9090": {
        outputTitle: "MEN'S VEST / KNITTED T-SHIRT",
        description: "T-shirts, singlets and other vests, knitted or crocheted, of other textile materials.",
        standardSpecs: "Standard Single Jersey: Polyester/Cotton (PC) Spun Yarn or Filament Knitted",
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
            { 
                code: "5509.5300", 
                name: "Polyester / Cotton Blended Yarn (PC Yarn)", 
                typicalUse: "24/1 PC Yarn, 30/1 PC Yarn",
                standardSharePercent: 80 
            },
            { 
                code: "5402.3300", 
                name: "Polyester Filament Yarn", 
                typicalUse: "DTY Yarn for knitting blends",
                standardSharePercent: 20 
            }
        ]
    },
    // 4. Other Synthetic Garments
    "6203.4300": {
        outputTitle: "MEN'S TROUSERS / SHORTS (Synthetic)",
        description: "Men's or boys' trousers, bib and brace overalls, breeches and shorts of synthetic fibres.",
        standardSpecs: "Woven Heavy Fabric: Spun / Filament warp and weft",
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
            { 
                code: "5402.3300", 
                name: "Polyester DTY Yarn", 
                typicalUse: "Warp / Weft yarn",
                standardSharePercent: 70 
            },
            { 
                code: "5509.5300", 
                name: "PC / Polyester Spun Yarn", 
                typicalUse: "Heavy fabric weave",
                standardSharePercent: 30 
            }
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

        // 1. Fetch all distinct Products in Company DB
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

        // 2. If specific HS Code requested, build comprehensive response
        if (hsCode) {
            let rule = HS_MAPPING_RULES[hsCode];
            if (!rule) {
                if (hsCode.startsWith("62") || hsCode.startsWith("61")) {
                    rule = {
                        outputTitle: `Apparel / Textile Finished Goods (HS ${hsCode})`,
                        description: "Manufactured garment / textile product requiring weaving/knitting & yarn.",
                        standardSpecs: "Standard export textile assembly",
                        stages: [
                            { stageName: "Dyeing / Processing", type: "SERVICE", wastagePercent: 0, mode: "OUT_HOUSE", note: "Out-house Dyeing Service Bill" },
                            { stageName: "Weaving / Knitting", type: "PROCESSING", wastagePercent: 4.0, mode: "IN_HOUSE_OR_OUT_HOUSE", note: "Fabric construction" },
                            { stageName: "Yarn Consumption", type: "RAW_MATERIAL", wastagePercent: 4.0, mode: "PHYSICAL_RM", note: "Raw Yarn consumed" }
                        ],
                        allowedInputHsCodes: [
                            { code: "5402.3300", name: "Polyester DTY (Yarn)", typicalUse: "General Filament Yarn", standardSharePercent: 85 },
                            { code: "5402.4700", name: "Polyester FDY (Yarn)", typicalUse: "Flat Filament Yarn", standardSharePercent: 15 }
                        ]
                    };
                } else if (hsCode.startsWith("60")) {
                    rule = {
                        outputTitle: `Knitted Fabric (HS ${hsCode})`,
                        description: "Knitted or crocheted fabric requiring yarn.",
                        standardSpecs: "Standard knitted fabric roll",
                        stages: [
                            { stageName: "Dyeing Service", type: "SERVICE", wastagePercent: 0, mode: "OUT_HOUSE", note: "Out-house Dyeing Service" },
                            { stageName: "Knitting", type: "PROCESSING", wastagePercent: 4.0, mode: "IN_HOUSE_OR_OUT_HOUSE", note: "In-house or Out-house knitting" },
                            { stageName: "Yarn Consumption", type: "RAW_MATERIAL", wastagePercent: 4.0, mode: "PHYSICAL_RM", note: "Yarn Input" }
                        ],
                        allowedInputHsCodes: [
                            { code: "5402.3300", name: "Polyester DTY (Yarn)", typicalUse: "Textured Yarn", standardSharePercent: 90 },
                            { code: "5402.4700", name: "Polyester FDY (Yarn)", typicalUse: "Flat Yarn", standardSharePercent: 10 }
                        ]
                    };
                } else {
                    rule = {
                        outputTitle: `Custom Item (HS ${hsCode})`,
                        description: "Custom manufactured goods.",
                        standardSpecs: "Standard raw material consumption",
                        stages: [
                            { stageName: "Processing / Service", type: "SERVICE", wastagePercent: 0, mode: "OUT_HOUSE", note: "Outside Vendor Service" },
                            { stageName: "Raw Material", type: "RAW_MATERIAL", wastagePercent: 4.0, mode: "PHYSICAL_RM", note: "Input Yarn / Material" }
                        ],
                        allowedInputHsCodes: [
                            { code: "5402.3300", name: "Polyester Yarn", typicalUse: "Primary RM", standardSharePercent: 100 }
                        ]
                    };
                }
            }

            // 1. Calculate Actual Standard Backward Quantities (Technical Recipe)
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
                currentQty = reqQty;
                return result;
            });

            const totalActualYarnRequired = currentQty;

            // 2. Fetch Live Stock & Group by Product & isEFS
            const allowedCodes = rule.allowedInputHsCodes.map(c => c.code);
            const matchedProducts = existingProducts.filter(p => p.hsCode && allowedCodes.includes(p.hsCode));
            const matchedProductIds = matchedProducts.map(p => p.id);

            // Query stock ledger with EFS vs Non-EFS breakdown
            let stockByProduct: Record<string, { total: number; efs: number; nonEfs: number }> = {};
            if (matchedProductIds.length > 0) {
                const stockLedgerRows = await prisma.stockLedger.findMany({
                    where: { companyId, productId: { in: matchedProductIds } },
                    select: {
                        productId: true,
                        qtyIn: true,
                        qtyOut: true,
                        isEFS: true
                    }
                });

                for (const row of stockLedgerRows) {
                    if (!stockByProduct[row.productId]) {
                        stockByProduct[row.productId] = { total: 0, efs: 0, nonEfs: 0 };
                    }
                    const netQty = Number(row.qtyIn) - Number(row.qtyOut);
                    stockByProduct[row.productId].total += netQty;
                    if (row.isEFS) {
                        stockByProduct[row.productId].efs += netQty;
                    } else {
                        stockByProduct[row.productId].nonEfs += netQty;
                    }
                }
            }

            // 3. Evaluate Stock Fit & Gap Analysis per Allowed Input HS Code
            let totalAvailableWarehouseStock = 0;
            const hsCodeFitAnalysis = rule.allowedInputHsCodes.map(input => {
                const requiredForThisCode = Math.round((totalActualYarnRequired * (input.standardSharePercent / 100)) * 100) / 100;
                
                // Find products matching this specific HS Code
                const matchingItems = matchedProducts.filter(p => p.hsCode === input.code).map(p => {
                    const st = stockByProduct[p.id] || { total: 0, efs: 0, nonEfs: 0 };
                    const available = Math.max(0, Math.round(st.total * 100) / 100);
                    const efs = Math.max(0, Math.round(st.efs * 100) / 100);
                    const nonEfs = Math.max(0, Math.round(st.nonEfs * 100) / 100);
                    return {
                        id: p.id,
                        code: p.code,
                        name: p.name,
                        stage: p.stage || "RAW",
                        availableStock: available,
                        efsStock: efs,
                        nonEfsStock: nonEfs
                    };
                });

                const totalAvailableForThisCode = matchingItems.reduce((acc, it) => acc + it.availableStock, 0);
                totalAvailableWarehouseStock += totalAvailableForThisCode;

                const coveredQty = Math.min(totalAvailableForThisCode, requiredForThisCode);
                const shortfallQty = Math.max(0, Math.round((requiredForThisCode - totalAvailableForThisCode) * 100) / 100);
                const coveragePercent = requiredForThisCode > 0 ? Math.min(100, Math.round((totalAvailableForThisCode / requiredForThisCode) * 100)) : 100;

                let fitStatus: 'OK' | 'KAM_HAI' | 'OUT_OF_STOCK' = 'OK';
                let statusMessage = "Stock Kafi Hai (Fully Covered)";
                if (totalAvailableForThisCode <= 0) {
                    fitStatus = 'OUT_OF_STOCK';
                    statusMessage = "Zero Stock Available (Purchase Required)";
                } else if (totalAvailableForThisCode < requiredForThisCode) {
                    fitStatus = 'KAM_HAI';
                    statusMessage = `Kam hai: ${shortfallQty.toLocaleString()} KG`;
                }

                return {
                    hsCode: input.code,
                    name: input.name,
                    typicalUse: input.typicalUse,
                    standardSharePercent: input.standardSharePercent,
                    requiredQty: requiredForThisCode,
                    availableStock: totalAvailableForThisCode,
                    coveredQty,
                    shortfallQty,
                    coveragePercent,
                    fitStatus,
                    statusMessage,
                    items: matchingItems
                };
            });

            const overallShortfall = Math.max(0, Math.round((totalActualYarnRequired - totalAvailableWarehouseStock) * 100) / 100);
            const overallCoveragePercent = totalActualYarnRequired > 0 
                ? Math.min(100, Math.round((totalAvailableWarehouseStock / totalActualYarnRequired) * 100)) 
                : 100;

            return NextResponse.json({
                success: true,
                data: {
                    hsCode,
                    targetQty,
                    actualStandardRecipe: {
                        outputTitle: rule.outputTitle,
                        description: rule.description,
                        standardSpecs: rule.standardSpecs,
                        stages: calculatedStages,
                        totalActualYarnRequired,
                        allowedInputHsCodes: rule.allowedInputHsCodes
                    },
                    inventoryFitAnalysis: {
                        totalActualYarnRequired,
                        totalAvailableWarehouseStock,
                        overallShortfall,
                        overallCoveragePercent,
                        overallFitStatus: overallShortfall === 0 ? "OK" : totalAvailableWarehouseStock === 0 ? "OUT_OF_STOCK" : "KAM_HAI",
                        codeBreakdown: hsCodeFitAnalysis
                    }
                }
            });
        }

        // Default response: Return list of available presets
        return NextResponse.json({
            success: true,
            presets: Object.keys(HS_MAPPING_RULES).map(k => ({
                hsCode: k,
                title: HS_MAPPING_RULES[k].outputTitle,
                description: HS_MAPPING_RULES[k].description,
                standardSpecs: HS_MAPPING_RULES[k].standardSpecs,
                inputCodes: HS_MAPPING_RULES[k].allowedInputHsCodes
            })),
            companyProductsWithHs: existingProducts.filter(p => p.hsCode)
        });
    } catch (error: any) {
        console.error("HS Analyzer Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
