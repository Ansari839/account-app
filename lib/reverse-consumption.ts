export interface ScenarioInput {
    exportHsCode: string;              // e.g., "6214.3000" or "6006.3400"
    fiberType: 'FILAMENT' | 'STAPLE';  // Determines 5402 vs 5509 yarn range
    exportCondition: 'CMT' | 'LOOSE';  // CMT = Finished garment/scarf, LOOSE = Roll fabric
    totalExportPcs?: number;           // Required if exportCondition === 'CMT' (e.g., 96510)
    fabricPerPieceMtr?: number;        // e.g., 1.25
    totalNetWeightKg: number;          // e.g., 18031
    overallWastagePct: number;         // e.g., 4.0 (4%)
    stages: {
        yarnSource: 'IMPORT' | 'LOCAL' | 'SPLIT';
        weavingOrKnitting: { 
            enabled: boolean; 
            mode: 'IN_HOUSE' | 'OUTSOURCED'; 
            billingUnit: 'MTR' | 'KG';
            wastagePct?: number;
        };
        printing: { 
            enabled: boolean; 
            mode: 'IN_HOUSE' | 'OUTSOURCED'; 
            billingUnit: 'MTR' | 'KG';
            wastagePct?: number;
        };
        dyeingFinishing: { 
            enabled: boolean; 
            mode: 'IN_HOUSE' | 'OUTSOURCED'; 
            billingUnit: 'MTR' | 'KG';
            wastagePct?: number;
        };
        cmt: { 
            enabled: boolean; 
            mode: 'IN_HOUSE' | 'OUTSOURCED';
            wastagePct?: number;
        };
    };
}

export interface StageCalculationOutput {
    stageOrder: number;
    stageName: 'YARN' | 'WEAVING' | 'KNITTING' | 'PRINTING' | 'DYEING' | 'CMT' | 'EXPORT';
    stageLabel: string;
    mode: 'IN_HOUSE' | 'OUTSOURCED' | 'PURCHASE';
    requiredOutputHsCode: string;
    yarnRange?: {
        start: string;
        end: string;
    };
    stageWastagePct: number;
    qtyKg: number;
    qtyMtr: number;
    qtyPcs?: number;
    billingUnit: 'KG' | 'MTR' | 'PCS';
    invoiceRequired: boolean;
    invoiceTypeNote: string;
    fbrComplianceNote: string;
}

export interface ReverseConsumptionResult {
    success: boolean;
    errors: string[];
    warnings: string[];
    constructionType: 'WOVEN' | 'KNITTED';
    fiberType: 'FILAMENT' | 'STAPLE';
    baseMetrics: {
        totalExportPcs?: number;
        fabricPerPieceMtr?: number;
        totalFinishedMtr: number;
        totalNetWeightKg: number;
        kgPerMeterFactor: number;
        totalGrossYarnKg: number;
        overallWastagePct: number;
    };
    chain: StageCalculationOutput[];
}

export function detectConstruction(hsCode: string): 'WOVEN' | 'KNITTED' {
    const clean = hsCode.replace(/\./g, "").trim();
    if (clean.startsWith("60") || clean.startsWith("61")) {
        return "KNITTED";
    }
    // Chapters 50-55 and Chapter 62 are Woven
    if (clean.startsWith("54") || clean.startsWith("55") || clean.startsWith("62")) {
        return "WOVEN";
    }
    // Default fallback based on prefix
    return clean.startsWith("60") ? "KNITTED" : "WOVEN";
}

