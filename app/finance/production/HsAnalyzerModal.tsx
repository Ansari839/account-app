"use client";

import React, { useState, useEffect } from "react";
import { authenticatedFetch } from "@/lib/api-client";
import {
    Sparkles, X, Search, CheckCircle2, AlertCircle, ArrowDown,
    Layers, RefreshCw, Cpu, Box, Scissors, Droplets
} from "lucide-react";

interface HsAnalyzerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function HsAnalyzerModal({ isOpen, onClose }: HsAnalyzerModalProps) {
    const [selectedHsCode, setSelectedHsCode] = useState<string>("6214.3000");
    const [customHsInput, setCustomHsInput] = useState<string>("");
    const [targetQty, setTargetQty] = useState<number>(61004);
    const [loading, setLoading] = useState<boolean>(false);
    const [presets, setPresets] = useState<any[]>([]);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchPresets();
            runAnalysis(selectedHsCode, targetQty);
        }
    }, [isOpen]);

    const fetchPresets = async () => {
        try {
            const res = await authenticatedFetch("/api/finance/production/hs-analyzer");
            const json = await res.json();
            if (json.success && json.presets) {
                setPresets(json.presets);
            }
        } catch (err) {
            console.error("Failed to fetch presets", err);
        }
    };

    const runAnalysis = async (code: string, qty: number) => {
        if (!code) return;
        setLoading(true);
        setError(null);
        try {
            const res = await authenticatedFetch(`/api/finance/production/hs-analyzer?hsCode=${encodeURIComponent(code)}&qty=${qty}`);
            const json = await res.json();
            if (json.success) {
                setAnalysisResult(json.data);
            } else {
                setError(json.error || "Analysis failed");
            }
        } catch (err: any) {
            setError(err.message || "Failed to analyze HS Code");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPreset = (code: string) => {
        setSelectedHsCode(code);
        setCustomHsInput("");
        runAnalysis(code, targetQty);
    };

    const handleCustomSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!customHsInput.trim()) return;
        setSelectedHsCode(customHsInput.trim());
        runAnalysis(customHsInput.trim(), targetQty);
    };

    const handleQtyChange = (val: number) => {
        const q = isNaN(val) ? 0 : val;
        setTargetQty(q);
        runAnalysis(selectedHsCode, q);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                    HS Code Input & Consumption Analyzer
                                </h3>
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                                    Testing Prototype
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Output HS code ke mutabiq required Raw Material (Yarn) aur backward stages check karein.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    
                    {/* Top Selectors & Presets */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Select Output HS Code (Finished Export Item):
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                            {presets.map((p) => {
                                const isSelected = selectedHsCode === p.hsCode;
                                return (
                                    <button
                                        key={p.hsCode}
                                        type="button"
                                        onClick={() => handleSelectPreset(p.hsCode)}
                                        className={`p-3 rounded-2xl text-left border transition-all text-xs flex flex-col justify-between gap-1.5 ${
                                            isSelected
                                                ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 shadow-md ring-2 ring-indigo-500/20"
                                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300"
                                        }`}
                                    >
                                        <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                                            {p.hsCode}
                                        </div>
                                        <div className="font-semibold line-clamp-1">{p.title}</div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Custom HS Code Input and Target Qty */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <form onSubmit={handleCustomSearch} className="flex-1 flex gap-2">
                                <div className="relative flex-1">
                                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Or enter any custom HS Code (e.g. 6214.3000)..."
                                        value={customHsInput}
                                        onChange={(e) => setCustomHsInput(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
                                >
                                    Check
                                </button>
                            </form>

                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Target Qty (KG):</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={targetQty}
                                    onChange={(e) => handleQtyChange(parseFloat(e.target.value) || 0)}
                                    className="w-32 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Result Container */}
                    {loading ? (
                        <div className="py-16 flex flex-col items-center justify-center space-y-3">
                            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                            <p className="text-xs font-bold text-slate-400">Analyzing backward production chain...</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-3">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    ) : analysisResult ? (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            
                            {/* Selected Output Card */}
                            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div>
                                    <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-300 mb-1">
                                        Target Finished Product
                                    </div>
                                    <div className="text-lg font-black flex items-center gap-2">
                                        <span className="font-mono text-amber-400">{analysisResult.hsCode}</span>
                                        <span>— {analysisResult.rule.outputTitle}</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">{analysisResult.rule.description}</p>
                                </div>
                                <div className="text-right border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-6">
                                    <div className="text-[10px] uppercase font-bold text-slate-400">Export / Finished Weight</div>
                                    <div className="text-2xl font-black text-emerald-400 font-mono">
                                        {Number(analysisResult.targetQty).toLocaleString()} <span className="text-xs text-slate-300 font-sans">KG</span>
                                    </div>
                                </div>
                            </div>

                            {/* 1. Allowed Input HS Codes (Core Requirement) */}
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Cpu size={16} className="text-indigo-500" />
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                            Required Input HS Codes (Physical Raw Material)
                                        </h4>
                                    </div>
                                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                        Total Yarn Required: {Number(analysisResult.requiredYarnQty).toLocaleString()} KG
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {analysisResult.rule.allowedInputHsCodes.map((input: any) => (
                                        <div key={input.code} className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start gap-3 shadow-sm">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                                <Box size={16} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">{input.code}</span>
                                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                                                        Allowed Input
                                                    </span>
                                                </div>
                                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{input.name}</div>
                                                <div className="text-[11px] text-slate-400 mt-1">Usage: {input.typicalUse}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 2. Backward Production Chain (Stages with Wastage & Modes) */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Layers size={16} className="text-indigo-500" />
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                        Backward Production Stages & Business Flow
                                    </h4>
                                </div>

                                <div className="space-y-2">
                                    {analysisResult.rule.calculatedStages.map((stage: any, idx: number) => {
                                        const isService = stage.type === "SERVICE";
                                        const isRM = stage.type === "RAW_MATERIAL";

                                        return (
                                            <div
                                                key={idx}
                                                className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                                        isService ? "bg-amber-500/10 text-amber-500" : isRM ? "bg-emerald-500/10 text-emerald-500" : "bg-indigo-500/10 text-indigo-500"
                                                    }`}>
                                                        {isService ? <Droplets size={16} /> : isRM ? <Box size={16} /> : <Scissors size={16} />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{stage.stageName}</span>
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                stage.mode === "OUT_HOUSE"
                                                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                                                                    : stage.mode === "IN_HOUSE_OR_OUT_HOUSE"
                                                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400"
                                                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                                                            }`}>
                                                                {stage.mode === "OUT_HOUSE" ? "Outside Service Bill" : stage.mode === "IN_HOUSE_OR_OUT_HOUSE" ? "In-House or Out-House" : "Physical Warehouse RM"}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stage.note}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6 self-end md:self-center border-t md:border-t-0 pt-2 md:pt-0">
                                                    <div className="text-right">
                                                        <div className="text-[10px] font-bold uppercase text-slate-400">Wastage</div>
                                                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                                                            {stage.wastagePercent}% {stage.wastageQty > 0 && `(+${stage.wastageQty.toLocaleString()} KG)`}
                                                        </div>
                                                    </div>
                                                    <div className="text-right min-w-[100px]">
                                                        <div className="text-[10px] font-bold uppercase text-slate-400">Required Qty</div>
                                                        <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                                            {Number(stage.requiredQty).toLocaleString()} KG
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 3. Live Warehouse Stock Matching */}
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 size={16} className="text-emerald-500" />
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                            Matching Stock in Your Warehouse
                                        </h4>
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        {analysisResult.inventoryMatches?.length || 0} product(s) found
                                    </span>
                                </div>

                                {analysisResult.inventoryMatches?.length === 0 ? (
                                    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-xs text-slate-400">
                                        No products currently found in database with HS Code matching the allowed input list.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400">
                                                    <th className="pb-2">Code</th>
                                                    <th className="pb-2">Product Name</th>
                                                    <th className="pb-2">HS Code</th>
                                                    <th className="pb-2">Stage</th>
                                                    <th className="pb-2 text-right">Available Stock</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                                {analysisResult.inventoryMatches.map((item: any) => (
                                                    <tr key={item.id} className="hover:bg-white dark:hover:bg-slate-900 transition-colors">
                                                        <td className="py-2.5 font-mono font-bold text-slate-600 dark:text-slate-400">{item.code}</td>
                                                        <td className="py-2.5 font-bold text-slate-900 dark:text-white">{item.name}</td>
                                                        <td className="py-2.5 font-mono text-indigo-600 dark:text-indigo-400">{item.hsCode}</td>
                                                        <td className="py-2.5">
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                                {item.stage || "RAW"}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                                                            {Number(item.availableStock).toLocaleString()} KG
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                        </div>
                    ) : null}

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                    <span className="text-[11px] text-slate-400">
                        Based on Pakistan Customs Tariff & Textile Manufacturing Rules.
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl text-xs transition-all shadow-md active:scale-95"
                    >
                        Close
                    </button>
                </div>

            </div>
        </div>
    );
}
