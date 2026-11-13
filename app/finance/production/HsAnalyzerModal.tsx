"use client";

import React, { useState, useEffect } from "react";
import { authenticatedFetch } from "@/lib/api-client";
import {
    Sparkles, X, Search, CheckCircle2, AlertCircle, ArrowDown,
    Layers, RefreshCw, Cpu, Box, Scissors, Droplets, ShieldCheck,
    AlertTriangle, ShoppingCart, Info, TrendingUp, Check
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
    const [activeView, setActiveView] = useState<'BOTH' | 'ACTUAL_ONLY' | 'FIT_ONLY'>('BOTH');

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

    const actual = analysisResult?.actualStandardRecipe;
    const fit = analysisResult?.inventoryFitAnalysis;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                            <Sparkles size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                    HS Code Production & Stock Fit Analyzer
                                </h3>
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    Standard & Fit Gap
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                1) Review technical standard production recipe, and 2) Audit warehouse inventory fitment and material shortfall.
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
                    <div className="space-y-3 bg-slate-50/60 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Step 1: Select Output Finished Product (Export Item)
                            </label>
                            <span className="text-[11px] text-slate-400">Pakistan Customs Tariff Presets</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                            {presets.map((p) => {
                                const isSelected = selectedHsCode === p.hsCode;
                                return (
                                    <button
                                        key={p.hsCode}
                                        type="button"
                                        onClick={() => handleSelectPreset(p.hsCode)}
                                        className={`p-3 rounded-2xl text-left border transition-all text-xs flex flex-col justify-between gap-1.5 ${
                                            isSelected
                                                ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 shadow-sm ring-2 ring-indigo-500/20"
                                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300"
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
                        <div className="flex flex-col sm:flex-row gap-3 pt-1">
                            <form onSubmit={handleCustomSearch} className="flex-1 flex gap-2">
                                <div className="relative flex-1">
                                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Or enter any custom HS Code (e.g. 6214.3000)..."
                                        value={customHsInput}
                                        onChange={(e) => setCustomHsInput(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
                                >
                                    Analyze
                                </button>
                            </form>

                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800">
                                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Target Export Qty:</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={targetQty}
                                    onChange={(e) => handleQtyChange(parseFloat(e.target.value) || 0)}
                                    className="w-28 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                                />
                                <span className="text-xs font-bold text-slate-400">KG</span>
                            </div>
                        </div>
                    </div>

                    {/* Result Container */}
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center space-y-3">
                            <RefreshCw className="w-9 h-9 text-indigo-500 animate-spin" />
                            <p className="text-xs font-bold text-slate-400">Running standard recipe and inventory fit audit...</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-3">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    ) : actual && fit ? (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            
                            {/* Target Output Header Banner */}
                            <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-indigo-300 mb-1">
                                        <span>Target Finished Export Product</span>
                                    </div>
                                    <div className="text-lg font-black flex items-center gap-2.5">
                                        <span className="font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20">
                                            {analysisResult.hsCode}
                                        </span>
                                        <span>{actual.outputTitle}</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">{actual.description}</p>
                                    <div className="text-[11px] text-indigo-300 font-medium mt-1">
                                        Specs: {actual.standardSpecs}
                                    </div>
                                </div>
                                <div className="text-right border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-6 shrink-0">
                                    <div className="text-[10px] uppercase font-bold text-slate-400">Total Standard Yarn Required</div>
                                    <div className="text-2xl font-black text-amber-400 font-mono">
                                        {Number(actual.totalActualYarnRequired).toLocaleString()} <span className="text-xs text-slate-300 font-sans">KG</span>
                                    </div>
                                    <div className="text-[11px] text-slate-400">For {Number(analysisResult.targetQty).toLocaleString()} KG Output</div>
                                </div>
                            </div>

                            {/* SECTION A: ACTUAL TECHNICAL & CUSTOMS STANDARD (BENCHMARK) */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-xs">
                                            A
                                        </div>
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                            Actual Standard Recipe (Asal Formula & Stages)
                                        </h4>
                                    </div>
                                    <span className="text-[11px] text-slate-400">
                                        Independent of warehouse stock
                                    </span>
                                </div>

                                {/* Stages Table */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {actual.stages.map((stage: any, idx: number) => {
                                        const isService = stage.type === "SERVICE";
                                        const isRM = stage.type === "RAW_MATERIAL";
                                        return (
                                            <div key={idx} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3 shadow-sm">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                            isService ? "bg-amber-500/10 text-amber-500" : isRM ? "bg-emerald-500/10 text-emerald-500" : "bg-indigo-500/10 text-indigo-500"
                                                        }`}>
                                                            {isService ? <Droplets size={14} /> : isRM ? <Box size={14} /> : <Scissors size={14} />}
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-900 dark:text-white">{stage.stageName}</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                        {stage.wastagePercent}% Wastage
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] uppercase font-bold text-slate-400">Required Quantity</div>
                                                    <div className="text-base font-black font-mono text-indigo-600 dark:text-indigo-400">
                                                        {Number(stage.requiredQty).toLocaleString()} KG
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{stage.note}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* SECTION B: INVENTORY FIT & GAP ANALYSIS (HUMARA STOCK KITNA FIT HOTA HAI) */}
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-md bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-xs">
                                            B
                                        </div>
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                            Inventory Fit & Gap Analysis (Humara Stock Kahan Fit Hota Hai)
                                        </h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500">Overall Coverage:</span>
                                        <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                                            fit.overallFitStatus === "OK" 
                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                                        }`}>
                                            {fit.overallCoveragePercent}% Covered
                                        </span>
                                    </div>
                                </div>

                                {/* Summary Bar */}
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Total Yarn Needed (Formula)</div>
                                        <div className="text-lg font-black font-mono text-slate-800 dark:text-slate-200">
                                            {Number(fit.totalActualYarnRequired).toLocaleString()} KG
                                        </div>
                                    </div>
                                    <div className="border-t sm:border-t-0 sm:border-l sm:border-r border-slate-200 dark:border-slate-800 pt-2 sm:pt-0">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Usable Stock in Warehouse</div>
                                        <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                                            {Number(fit.totalAvailableWarehouseStock).toLocaleString()} KG
                                        </div>
                                    </div>
                                    <div className="border-t sm:border-t-0 pt-2 sm:pt-0">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Shortfall (Kam Hai)</div>
                                        <div className={`text-lg font-black font-mono ${
                                            fit.overallShortfall > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"
                                        }`}>
                                            {fit.overallShortfall > 0 ? `${Number(fit.overallShortfall).toLocaleString()} KG` : "0 KG (OK)"}
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Per-HS-Code Fit Cards */}
                                <div className="space-y-4">
                                    {fit.codeBreakdown.map((row: any) => {
                                        const isOk = row.fitStatus === "OK";
                                        const isOutOfStock = row.fitStatus === "OUT_OF_STOCK";

                                        return (
                                            <div
                                                key={row.hsCode}
                                                className={`p-5 rounded-2xl border transition-all ${
                                                    isOk
                                                        ? "bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-950/60 shadow-sm"
                                                        : isOutOfStock
                                                        ? "bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-950/60 shadow-sm"
                                                        : "bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-950/60 shadow-sm"
                                                }`}
                                            >
                                                {/* Card Header */}
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono font-black text-slate-900 dark:text-white text-base">
                                                                {row.hsCode}
                                                            </span>
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                                {row.name}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                                                {row.standardSharePercent}% Share
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-400 mt-0.5">Use: {row.typicalUse}</p>
                                                    </div>

                                                    {/* Fit Status Badge */}
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                                                            isOk
                                                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                                                : isOutOfStock
                                                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                                        }`}>
                                                            {isOk ? <CheckCircle2 size={14} /> : isOutOfStock ? <AlertCircle size={14} /> : <AlertTriangle size={14} />}
                                                            <span>{row.statusMessage}</span>
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Numbers & Progress */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 text-xs">
                                                    <div>
                                                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Standard Required</span>
                                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                            {Number(row.requiredQty).toLocaleString()} KG
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 block text-[10px] uppercase font-bold">In Warehouse Stock</span>
                                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                            {Number(row.availableStock).toLocaleString()} KG
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Stock Fit / Usable</span>
                                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                            {Number(row.coveredQty).toLocaleString()} KG
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Material Shortfall</span>
                                                        <span className={`font-mono font-bold ${
                                                            row.shortfallQty > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"
                                                        }`}>
                                                            {row.shortfallQty > 0 ? `${Number(row.shortfallQty).toLocaleString()} KG` : "0 KG"}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Progress Bar */}
                                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-3">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                            isOk ? "bg-emerald-500" : isOutOfStock ? "bg-rose-500" : "bg-amber-500"
                                                        }`}
                                                        style={{ width: `${row.coveragePercent}%` }}
                                                    />
                                                </div>

                                                {/* Matched Products List from Warehouse */}
                                                <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                                                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center justify-between">
                                                        <span>Matching Items In Warehouse ({row.items.length})</span>
                                                        {row.items.length === 0 && (
                                                            <span className="text-rose-500 font-bold flex items-center gap-1">
                                                                <ShoppingCart size={12} /> Naya Purchase / Import Karna Parega
                                                            </span>
                                                        )}
                                                    </div>

                                                    {row.items.length > 0 ? (
                                                        <div className="space-y-1.5">
                                                            {row.items.map((item: any) => (
                                                                <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800/40 last:border-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-mono text-slate-500 text-[11px]">{item.code}</span>
                                                                        <span className="font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                                                                        <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-400">
                                                                            {item.stage}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 font-mono">
                                                                        {item.efsStock > 0 && (
                                                                            <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold">
                                                                                EFS: {Number(item.efsStock).toLocaleString()} KG
                                                                            </span>
                                                                        )}
                                                                        {item.nonEfsStock > 0 && (
                                                                            <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-bold">
                                                                                Non-EFS: {Number(item.nonEfsStock).toLocaleString()} KG
                                                                            </span>
                                                                        )}
                                                                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                                                                            {Number(item.availableStock).toLocaleString()} KG
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-slate-400 italic py-1">
                                                            No inventory found for this HS Code in warehouse. Raw material must be purchased or imported to produce this output.
                                                        </div>
                                                    )}
                                                </div>

                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>
                    ) : null}

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-900/70">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <Info size={14} className="text-indigo-500" />
                        <span>Compares standard technical bill of materials against on-hand physical inventory to compute exact material shortfall.</span>
                    </div>
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