export function calculateReverseConsumption(
    input: ScenarioInput,
    customRules?: any[]
): ReverseConsumptionResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const construction = detectConstruction(input.exportHsCode);

    // 1. Guardrail Validation: Loose vs CMT Check
    if (input.exportCondition === 'CMT') {
        const clean = input.exportHsCode.replace(/\./g, "").trim();
        if (!clean.startsWith("61") && !clean.startsWith("62")) {
            warnings.push(
                `CMT export selected, but export HS Code ${input.exportHsCode} is not in Chapter 61/62 (Apparel/Accessories). Loose fabric codes (55/60) are typically exported under LOOSE condition.`
            );
        }
        if (!input.totalExportPcs || input.totalExportPcs <= 0) {
            errors.push("Total Export Pcs is required for CMT export condition.");
        }
    } else {
        const clean = input.exportHsCode.replace(/\./g, "").trim();
        if (clean.startsWith("61") || clean.startsWith("62")) {
            warnings.push(
                `LOOSE condition selected, but export HS Code ${input.exportHsCode} is in Chapter 61/62 (Made-ups/Apparel). Chapter 61/62 usually requires CMT cutting/sewing stage.`
            );
        }
    }

    if (input.totalNetWeightKg <= 0) {
        errors.push("Total Net Weight (KG) must be greater than 0.");
    }

    // 2. Base Finished Totals
    const totalFinishedMtr = input.exportCondition === 'CMT'
        ? (input.totalExportPcs || 0) * (input.fabricPerPieceMtr || 1.25)
        : (input.fabricPerPieceMtr && input.totalExportPcs 
            ? input.totalExportPcs * input.fabricPerPieceMtr 
            : (input.totalNetWeightKg / 0.15)); // default approx factor if not supplied

    const kgPerMeterFactor = totalFinishedMtr > 0 
        ? input.totalNetWeightKg / totalFinishedMtr 
        : 0.15;

    const totalGrossYarnKg = input.totalNetWeightKg * (1 + (input.overallWastagePct || 0) / 100);

    // 3. Stage-wise Wastage Distribution
    // Determine active stages
    const isCmtActive = input.exportCondition === 'CMT' && input.stages.cmt?.enabled !== false;
    const isDyeingActive = input.stages.dyeingFinishing?.enabled ?? true;
    const isPrintingActive = input.stages.printing?.enabled ?? false;
    const isFabricActive = input.stages.weavingOrKnitting?.enabled ?? true;

    // Distribute overall wastage across active stages if specific stage wastage not explicitly provided
    let activeStagesCount = 1; // Yarn always
    if (isFabricActive) activeStagesCount++;
    if (isPrintingActive) activeStagesCount++;
    if (isDyeingActive) activeStagesCount++;
    if (isCmtActive) activeStagesCount++;

    const defaultStageWastage = input.overallWastagePct / activeStagesCount;

    const cmtWastage = isCmtActive 
        ? (input.stages.cmt.wastagePct ?? (input.overallWastagePct > 0 ? 0.5 : 0)) 
        : 0;
    const dyeingWastage = isDyeingActive 
        ? (input.stages.dyeingFinishing.wastagePct ?? (input.overallWastagePct > 0 ? 0.5 : 0)) 
        : 0;
    const printWastage = isPrintingActive 
        ? (input.stages.printing.wastagePct ?? (input.overallWastagePct > 0 ? 0.5 : 0)) 
        : 0;
    const fabricWastage = isFabricActive 
        ? (input.stages.weavingOrKnitting.wastagePct ?? (input.overallWastagePct > 0 ? 1.5 : 0)) 
        : 0;
    const yarnWastage = input.overallWastagePct > 0 ? 1.5 : 0;

    // 4. Reverse Cumulative Quantities (From Finished Output -> Back to Yarn)
    // Stage 5: Final Export
    let currentAccumKg = input.totalNetWeightKg;

    const chain: StageCalculationOutput[] = [];

    // Stage E: Export Output
    chain.push({
        stageOrder: 5,
        stageName: 'EXPORT',
        stageLabel: input.exportCondition === 'CMT' ? 'Finished Export (CMT Goods)' : 'Finished Export (Roll / Loose)',
        mode: 'OUTSOURCED',
        requiredOutputHsCode: input.exportHsCode,
        stageWastagePct: 0,
        qtyKg: Math.round(currentAccumKg * 100) / 100,
        qtyMtr: Math.round((currentAccumKg / kgPerMeterFactor) * 100) / 100,
        qtyPcs: input.exportCondition === 'CMT' ? input.totalExportPcs : undefined,
        billingUnit: input.exportCondition === 'CMT' ? 'PCS' : 'KG',
        invoiceRequired: false,
        invoiceTypeNote: 'Commercial Export Invoice & Shipping Bill (EFS / Customs GD)',
        fbrComplianceNote: `Export Goods Declared under PCT Code ${input.exportHsCode}.`
    });

    // Stage D: CMT (Cutting, Making, Trimming) if applicable
    if (isCmtActive) {
        currentAccumKg = currentAccumKg * (1 + cmtWastage / 100);
        const cmtMode = input.stages.cmt.mode;
        chain.unshift({
            stageOrder: 4.5,
            stageName: 'CMT',
            stageLabel: 'Stitching / CMT / Cutting',
            mode: cmtMode,
            requiredOutputHsCode: input.exportHsCode,
            stageWastagePct: cmtWastage,
            qtyKg: Math.round(currentAccumKg * 100) / 100,
            qtyMtr: Math.round((currentAccumKg / kgPerMeterFactor) * 100) / 100,
            qtyPcs: input.totalExportPcs,
            billingUnit: 'PCS',
            invoiceRequired: cmtMode === 'OUTSOURCED',
            invoiceTypeNote: cmtMode === 'OUTSOURCED' 
                ? 'Vendor CMT Bill carrying output goods description & rate per PC' 
                : 'In-House Stitching (Internal Gate Pass / Job Card)',
            fbrComplianceNote: cmtMode === 'OUTSOURCED'
                ? `Toll vendor bill must invoice CMT charges with Sales Tax against ${input.exportHsCode}.`
                : 'Zero sales tax invoice required for internal stitching line.'
        });
    }

    // Stage C: Dyeing & Finishing
    if (isDyeingActive) {
        currentAccumKg = currentAccumKg * (1 + dyeingWastage / 100);
        const dyeMode = input.stages.dyeingFinishing.mode;
        const dyeUnit = input.stages.dyeingFinishing.billingUnit || 'KG';

        // Resolve Output HS code for Dyeing
        let dyeHsCode = construction === 'WOVEN'
            ? (input.fiberType === 'STAPLE' ? '5512.1900' : '5407.6100')
            : '6006.3200';

        if (input.exportHsCode.startsWith("6006.32")) {
            dyeHsCode = '6006.3200';
        }

        chain.unshift({
            stageOrder: 4,
            stageName: 'DYEING',
            stageLabel: 'Dyeing & Wet Finishing',
            mode: dyeMode,
            requiredOutputHsCode: dyeHsCode,
            stageWastagePct: dyeingWastage,
            qtyKg: Math.round(currentAccumKg * 100) / 100,
            qtyMtr: Math.round((currentAccumKg / kgPerMeterFactor) * 100) / 100,
            billingUnit: dyeUnit,
            invoiceRequired: dyeMode === 'OUTSOURCED',
            invoiceTypeNote: dyeMode === 'OUTSOURCED' 
                ? `Vendor Dyeing Service Bill with Sales Tax under Output Goods HS Code ${dyeHsCode}` 
                : 'In-House Dyeing Process (Internal Gate Pass)',
            fbrComplianceNote: `Vendor bill MUST specify dyed fabric HS Code ${dyeHsCode} as output goods, NOT service code 9983.`
        });
    }

    // Stage B2: Printing (if enabled)
    if (isPrintingActive) {
        currentAccumKg = currentAccumKg * (1 + printWastage / 100);
        const printMode = input.stages.printing.mode;
        const printUnit = input.stages.printing.billingUnit || 'MTR';

        let printHsCode = construction === 'WOVEN'
            ? (input.fiberType === 'STAPLE' ? '5515.1290' : '5407.6100')
            : '6006.3400';

        if (input.exportHsCode.startsWith("6006.34")) {
            printHsCode = '6006.3400';
        }

        chain.unshift({
            stageOrder: 3,
            stageName: 'PRINTING',
            stageLabel: 'Fabric Printing (Rotary / Panel)',
            mode: printMode,
            requiredOutputHsCode: printHsCode,
            stageWastagePct: printWastage,
            qtyKg: Math.round(currentAccumKg * 100) / 100,
            qtyMtr: Math.round((currentAccumKg / kgPerMeterFactor) * 100) / 100,
            billingUnit: printUnit,
            invoiceRequired: printMode === 'OUTSOURCED',
            invoiceTypeNote: printMode === 'OUTSOURCED' 
                ? `Vendor Printing Bill with Sales Tax under Output Goods HS Code ${printHsCode}` 
                : 'In-House Printing Facility (Internal Gate Pass)',
            fbrComplianceNote: `Print job work vendor invoice must declare output goods code ${printHsCode}.`
        });
    }

    // Stage B1: Fabric Manufacturing (Weaving / Knitting Grey)
    if (isFabricActive) {
        currentAccumKg = currentAccumKg * (1 + fabricWastage / 100);
        const fabricMode = input.stages.weavingOrKnitting.mode;
        const fabricUnit = input.stages.weavingOrKnitting.billingUnit || (construction === 'WOVEN' ? 'MTR' : 'KG');

        const fabricHsCode = construction === 'WOVEN'
            ? (input.fiberType === 'STAPLE' ? '5515.1190' : '5407.6100')
            : '6006.3110'; // Unbleached/Bleached grey knitted

        chain.unshift({
            stageOrder: 2,
            stageName: construction === 'WOVEN' ? 'WEAVING' : 'KNITTING',
            stageLabel: construction === 'WOVEN' ? 'Weaving (Grey Fabric / Kora Thaan)' : 'Knitting (Grey Circular/Warp)',
            mode: fabricMode,
            requiredOutputHsCode: fabricHsCode,
            stageWastagePct: fabricWastage,
            qtyKg: Math.round(currentAccumKg * 100) / 100,
            qtyMtr: Math.round((currentAccumKg / kgPerMeterFactor) * 100) / 100,
            billingUnit: fabricUnit,
            invoiceRequired: fabricMode === 'OUTSOURCED',
            invoiceTypeNote: fabricMode === 'OUTSOURCED' 
                ? `Vendor Weaving/Knitting Bill with Sales Tax under Output Grey Code ${fabricHsCode}` 
                : 'In-House Looms/Machines (Internal Conversion Record)',
            fbrComplianceNote: `Outsourced weaving/knitting vendor bill must state grey fabric HS Code ${fabricHsCode}.`
        });
    }

    // Stage A: Raw Yarn Source & Consumption
    currentAccumKg = currentAccumKg * (1 + yarnWastage / 100);
    const yarnRange = input.fiberType === 'FILAMENT'
        ? { start: '5402.1100', end: '5402.6900' }
        : { start: '5509.1100', end: '5509.6900' };

    chain.unshift({
        stageOrder: 1,
        stageName: 'YARN',
        stageLabel: `Raw Yarn (${input.fiberType === 'FILAMENT' ? 'Synthetic Filament Yarn' : 'Synthetic Staple Yarn'})`,
        mode: 'PURCHASE',
        requiredOutputHsCode: `${yarnRange.start} - ${yarnRange.end}`,
        yarnRange,
        stageWastagePct: yarnWastage,
        qtyKg: Math.round(currentAccumKg * 100) / 100,
        qtyMtr: Math.round((currentAccumKg / kgPerMeterFactor) * 100) / 100,
        billingUnit: 'KG',
        invoiceRequired: true,
        invoiceTypeNote: input.stages.yarnSource === 'IMPORT' 
            ? 'Import Goods Declaration (GD) under EFS / Commercial' 
            : 'Local Supplier Sales Tax Purchase Invoice',
        fbrComplianceNote: `Allowed Yarn input tariff range: ${yarnRange.start} to ${yarnRange.end} in KG.`
    });

    return {
        success: errors.length === 0,
        errors,
        warnings,
        constructionType: construction,
        fiberType: input.fiberType,
        baseMetrics: {
            totalExportPcs: input.totalExportPcs,
            fabricPerPieceMtr: input.fabricPerPieceMtr,
            totalFinishedMtr: Math.round(totalFinishedMtr * 100) / 100,
            totalNetWeightKg: input.totalNetWeightKg,
            kgPerMeterFactor: Math.round(kgPerMeterFactor * 1000000) / 1000000,
            totalGrossYarnKg: Math.round(currentAccumKg * 100) / 100,
            overallWastagePct: input.overallWastagePct
        },
        chain
    };
}
