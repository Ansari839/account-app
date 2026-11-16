"use client";

import React, { useState, useMemo } from "react";
import MainLayout from "@/components/MainLayout";
import { 
    calculateReverseConsumption, 
    ScenarioInput, 
    ReverseConsumptionResult, 
    detectConstruction 
} from "@/lib/reverse-consumption";
import { 
    Calculator, 
    Download, 
    Layers, 
    ShieldCheck, 
    Sparkles, 
    FileText, 
    CheckCircle2, 
    AlertTriangle, 
    Settings2, 
    ChevronDown,
    ChevronUp,
    Scale,
    Maximize2,
    SlidersHorizontal,
    Info
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS: Array<{
    name: string;
    description: string;
    data: ScenarioInput;
}> = [
    {
        name: "6214.3000 - Woven Synthetic Scarf (CMT)",
        description: "Export Scarves of synthetic staple/filament yarn with Weaving, Printing, Dyeing, and CMT cutting/stitching.",
        data: {
            exportHsCode: "6214.3000",
            fiberType: "STAPLE",
            exportCondition: "CMT",
            totalExportPcs: 96510,
            fabricPerPieceMtr: 1.25,
            totalNetWeightKg: 18031,
            overallWastagePct: 4.0,
            stages: {
                yarnSource: "IMPORT",
                weavingOrKnitting: { enabled: true, mode: "OUTSOURCED", billingUnit: "MTR", wastagePct: 1.5 },
                printing: { enabled: true, mode: "OUTSOURCED", billingUnit: "MTR", wastagePct: 0.5 },
                dyeingFinishing: { enabled: true, mode: "OUTSOURCED", billingUnit: "KG", wastagePct: 0.5 },
                cmt: { enabled: true, mode: "OUTSOURCED", wastagePct: 1.0 }
            }
        }
    },
    {
        name: "6006.3400 - Printed Knitted Fabric (Loose)",
        description: "Export printed synthetic knitted fabric in rolls/loose with Filament Yarn, Knitting, and Printing.",
        data: {
            exportHsCode: "6006.3400",
            fiberType: "FILAMENT",
            exportCondition: "LOOSE",
            totalExportPcs: undefined,
            fabricPerPieceMtr: 6.5,
            totalNetWeightKg: 15000,
            overallWastagePct: 3.5,
            stages: {
                yarnSource: "LOCAL",
                weavingOrKnitting: { enabled: true, mode: "OUTSOURCED", billingUnit: "KG", wastagePct: 1.5 },
                printing: { enabled: true, mode: "OUTSOURCED", billingUnit: "KG", wastagePct: 1.0 },
                dyeingFinishing: { enabled: false, mode: "IN_HOUSE", billingUnit: "KG", wastagePct: 0.0 },
                cmt: { enabled: false, mode: "IN_HOUSE", wastagePct: 0.0 }
            }
        }
    },
    {
        name: "6006.3200 - Dyed Knitted Fabric (Loose)",
        description: "Export dyed synthetic knitted circular fabric with Knitting and Wet Dyeing.",
        data: {
            exportHsCode: "6006.3200",
            fiberType: "FILAMENT",
            exportCondition: "LOOSE",
            totalExportPcs: undefined,
            fabricPerPieceMtr: 6.5,
            totalNetWeightKg: 20000,
            overallWastagePct: 4.0,
            stages: {
                yarnSource: "IMPORT",
                weavingOrKnitting: { enabled: true, mode: "IN_HOUSE", billingUnit: "KG", wastagePct: 2.0 },
                printing: { enabled: false, mode: "OUTSOURCED", billingUnit: "KG", wastagePct: 0.0 },
                dyeingFinishing: { enabled: true, mode: "OUTSOURCED", billingUnit: "KG", wastagePct: 2.0 },
                cmt: { enabled: false, mode: "IN_HOUSE", wastagePct: 0.0 }
            }
        }
    },
    {
        name: "6117.1000 - Knitted Shawl / Scarf (CMT)",
        description: "Export knitted scarves/shawls of Chapter 61 with Knitting, Dyeing, and CMT stitching.",
        data: {
            exportHsCode: "6117.1000",
            fiberType: "FILAMENT",
            exportCondition: "CMT",
            totalExportPcs: 80000,
            fabricPerPieceMtr: 1.10,
            totalNetWeightKg: 16500,
            overallWastagePct: 4.0,
            stages: {
                yarnSource: "IMPORT",
                weavingOrKnitting: { enabled: true, mode: "OUTSOURCED", billingUnit: "KG", wastagePct: 1.5 },
                printing: { enabled: false, mode: "OUTSOURCED", billingUnit: "KG", wastagePct: 0.0 },
                dyeingFinishing: { enabled: true, mode: "OUTSOURCED", billingUnit: "KG", wastagePct: 1.0 },
                cmt: { enabled: true, mode: "IN_HOUSE", wastagePct: 1.5 }
            }
        }
    }
];

export default function ReverseConsumptionPlannerPage() {
    const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
    const [scenario, setScenario] = useState<ScenarioInput>(PRESETS[0].data);
    const [isConfigCollapsed, setIsConfigCollapsed] = useState<boolean>(false);

    const handleApplyPreset = (idx: number) => {
        setSelectedPresetIndex(idx);
        setScenario(JSON.parse(JSON.stringify(PRESETS[idx].data)));
    };

    // Calculate result in real-time
    const calculation: ReverseConsumptionResult = useMemo(() => {
        return calculateReverseConsumption(scenario);
    }, [scenario]);

    // Export CSV logic for FBR IRIS / EFS filing
    const handleExportCSV = () => {
        if (!calculation || !calculation.chain) return;

        const headers = [
            "Stage Order",
            "Stage Name",
            "Execution Mode",
            "FBR Output Goods HS Code",
            "Yarn Tariff Range",
            "Stage Wastage %",
            "Quantity (KG)",
            "Quantity (Meters)",
            "Billing Unit",
            "Sales Tax Invoice Required",
            "FBR Output Goods Compliance Note"
        ];

        const rows = calculation.chain.map(item => [
            item.stageOrder,
            `"${item.stageLabel}"`,
            item.mode,
            item.requiredOutputHsCode,
            item.yarnRange ? `"${item.yarnRange.start} - ${item.yarnRange.end}"` : 'N/A',
            `${item.stageWastagePct}%`,
            item.qtyKg.toFixed(2),
            item.qtyMtr.toFixed(2),
            item.billingUnit,
            item.invoiceRequired ? "YES (Sales Tax Bill Required)" : "NO (In-House / Internal Gate Pass)",
            `"${item.fbrComplianceNote.replace(/"/g, '""')}"`
        ]);

        const csvContent = [
            `"FBR Textile Reverse Consumption Sheet"`,
            `"Export HS Code:","${scenario.exportHsCode}"`,
            `"Construction:","${calculation.constructionType}"`,
            `"Fiber Type:","${scenario.fiberType}"`,
            `"Export Condition:","${scenario.exportCondition}"`,
            `"Total Net Weight (KG):","${calculation.baseMetrics.totalNetWeightKg}"`,
            `"Total Gross Yarn (KG):","${calculation.baseMetrics.totalGrossYarnKg}"`,
            `"Overall Wastage:","${calculation.baseMetrics.overallWastagePct}%"`,
            `"KG / Meter Factor:","${calculation.baseMetrics.kgPerMeterFactor.toFixed(6)} KG/MTR"`,
            "",
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `FBR_Reverse_Consumption_${scenario.exportHsCode.replace(/\./g, "")}_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <MainLayout>
            <div className="w-full space-y-8 pb-24">
                
                {/* 1. Header Hero Banner */}
                <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-slate-800 shadow-2xl relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                    <div className="relative z-10 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-5">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner shrink-0">
                                    <Sparkles size={28} />
                                </div>
                                <div>
                                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">FBR Reverse Consumption & BOM Engine</h1>
                                    <p className="text-sm sm:text-base text-indigo-200/80 font-medium mt-1">
                                        Rule-Based Reverse BOM & Customs Tariff Chain Compliant with FBR EFS / IOCO Output-Goods Law
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleExportCSV}
                                className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center gap-2.5 shadow-xl shadow-indigo-600/30 transition-all active:scale-95"
                            >
                                <Download size={18} />
                                <span>Export IRIS / EFS CSV</span>
                            </button>
                        </div>

                        {/* Presets Quick Selector */}
                        <div className="pt-5 border-t border-slate-800/80 flex flex-wrap items-center gap-2.5">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">Standard Presets:</span>
                            {PRESETS.map((p, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleApplyPreset(idx)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border",
                                        selectedPresetIndex === idx
                                            ? "bg-indigo-500/30 border-indigo-400 text-white shadow-md shadow-indigo-500/20"
                                            : "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                                    )}
                                >
                                    {p.name.split(" - ")[0]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Validation Warnings / Guardrails */}
                {calculation.warnings.length > 0 && (
                    <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 space-y-1.5 text-sm">
                        <div className="font-bold flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
                            <AlertTriangle size={20} />
                            <span>Customs & Tariff Validation Guardrail:</span>
                        </div>
                        {calculation.warnings.map((w, i) => (
                            <p key={i} className="pl-7 font-medium leading-relaxed">• {w}</p>
                        ))}
                    </div>
                )}

                {/* 2. Top Metric KPI Summary Cards (Full Width) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Gross Yarn</span>
                            <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">KG</span>
                        </div>
                        <div className="text-3xl sm:text-4xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                            {calculation.baseMetrics.totalGrossYarnKg.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-400 font-medium">
                            Includes <span className="font-bold text-indigo-500">{calculation.baseMetrics.overallWastagePct}%</span> cumulative process wastage
                        </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Finished Net Weight</span>
                            <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">KG</span>
                        </div>
                        <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                            {calculation.baseMetrics.totalNetWeightKg.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-400 font-medium">
                            Declared shipment net export weight
                        </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Finished Fabric</span>
                            <span className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">MTR</span>
                        </div>
                        <div className="text-3xl sm:text-4xl font-black font-mono text-purple-600 dark:text-purple-400">
                            {calculation.baseMetrics.totalFinishedMtr.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-400 font-medium">
                            {scenario.exportCondition === "CMT" ? `${scenario.totalExportPcs?.toLocaleString()} pcs × ${scenario.fabricPerPieceMtr}m` : 'Roll / fabric equivalent'}
                        </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Conversion Factor</span>
                            <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">IOCO</span>
                        </div>
                        <div className="text-3xl sm:text-4xl font-black font-mono text-amber-600 dark:text-amber-400">
                            {calculation.baseMetrics.kgPerMeterFactor.toFixed(4)}
                        </div>
                        <div className="text-xs text-slate-400 font-medium">
                            Weight factor per meter (KG / MTR)
                        </div>
                    </div>
                </div>

                {/* 3. Scenario Builder Configuration Panel */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                <SlidersHorizontal size={20} />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                    Scenario Input Parameters
                                </h2>
                                <p className="text-xs text-slate-400 font-medium">
                                    Configure HS Code, fiber construction, export quantities, and manufacturing stages
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsConfigCollapsed(!isConfigCollapsed)}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-2 transition-all"
                        >
                            {isConfigCollapsed ? (
                                <>
                                    <span>Expand Inputs</span>
                                    <ChevronDown size={16} />
                                </>
                            ) : (
                                <>
                                    <span>Collapse Inputs</span>
                                    <ChevronUp size={16} />
                                </>
                            )}
                        </button>
                    </div>

                    {!isConfigCollapsed && (
                        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            
                            {/* Column 1: HS Code & Fiber Type */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                                        <span>Export Output HS Code <span className="text-rose-500">*</span></span>
                                        <span className="text-xs font-mono font-normal text-slate-400">Chapter {scenario.exportHsCode.slice(0, 2)}</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={scenario.exportHsCode}
                                        onChange={e => setScenario({ ...scenario, exportHsCode: e.target.value })}
                                        className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner"
                                        placeholder="e.g. 6214.3000"
                                    />
                                    <div className="flex items-center gap-2 pt-1 text-xs">
                                        <span className="text-slate-400">Construction:</span>
                                        <span className={cn(
                                            "px-2.5 py-0.5 rounded-md font-black text-xs uppercase tracking-wider",
                                            calculation.constructionType === "WOVEN" 
                                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" 
                                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                        )}>
                                            {calculation.constructionType}
                                        </span>
                                    </div>
                                </div>

                                {/* Fiber Type */}
                                <div className="space-y-2">
                                    <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Fiber Type <span className="text-slate-400 font-normal lowercase">(yarn tariff range)</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setScenario({ ...scenario, fiberType: "FILAMENT" })}
                                            className={cn(
                                                "p-4 rounded-2xl border text-left transition-all",
                                                scenario.fiberType === "FILAMENT"
                                                    ? "bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm"
                                                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                                            )}
                                        >
                                            <div className="text-sm font-black uppercase">Filament (5402.*)</div>
                                            <div className="text-xs text-slate-400 mt-1">Continuous yarn (DTY, FDY)</div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setScenario({ ...scenario, fiberType: "STAPLE" })}
                                            className={cn(
                                                "p-4 rounded-2xl border text-left transition-all",
                                                scenario.fiberType === "STAPLE"
                                                    ? "bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm"
                                                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                                            )}
                                        >
                                            <div className="text-sm font-black uppercase">Staple (5509.*)</div>
                                            <div className="text-xs text-slate-400 mt-1">Spun synthetic fiber yarn</div>
                                        </button>
                                    </div>
                                </div>

                                {/* Export Condition */}
                                <div className="space-y-2">
                                    <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Export Condition
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setScenario({ ...scenario, exportCondition: "CMT" })}
                                            className={cn(
                                                "p-4 rounded-2xl border text-left transition-all",
                                                scenario.exportCondition === "CMT"
                                                    ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400 font-bold shadow-sm"
                                                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                                            )}
                                        >
                                            <div className="text-sm font-black uppercase">CMT (Garment / Scarf)</div>
                                            <div className="text-xs text-slate-400 mt-1">Pieces / Cut & Stitched</div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setScenario({ ...scenario, exportCondition: "LOOSE" })}
                                            className={cn(
                                                "p-4 rounded-2xl border text-left transition-all",
                                                scenario.exportCondition === "LOOSE"
                                                    ? "bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400 font-bold shadow-sm"
                                                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                                            )}
                                        >
                                            <div className="text-sm font-black uppercase">LOOSE (Fabric Rolls)</div>
                                            <div className="text-xs text-slate-400 mt-1">Sold in Rolls / Thaan / KG</div>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Shipment Quantities & Wastage */}
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    {scenario.exportCondition === "CMT" && (
                                        <>
                                            <div className="space-y-2">
                                                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Total Export Pcs</label>
                                                <input
                                                    type="number"
                                                    value={scenario.totalExportPcs || ""}
                                                    onChange={e => setScenario({ ...scenario, totalExportPcs: Number(e.target.value) || 0 })}
                                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-base font-mono font-bold text-right bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Meters / Piece</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={scenario.fabricPerPieceMtr || ""}
                                                    onChange={e => setScenario({ ...scenario, fabricPerPieceMtr: Number(e.target.value) || 0 })}
                                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-base font-mono font-bold text-right bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Total Net Weight (KG)</label>
                                        <input
                                            type="number"
                                            value={scenario.totalNetWeightKg || ""}
                                            onChange={e => setScenario({ ...scenario, totalNetWeightKg: Number(e.target.value) || 0 })}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-base font-mono font-bold text-right bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Overall Wastage %</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={scenario.overallWastagePct || ""}
                                            onChange={e => setScenario({ ...scenario, overallWastagePct: Number(e.target.value) || 0 })}
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-base font-mono font-bold text-right bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Yarn Sourcing Origin */}
                                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Yarn Sourcing Origin
                                    </label>
                                    <div className="grid grid-cols-3 gap-2.5">
                                        {(["IMPORT", "LOCAL", "SPLIT"] as const).map(orig => (
                                            <button
                                                key={orig}
                                                type="button"
                                                onClick={() => setScenario({ ...scenario, stages: { ...scenario.stages, yarnSource: orig } })}
                                                className={cn(
                                                    "py-3 rounded-xl border text-center font-bold text-xs uppercase tracking-wider transition-all",
                                                    scenario.stages.yarnSource === orig
                                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                                )}
                                            >
                                                {orig}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Column 3: Manufacturing Stages */}
                            <div className="space-y-4">
                                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Layers size={16} className="text-indigo-600 dark:text-indigo-400" /> Active Workflow Stages
                                </label>

                                {/* 1. Weaving / Knitting Stage */}
                                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between">
                                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase">
                                        1. {calculation.constructionType === "WOVEN" ? "Weaving" : "Knitting"}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setScenario({
                                                ...scenario,
                                                stages: {
                                                    ...scenario.stages,
                                                    weavingOrKnitting: {
                                                        ...scenario.stages.weavingOrKnitting,
                                                        mode: scenario.stages.weavingOrKnitting.mode === "IN_HOUSE" ? "OUTSOURCED" : "IN_HOUSE"
                                                    }
                                                }
                                            })}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all shadow-sm",
                                                scenario.stages.weavingOrKnitting.mode === "OUTSOURCED"
                                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                            )}
                                        >
                                            {scenario.stages.weavingOrKnitting.mode}
                                        </button>
                                        <select
                                            value={scenario.stages.weavingOrKnitting.billingUnit}
                                            onChange={e => setScenario({
                                                ...scenario,
                                                stages: {
                                                    ...scenario.stages,
                                                    weavingOrKnitting: {
                                                        ...scenario.stages.weavingOrKnitting,
                                                        billingUnit: e.target.value as any
                                                    }
                                                }
                                            })}
                                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                        >
                                            <option value="MTR">MTR</option>
                                            <option value="KG">KG</option>
                                        </select>
                                    </div>
                                </div>

                                {/* 2. Printing Stage */}
                                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between">
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={scenario.stages.printing.enabled}
                                            onChange={e => setScenario({
                                                ...scenario,
                                                stages: {
                                                    ...scenario.stages,
                                                    printing: {
                                                        ...scenario.stages.printing,
                                                        enabled: e.target.checked
                                                    }
                                                }
                                            })}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase">
                                            2. Printing Stage
                                        </span>
                                    </label>

                                    {scenario.stages.printing.enabled && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setScenario({
                                                    ...scenario,
                                                    stages: {
                                                        ...scenario.stages,
                                                        printing: {
                                                            ...scenario.stages.printing,
                                                            mode: scenario.stages.printing.mode === "IN_HOUSE" ? "OUTSOURCED" : "IN_HOUSE"
                                                        }
                                                    }
                                                })}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all shadow-sm",
                                                    scenario.stages.printing.mode === "OUTSOURCED"
                                                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                                )}
                                            >
                                                {scenario.stages.printing.mode}
                                            </button>
                                            <select
                                                value={scenario.stages.printing.billingUnit}
                                                onChange={e => setScenario({
                                                    ...scenario,
                                                    stages: {
                                                        ...scenario.stages,
                                                        printing: {
                                                            ...scenario.stages.printing,
                                                            billingUnit: e.target.value as any
                                                        }
                                                    }
                                                })}
                                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                            >
                                                <option value="MTR">MTR</option>
                                                <option value="KG">KG</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* 3. Dyeing & Finishing Stage */}
                                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between">
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={scenario.stages.dyeingFinishing.enabled}
                                            onChange={e => setScenario({
                                                ...scenario,
                                                stages: {
                                                    ...scenario.stages,
                                                    dyeingFinishing: {
                                                        ...scenario.stages.dyeingFinishing,
                                                        enabled: e.target.checked
                                                    }
                                                }
                                            })}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase">
                                            3. Dyeing & Finishing
                                        </span>
                                    </label>

                                    {scenario.stages.dyeingFinishing.enabled && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setScenario({
                                                    ...scenario,
                                                    stages: {
                                                        ...scenario.stages,
                                                        dyeingFinishing: {
                                                            ...scenario.stages.dyeingFinishing,
                                                            mode: scenario.stages.dyeingFinishing.mode === "IN_HOUSE" ? "OUTSOURCED" : "IN_HOUSE"
                                                        }
                                                    }
                                                })}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all shadow-sm",
                                                    scenario.stages.dyeingFinishing.mode === "OUTSOURCED"
                                                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                                )}
                                            >
                                                {scenario.stages.dyeingFinishing.mode}
                                            </button>
                                            <select
                                                value={scenario.stages.dyeingFinishing.billingUnit}
                                                onChange={e => setScenario({
                                                    ...scenario,
                                                    stages: {
                                                        ...scenario.stages,
                                                        dyeingFinishing: {
                                                            ...scenario.stages.dyeingFinishing,
                                                            billingUnit: e.target.value as any
                                                        }
                                                    }
                                                })}
                                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                            >
                                                <option value="KG">KG</option>
                                                <option value="MTR">MTR</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* 4. CMT Cutting & Stitching Stage */}
                                {scenario.exportCondition === "CMT" && (
                                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between">
                                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase">
                                            4. CMT (Cutting & Stitching)
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setScenario({
                                                ...scenario,
                                                stages: {
                                                    ...scenario.stages,
                                                    cmt: {
                                                        ...scenario.stages.cmt,
                                                        mode: scenario.stages.cmt.mode === "IN_HOUSE" ? "OUTSOURCED" : "IN_HOUSE"
                                                    }
                                                }
                                            })}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all shadow-sm",
                                                scenario.stages.cmt.mode === "OUTSOURCED"
                                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                            )}
                                        >
                                            {scenario.stages.cmt.mode}
                                        </button>
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                </div>

                {/* 4. Full Width FBR Stage-by-Stage Reverse Consumption Chain Table */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 sm:p-7 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <ShieldCheck size={22} />
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                    FBR Stage-by-Stage Reverse Consumption Chain
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">
                                    Calculated reverse input requirements compliant with FBR Output-Goods principle
                                </p>
                            </div>
                        </div>

                        <span className="text-xs sm:text-sm font-black uppercase px-4 py-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            {calculation.chain.length} Stages Verified
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 font-black uppercase tracking-wider text-xs sm:text-sm">
                                    <th className="py-4 px-6 min-w-[260px]">Stage</th>
                                    <th className="py-4 px-5 min-w-[140px]">Execution Mode</th>
                                    <th className="py-4 px-5 min-w-[180px]">Output Goods HS Code</th>
                                    <th className="py-4 px-4 text-right min-w-[110px]">Wastage %</th>
                                    <th className="py-4 px-6 text-right min-w-[170px]">Req. Qty (KG)</th>
                                    <th className="py-4 px-6 text-right min-w-[170px]">Req. Qty (MTR)</th>
                                    <th className="py-4 px-6 text-center min-w-[190px]">FBR Invoice Requirement</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {calculation.chain.map((st, i) => (
                                    <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                        {/* Stage Name */}
                                        <td className="py-5 px-6 font-bold text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-3">
                                                <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs sm:text-sm font-mono font-bold shrink-0">
                                                    {i + 1}
                                                </span>
                                                <div>
                                                    <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                                                        {st.stageLabel}
                                                    </div>
                                                    {st.yarnRange && (
                                                        <div className="text-xs font-mono font-bold text-slate-400 mt-0.5">
                                                            Tariff: {st.yarnRange.start} – {st.yarnRange.end}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Execution Mode */}
                                        <td className="py-5 px-5 whitespace-nowrap">
                                            <span className={cn(
                                                "px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider inline-block",
                                                st.mode === "OUTSOURCED"
                                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25"
                                                    : st.mode === "PURCHASE"
                                                    ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/25"
                                                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25"
                                            )}>
                                                {st.mode}
                                            </span>
                                        </td>

                                        {/* Output Goods HS Code */}
                                        <td className="py-5 px-5 font-mono font-black text-base sm:text-lg text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                            {st.requiredOutputHsCode}
                                        </td>

                                        {/* Stage Wastage % */}
                                        <td className="py-5 px-4 text-right font-mono font-bold text-sm sm:text-base text-slate-700 dark:text-slate-300">
                                            {st.stageWastagePct > 0 ? `${st.stageWastagePct.toFixed(1)}%` : '0.0%'}
                                        </td>

                                        {/* Required Qty (KG) */}
                                        <td className="py-5 px-6 text-right font-mono font-black text-base sm:text-lg text-slate-900 dark:text-white whitespace-nowrap">
                                            {st.qtyKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            <span className="text-xs font-bold text-slate-400 ml-1">KG</span>
                                        </td>

                                        {/* Required Qty (MTR) */}
                                        <td className="py-5 px-6 text-right font-mono font-black text-base sm:text-lg text-purple-600 dark:text-purple-400 whitespace-nowrap">
                                            {st.qtyMtr > 0 ? (
                                                <>
                                                    {st.qtyMtr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    <span className="text-xs font-bold text-purple-400 ml-1">MTR</span>
                                                </>
                                            ) : (
                                                <span className="text-slate-400 font-bold">-</span>
                                            )}
                                        </td>

                                        {/* FBR Invoice Requirement */}
                                        <td className="py-5 px-6 text-center whitespace-nowrap">
                                            {st.invoiceRequired ? (
                                                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                                    <CheckCircle2 size={14} className="text-amber-600 dark:text-amber-400" /> Sales Tax Bill Required
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                    Internal Gate Pass
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Detailed Compliance Notes Card */}
                    <div className="p-6 sm:p-8 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 space-y-4">
                        <h4 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <FileText size={18} className="text-indigo-600 dark:text-indigo-400" /> FBR Output-Goods Compliance & Audit Notes
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
                            {calculation.chain.map((st, i) => (
                                <div key={i} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-start gap-3">
                                    <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 shrink-0">[{st.stageName}]:</span>
                                    <span className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">{st.fbrComplianceNote}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </MainLayout>
    );
}