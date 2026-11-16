"use client";

import React, { useState, useEffect, useMemo } from "react";
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
    ArrowRight, 
    Settings2, 
    Scissors, 
    Droplets, 
    Cpu, 
    Building2, 
    RefreshCw,
    Box,
    ExternalLink
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
        name: "6006.3400 - Printed Polyester Knitted Fabric (Loose)",
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
        name: "6006.3200 - Dyed Polyester Knitted Fabric (Loose)",
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
        name: "6117.1000 - Knitted Synthetic Shawl / Scarf (CMT)",
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
            <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
                
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                    <div className="relative z-10 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
                                    <Sparkles size={24} />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black tracking-tight">FBR Reverse Consumption & BOM Engine</h1>
                                    <p className="text-xs text-indigo-200/80 font-medium">
                                        Rule-Based Reverse BOM & Customs Tariff Chain Compliant with FBR EFS / IOCO Output-Goods Law
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleExportCSV}
                                className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                            >
                                <Download size={16} />
                                <span>Export IRIS / EFS CSV</span>
                            </button>
                        </div>

                        {/* Presets Quick Selector */}
                        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mr-2">Standard Presets:</span>
                            {PRESETS.map((p, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleApplyPreset(idx)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                                        selectedPresetIndex === idx
                                            ? "bg-indigo-500/30 border-indigo-400 text-white shadow-sm"
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
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 space-y-1 text-xs">
                        <div className="font-bold flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                            <AlertTriangle size={18} />
                            <span>Customs & Tariff Validation Guardrail:</span>
                        </div>
                        {calculation.warnings.map((w, i) => (
                            <p key={i} className="pl-6 font-medium">• {w}</p>
                        ))}
                    </div>
                )}

                {/* Main 2-Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* LEFT COLUMN: SCENARIO BUILDER FORM (5 Cols) */}
                    <div className="lg:col-span-5 space-y-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        
                        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <Settings2 size={18} className="text-indigo-600 dark:text-indigo-400" />
                            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">Scenario Input Parameters</h2>
                        </div>

                        {/* Export HS Code & Fiber Type */}
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Export Output HS Code <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={scenario.exportHsCode}
                                    onChange={e => setScenario({ ...scenario, exportHsCode: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g. 6214.3000 or 6006.3400"
                                />
                                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                                    <span>Detected: <strong className="text-indigo-600 dark:text-indigo-400">{calculation.constructionType}</strong></span>
                                    <span>Chapter: {scenario.exportHsCode.slice(0, 2)}</span>
                                </div>
                            </div>

                            {/* Fiber Type (Determines 5402 Filament vs 5509 Staple) */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Fiber Type <span className="text-slate-400 font-normal">(Determines Yarn Tariff Range)</span>
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setScenario({ ...scenario, fiberType: "FILAMENT" })}
                                        className={cn(
                                            "p-3 rounded-xl border text-left transition-all",
                                            scenario.fiberType === "FILAMENT"
                                                ? "bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm"
                                                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                        )}
                                    >
                                        <div className="text-xs font-black uppercase">Filament (5402.*)</div>
                                        <div className="text-[10px] text-slate-400">Continuous yarn (DTY, FDY)</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setScenario({ ...scenario, fiberType: "STAPLE" })}
                                        className={cn(
                                            "p-3 rounded-xl border text-left transition-all",
                                            scenario.fiberType === "STAPLE"
                                                ? "bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm"
                                                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                        )}
                                    >
                                        <div className="text-xs font-black uppercase">Staple (5509.*)</div>
                                        <div className="text-[10px] text-slate-400">Spun synthetic fiber yarn</div>
                                    </button>
                                </div>
                            </div>

                            {/* Export Condition: CMT vs Loose */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Export Condition
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setScenario({ ...scenario, exportCondition: "CMT" })}
                                        className={cn(
                                            "p-3 rounded-xl border text-left transition-all",
                                            scenario.exportCondition === "CMT"
                                                ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400 font-bold shadow-sm"
                                                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                        )}
                                    >
                                        <div className="text-xs font-black uppercase">CMT (Garment / Scarf)</div>
                                        <div className="text-[10px] text-slate-400">Pieces / Cut & Stitched</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setScenario({ ...scenario, exportCondition: "LOOSE" })}
                                        className={cn(
                                            "p-3 rounded-xl border text-left transition-all",
                                            scenario.exportCondition === "LOOSE"
                                                ? "bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400 font-bold shadow-sm"
                                                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                        )}
                                    >
                                        <div className="text-xs font-black uppercase">LOOSE (Fabric Rolls)</div>
                                        <div className="text-[10px] text-slate-400">Sold in Rolls / Thaan / KG</div>
                                    </button>
                                </div>
                            </div>

                            {/* Shipment Quantities */}
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                {scenario.exportCondition === "CMT" && (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Total Export Pcs</label>
                                            <input
                                                type="number"
                                                value={scenario.totalExportPcs || ""}
                                                onChange={e => setScenario({ ...scenario, totalExportPcs: Number(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold text-right bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Meters / Piece</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={scenario.fabricPerPieceMtr || ""}
                                                onChange={e => setScenario({ ...scenario, fabricPerPieceMtr: Number(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold text-right bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Total Net Weight (KG)</label>
                                    <input
                                        type="number"
                                        value={scenario.totalNetWeightKg || ""}
                                        onChange={e => setScenario({ ...scenario, totalNetWeightKg: Number(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold text-right bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Overall Wastage %</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={scenario.overallWastagePct || ""}
                                        onChange={e => setScenario({ ...scenario, overallWastagePct: Number(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold text-right bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Manufacturing Workflow Stages (Toggles & In-House vs Outsourced) */}
                        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers size={14} className="text-indigo-600 dark:text-indigo-400" /> Manufacturing Workflow Stages
                            </label>

                            {/* 1. Weaving / Knitting Stage */}
                            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/40 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
                                        1. {calculation.constructionType === "WOVEN" ? "Weaving" : "Knitting"} (Grey Fabric)
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
                                                "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all",
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
                                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                                        >
                                            <option value="MTR">MTR</option>
                                            <option value="KG">KG</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Printing Stage */}
                            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/40 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 cursor-pointer">
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
                                            className="rounded text-indigo-600"
                                        />
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
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
                                                    "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all",
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
                                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                                            >
                                                <option value="MTR">MTR</option>
                                                <option value="KG">KG</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 3. Dyeing & Finishing Stage */}
                            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/40 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 cursor-pointer">
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
                                            className="rounded text-indigo-600"
                                        />
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
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
                                                    "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all",
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
                                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                                            >
                                                <option value="KG">KG</option>
                                                <option value="MTR">MTR</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 4. CMT Cutting & Stitching Stage */}
                            {scenario.exportCondition === "CMT" && (
                                <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/40 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
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
                                                "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all",
                                                scenario.stages.cmt.mode === "OUTSOURCED"
                                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                            )}
                                        >
                                            {scenario.stages.cmt.mode}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: REVERSE CHAIN RESULT TABLE & METRICS (7 Cols) */}
                    <div className="lg:col-span-7 space-y-6">
                        
                        {/* Summary KPI Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Gross Yarn</span>
                                <span className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400">
                                    {calculation.baseMetrics.totalGrossYarnKg.toLocaleString()} KG
                                </span>
                            </div>

                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Finished Net Weight</span>
                                <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                                    {calculation.baseMetrics.totalNetWeightKg.toLocaleString()} KG
                                </span>
                            </div>

                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Finished Fabric MTR</span>
                                <span className="text-lg font-black font-mono text-purple-600 dark:text-purple-400">
                                    {calculation.baseMetrics.totalFinishedMtr.toLocaleString()} MTR
                                </span>
                            </div>

                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Conversion Factor</span>
                                <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">
                                    {calculation.baseMetrics.kgPerMeterFactor.toFixed(4)} <span className="text-[10px] text-slate-400">KG/MTR</span>
                                </span>
                            </div>
                        </div>

                        {/* Reverse Chain Result Table */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={20} className="text-emerald-500" />
                                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                        FBR Stage-by-Stage Reverse Consumption Chain
                                    </h3>
                                </div>
                                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                    {calculation.chain.length} Stages Verified
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                            <th className="py-3 px-4">Stage</th>
                                            <th className="py-3 px-3">Mode</th>
                                            <th className="py-3 px-3">Output HS Code</th>
                                            <th className="py-3 px-3 text-right">Wastage</th>
                                            <th className="py-3 px-3 text-right">Req. Qty (KG)</th>
                                            <th className="py-3 px-3 text-right">Req. Qty (MTR)</th>
                                            <th className="py-3 px-4 text-center">Invoice Req.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                        {calculation.chain.map((st, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[10px] font-mono">
                                                            {i + 1}
                                                        </span>
                                                        <span>{st.stageLabel}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                                                        st.mode === "OUTSOURCED"
                                                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                                                            : st.mode === "PURCHASE"
                                                            ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20"
                                                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                                    )}>
                                                        {st.mode}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                    {st.requiredOutputHsCode}
                                                </td>
                                                <td className="py-3 px-3 text-right font-mono font-semibold text-slate-600 dark:text-slate-300">
                                                    {st.stageWastagePct > 0 ? `${st.stageWastagePct}%` : '0%'}
                                                </td>
                                                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                    {st.qtyKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-3 px-3 text-right font-mono font-semibold text-purple-600 dark:text-purple-400">
                                                    {st.qtyMtr > 0 ? st.qtyMtr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {st.invoiceRequired ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                                            <CheckCircle2 size={11} /> Required
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
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
                            <div className="p-5 bg-slate-50/60 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <FileText size={14} className="text-indigo-600" /> FBR Output-Goods Compliance & Audit Notes
                                </h4>
                                <div className="space-y-2 text-xs">
                                    {calculation.chain.map((st, i) => (
                                        <div key={i} className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                                            <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">• [{st.stageName}]:</span>
                                            <span>{st.fbrComplianceNote}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </MainLayout>
    );
}
