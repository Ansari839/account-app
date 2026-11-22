"use client";

import React, { useState, useEffect, useMemo } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import { 
    PackageSearch, Loader2, ArrowRight, Layers, Factory, 
    CheckCircle2, Clock, AlertCircle, FileText, ExternalLink, 
    ChevronDown, ChevronUp, Search, Filter, Warehouse as WarehouseIcon, 
    Tag, Coins, Check, ArrowUpRight, Scissors, Sparkles, AlertTriangle,
    X, Eye, ArrowRightCircle, LayoutGrid, List,
    History, Edit2, Trash2, Package, Receipt
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useCompany } from "@/context/CompanyContext";

export default function ProductionDashboard() {
    const router = useRouter();
    const { isManufacturing, permissionsLoaded } = useCompany();

    // Top-Level Mode: Tab 1: Stock vs Tab 2: Accruals
    const [mainMode, setMainMode] = useState<"STOCK" | "ACCRUALS">("STOCK");

    // Dashboard Data
    const [categories, setCategories] = useState<any[]>([]);
    const [unsettledBatches, setUnsettledBatches] = useState<any[]>([]);
    const [accrualsSummary, setAccrualsSummary] = useState<any>({});
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Filters for Tab 1 (Physical Stock)
    const [stockSearch, setStockSearch] = useState("");
    const [originFilter, setOriginFilter] = useState<"ALL" | "LOCAL" | "IMPORT_EFS" | "IMPORT_NONEFS">("ALL");

    // Filters for Tab 2 (Unsettled Accruals)
    const [accrualSearch, setAccrualSearch] = useState("");
    const [stageFilter, setStageFilter] = useState<"ALL" | "PENDING" | "YARN" | "WEAVING" | "DYEING" | "SETTLED">("ALL");
    const [viewMode, setViewMode] = useState<"TABLE" | "CARDS">("TABLE");

    // Drill-Down Modal State (Requirement: "TABLE LIST ME SHOW OR CLICK PER DRILL DOWN ME YE DETAIL AY")
    const [selectedBatchForDrillDown, setSelectedBatchForDrillDown] = useState<any | null>(null);

    // Settled Accruals History & CRUD State
    const [settledHistory, setSettledHistory] = useState<any[]>([]);
    const [settledSearch, setSettledSearch] = useState("");
    const [isSettledHistoryOpen, setIsSettledHistoryOpen] = useState(false);
    const [viewingSettlement, setViewingSettlement] = useState<any | null>(null);
    const [editingSettlement, setEditingSettlement] = useState<any | null>(null);
    const [isRevertingSettlement, setIsRevertingSettlement] = useState(false);
    const [warehouses, setWarehouses] = useState<any[]>([]);

    useEffect(() => {
        fetchDashboardData();
        fetchSettledHistory();
        fetchWarehouses();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const res = await authenticatedFetch("/api/finance/production/dashboard");
            const json = await res.json();
            if (json.success) {
                const cats = json.categories || json.data || [];
                setCategories(cats);
                setUnsettledBatches(json.unsettledBatches || []);
                setAccrualsSummary(json.accrualsSummary || {});
                if (cats.length > 0) {
                    setActiveTab(cats[0].id);
                }
            }
        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSettledHistory = async () => {
        try {
            const res = await authenticatedFetch("/api/finance/production/accruals/settlements");
            const json = await res.json();
            if (json.success) {
                setSettledHistory(json.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch settled history", err);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const res = await authenticatedFetch("/api/inventory/warehouses");
            const json = await res.json();
            if (json.success) {
                setWarehouses(json.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch warehouses", err);
        }
    };

    const handleRevertSettlement = async (settlement: any) => {
        const accNo = settlement.accrualNo || "accrual";
        if (!confirm(`Are you sure you want to revert/delete settlement for ${accNo}?\n\nThis will:\n• Restore the deducted physical stock (${settlement.qty} KG) to ${settlement.warehouseName}\n• Delete the General Ledger Journal Entry\n• Revert the accrual status back to PENDING so you can settle it again.`)) {
            return;
        }

        try {
            setIsRevertingSettlement(true);
            const sId = settlement.id || `STOCK-${settlement.settlementId}`;
            const res = await authenticatedFetch(`/api/finance/production/accruals/settlements/${sId}`, {
                method: "DELETE"
            });
            const json = await res.json();
            if (json.success) {
                alert(`Settlement for ${accNo} successfully reverted! Physical stock has been restored.`);
                fetchSettledHistory();
                fetchDashboardData();
            } else {
                alert(json.error || "Failed to revert settlement.");
            }
        } catch (err) {
            console.error("Revert error", err);
            alert("An error occurred while reverting settlement.");
        } finally {
            setIsRevertingSettlement(false);
        }
    };

    const handleSaveEditSettlement = async () => {
        if (!editingSettlement) return;
        try {
            const sId = editingSettlement.id;
            const res = await authenticatedFetch(`/api/finance/production/accruals/settlements/${sId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    qty: Number(editingSettlement.qty),
                    rate: Number(editingSettlement.rate),
                    warehouseId: editingSettlement.warehouseId,
                    remarks: editingSettlement.remarks
                })
            });
            const json = await res.json();
            if (json.success) {
                alert("Settlement record updated successfully!");
                setEditingSettlement(null);
                fetchSettledHistory();
                fetchDashboardData();
            } else {
                alert(json.error || "Failed to update settlement.");
            }
        } catch (err) {
            console.error("Edit settlement error", err);
            alert("Failed to update settlement.");
        }
    };

    // Requirement 1: Only categories with stock > 0 are present in `categories`.
    const activeCategory = categories.find(c => c.id === activeTab) || (categories.length > 0 ? categories[0] : null);

    // Filter products within active category
    const filteredProducts = useMemo(() => {
        if (!activeCategory || !activeCategory.products) return [];
        return activeCategory.products.filter((p: any) => {
            if (Number(p.stockBalance) <= 0.0001) return false;
            if (originFilter === "LOCAL" && p.origin !== "LOCAL") return false;
            if (originFilter === "IMPORT_EFS" && (p.origin !== "IMPORT" || !p.isEFS)) return false;
            if (originFilter === "IMPORT_NONEFS" && (p.origin !== "IMPORT" || p.isEFS)) return false;
            if (!stockSearch) return true;
            const q = stockSearch.toLowerCase();
            return (
                p.name?.toLowerCase().includes(q) ||
                p.code?.toLowerCase().includes(q) ||
                p.hsCode?.toLowerCase().includes(q) ||
                p.composition?.toLowerCase().includes(q)
            );
        });
    }, [activeCategory, originFilter, stockSearch]);

    // Filter unconsumed services within active category
    const filteredServices = useMemo(() => {
        if (!activeCategory || !activeCategory.services) return [];
        return activeCategory.services.filter((s: any) => {
            if (Number(s.unconsumedQty) <= 0.0001) return false;
            if (!stockSearch) return true;
            const q = stockSearch.toLowerCase();
            return (
                s.productName?.toLowerCase().includes(q) ||
                s.invoiceNo?.toLowerCase().includes(q) ||
                s.supplierName?.toLowerCase().includes(q)
            );
        });
    }, [activeCategory, stockSearch]);

    // Requirement 2: Filter production batches & accruals
    const filteredBatches = useMemo(() => {
        return unsettledBatches.filter((batch: any) => {
            if (stageFilter === "PENDING" && batch.overallStatus === "FULLY_SETTLED") return false;
            if (stageFilter === "SETTLED" && batch.overallStatus !== "FULLY_SETTLED") return false;
            if (stageFilter === "YARN" && batch.stages?.yarn?.status !== "PENDING" && batch.stages?.yarn?.status !== "PARTIALLY_SETTLED") return false;
            if (stageFilter === "WEAVING" && batch.stages?.weaving?.status !== "PENDING" && batch.stages?.weaving?.status !== "PARTIALLY_SETTLED") return false;
            if (stageFilter === "DYEING" && batch.stages?.dyeingFinish?.status !== "PENDING" && batch.stages?.dyeingFinish?.status !== "PARTIALLY_SETTLED") return false;

            if (!accrualSearch) return true;
            const q = accrualSearch.toLowerCase();
            const matchesBatch = 
                batch.batchNo?.toLowerCase().includes(q) ||
                batch.outputProductName?.toLowerCase().includes(q) ||
                batch.outputProductCode?.toLowerCase().includes(q) ||
                batch.warehouseName?.toLowerCase().includes(q) ||
                batch.specNotes?.toLowerCase().includes(q);

            if (matchesBatch) return true;

            const allAccs = [
                ...(batch.stages?.yarn?.accruals || []),
                ...(batch.stages?.weaving?.accruals || []),
                ...(batch.stages?.dyeingFinish?.accruals || []),
                ...(batch.stages?.other || [])
            ];
            return allAccs.some((a: any) => 
                a.accrualNo?.toLowerCase().includes(q) ||
                a.productName?.toLowerCase().includes(q) ||
                a.supplierName?.toLowerCase().includes(q) ||
                a.remarks?.toLowerCase().includes(q)
            );
        });
    }, [unsettledBatches, stageFilter, accrualSearch]);

    const filteredSettledHistory = useMemo(() => {
        if (!settledSearch) return settledHistory;
        const q = settledSearch.toLowerCase();
        return settledHistory.filter((s: any) => 
            s.accrualNo?.toLowerCase().includes(q) ||
            s.productName?.toLowerCase().includes(q) ||
            s.productCode?.toLowerCase().includes(q) ||
            s.warehouseName?.toLowerCase().includes(q) ||
            s.lotNo?.toLowerCase().includes(q) ||
            s.journalEntry?.number?.toLowerCase().includes(q)
        );
    }, [settledHistory, settledSearch]);

    if (permissionsLoaded && !isManufacturing) {
        return (
            <MainLayout>
                <div className="max-w-xl mx-auto my-24 p-8 text-center space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl">
                    <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
                        <Factory size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Manufacturing Module Disabled</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        The Production, BOM, and Material Execution modules are only available for Manufacturing companies. This company is currently configured as a Commercial / Trading business.
                    </p>
                    <div className="pt-4">
                        <button
                            onClick={() => router.push('/admin/settings')}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                        >
                            Open Company Settings
                        </button>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-[92rem] mx-auto space-y-8 animate-in fade-in duration-700 pb-32">
                
                {/* Premium Hero Header */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden border border-slate-800 flex flex-col md:flex-row justify-between md:items-center gap-6">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">
                            <Layers size={14} />
                            <span className="text-white">Manufacturing Operations &amp; Inventory</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tight">Production Dashboard</h1>
                        <p className="text-slate-400 font-medium mt-1">
                            Track stage inventory balances and production accrual demands stage-wise.
                        </p>
                    </div>
                    
                    <div className="relative z-10 flex flex-wrap items-center gap-3">
                        <button 
                            type="button"
                            onClick={() => {
                                fetchSettledHistory();
                                setIsSettledHistoryOpen(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-bold transition-all border border-emerald-500 shadow-lg shadow-emerald-600/25 flex items-center gap-2 hover:-translate-y-0.5 cursor-pointer"
                        >
                            <History size={16} />
                            <span>Settled Accruals History ({settledHistory.length})</span>
                        </button>
                        <button 
                            onClick={() => router.push('/finance/purchase/invoices/new')}
                            className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-bold transition-all border border-slate-700 hover:border-slate-600 flex items-center gap-2 shadow-sm"
                        >
                            <FileText size={16} className="text-indigo-400" />
                            <span>Bulk Settle Accruals</span>
                        </button>
                        <button 
                            onClick={() => router.push('/finance/production/bom')}
                            className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-bold transition-all border border-slate-700 hover:border-slate-600"
                        >
                            Manage BOMs
                        </button>
                        <button 
                            onClick={() => router.push('/finance/production/execution/new')}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5"
                        >
                            Process Material <ArrowRight size={18} />
                        </button>
                    </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* TAB SWITCHER: Requirement: "kam 1 or 2 tab wise kr dena shi" */}
                {/* ------------------------------------------------------------- */}
                <div className="flex flex-col sm:flex-row gap-4 p-2 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <button
                        onClick={() => setMainMode("STOCK")}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-black text-sm transition-all duration-300",
                            mainMode === "STOCK"
                                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md border border-slate-200 dark:border-slate-700"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                    >
                        <WarehouseIcon size={18} />
                        <span>1. Physical Stage Stock (Inventory)</span>
                        <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-xs font-black",
                            mainMode === "STOCK"
                                ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                                : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                        )}>
                            {categories.length} Categories In Stock
                        </span>
                    </button>

                    <button
                        onClick={() => setMainMode("ACCRUALS")}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-black text-sm transition-all duration-300",
                            mainMode === "ACCRUALS"
                                ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-md border border-slate-200 dark:border-slate-700"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                    >
                        <Clock size={18} />
                        <span>2. Unsettled Accruals (Production &amp; Stages)</span>
                        <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-xs font-black",
                            mainMode === "ACCRUALS"
                                ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                        )}>
                            {accrualsSummary.unsettledBatchesCount || 0} Demands Pending
                        </span>
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800">
                        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                        <p className="text-slate-500 font-bold animate-pulse">Loading Production &amp; Inventory Data...</p>
                    </div>
                ) : mainMode === "STOCK" ? (
                    /* ========================================================================= */
                    /* TAB 1: PHYSICAL STAGE STOCK (STRICTLY NON-ZERO CATEGORIES)                */
                    /* ========================================================================= */
                    categories.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800">
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <PackageSearch className="w-10 h-10 text-slate-400" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white">No Physical Stock Available</h2>
                            <p className="text-slate-500 mt-2 text-center max-w-md">There are currently no products with active stock balance in any category. Non-zero stock categories will automatically appear here once stock is received.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Dynamic Category Tabs: Only Non-Zero Categories Rendered! */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 shadow-sm overflow-x-auto scrollbar-hide">
                                <div className="flex gap-2 min-w-max">
                                    {categories.map(category => {
                                        const count = (category.products?.filter((p: any) => Number(p.stockBalance) > 0.0001)?.length || 0) + 
                                                      (category.services?.filter((s: any) => Number(s.unconsumedQty) > 0.0001)?.length || 0);
                                        return (
                                            <button
                                                key={category.id}
                                                onClick={() => setActiveTab(category.id)}
                                                className={cn(
                                                    "flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300",
                                                    activeTab === category.id
                                                        ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-200 dark:border-indigo-800"
                                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                )}
                                            >
                                                <span>{category.name}</span>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-xs font-black",
                                                    activeTab === category.id 
                                                        ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" 
                                                        : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                                )}>
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Active Category Content */}
                            {activeCategory && (
                                <div className="space-y-6">
                                    {/* Physical Stock Table */}
                                    {!activeCategory.isService && (
                                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between md:items-center gap-4">
                                                <div>
                                                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                                        <Layers className="w-5 h-5 text-indigo-500" />
                                                        {activeCategory.name} - Physical Inventory
                                                    </h3>
                                                    <p className="text-sm font-medium text-slate-500 mt-1">
                                                        Active physical warehouse stock available for consumption and production.
                                                    </p>
                                                </div>

                                                {/* Filters */}
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <div className="relative">
                                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                        <input 
                                                            type="text"
                                                            placeholder="Search item, code, composition..."
                                                            value={stockSearch}
                                                            onChange={(e) => setStockSearch(e.target.value)}
                                                            className="pl-9 pr-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        />
                                                    </div>

                                                    <select
                                                        value={originFilter}
                                                        onChange={(e: any) => setOriginFilter(e.target.value)}
                                                        className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                    >
                                                        <option value="ALL">All Origins</option>
                                                        <option value="LOCAL">Local Only</option>
                                                        <option value="IMPORT_EFS">Import (EFS)</option>
                                                        <option value="IMPORT_NONEFS">Import (Non-EFS)</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-300">
                                                        <tr>
                                                            <th scope="col" className="px-6 py-4">Item Code</th>
                                                            <th scope="col" className="px-6 py-4">Product Name</th>
                                                            <th scope="col" className="px-6 py-4">HS Code</th>
                                                            <th scope="col" className="px-6 py-4">Origin &amp; Scheme</th>
                                                            <th scope="col" className="px-6 py-4">Composition</th>
                                                            <th scope="col" className="px-6 py-4 text-right">Available Stock</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                                        {filteredProducts.length > 0 ? filteredProducts.map((product: any) => (
                                                            <tr key={product.id} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                                <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-400">
                                                                    {product.code || '-'}
                                                                </td>
                                                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                                                    {product.name}
                                                                </td>
                                                                <td className="px-6 py-4 font-mono text-xs font-bold text-slate-400">
                                                                    {product.hsCode || '-'}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        {product.origin === 'IMPORT' ? (
                                                                            <>
                                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                                                                    IMPORT
                                                                                </span>
                                                                                {product.isEFS ? (
                                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                                        EFS
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                                                        NON-EFS
                                                                                    </span>
                                                                                )}
                                                                            </>
                                                                        ) : (
                                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                                LOCAL
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-sm font-medium text-amber-600 dark:text-amber-400">
                                                                    {product.composition || '-'}
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <div className="flex items-center justify-end gap-1.5">
                                                                        <span className="inline-flex items-center justify-center px-3 py-1 text-sm font-black text-indigo-700 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-500/10 rounded-lg">
                                                                            {product.stockBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                                        </span>
                                                                        <span className="text-xs font-bold text-slate-400 uppercase">
                                                                            {product.unit}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )) : (
                                                            <tr>
                                                                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                                                    No matching stock items found in this category.
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Unconsumed Services Table */}
                                    {activeCategory.isService && (
                                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                                    <Layers className="w-5 h-5 text-emerald-500" />
                                                    {activeCategory.name} - Unconsumed Services
                                                </h3>
                                                <p className="text-sm font-medium text-slate-500 mt-1">Service invoices pending consumption into production.</p>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-300">
                                                        <tr>
                                                            <th scope="col" className="px-4 py-4">Date</th>
                                                            <th scope="col" className="px-4 py-4">Inv #</th>
                                                            <th scope="col" className="px-4 py-4">Vendor Name</th>
                                                            <th scope="col" className="px-4 py-4">Service</th>
                                                            <th scope="col" className="px-4 py-4 text-right">Qty (UOM)</th>
                                                            <th scope="col" className="px-4 py-4 text-right">Ex-Amount</th>
                                                            <th scope="col" className="px-4 py-4 text-right">GST</th>
                                                            <th scope="col" className="px-4 py-4 text-right">Incl Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                                        {filteredServices.length > 0 ? filteredServices.map((svc: any) => (
                                                            <tr key={svc.id} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                                <td className="px-4 py-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                                                                    {new Date(svc.date).toLocaleDateString()}
                                                                </td>
                                                                <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">
                                                                    {svc.invoiceNo}
                                                                </td>
                                                                <td className="px-4 py-4 text-slate-700 dark:text-slate-300">
                                                                    {svc.supplierName}
                                                                </td>
                                                                <td className="px-4 py-4 font-medium text-emerald-600 dark:text-emerald-400">
                                                                    {svc.productName}
                                                                </td>
                                                                <td className="px-4 py-4 text-right">
                                                                    <div className="flex items-center justify-end gap-1.5">
                                                                        <span className="inline-flex items-center justify-center px-2 py-1 text-sm font-black text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 rounded-md">
                                                                            {svc.unconsumedQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                                        </span>
                                                                        <span className="text-xs font-bold text-slate-400 uppercase">
                                                                            {svc.unit}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-4 text-right text-slate-600 dark:text-slate-400">
                                                                    {svc.exAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="px-4 py-4 text-right text-slate-500 dark:text-slate-500">
                                                                    {svc.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="px-4 py-4 text-right font-bold text-slate-900 dark:text-white">
                                                                    {svc.inclAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                            </tr>
                                                        )) : (
                                                            <tr>
                                                                <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                                                                    No unconsumed services available in this category.
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                ) : (
                    /* ========================================================================= */
                    /* TAB 2: UNSETTLED ACCRUALS (CLEAN TABLE LIST + CLICK TO DRILL DOWN)       */
                    /* ========================================================================= */
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* Summary Metrics Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unsettled Batches</span>
                                    <span className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                                        <Clock size={18} />
                                    </span>
                                </div>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                                        {accrualsSummary.unsettledBatchesCount || 0}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">
                                        of {accrualsSummary.totalBatches || 0} Total Batches
                                    </span>
                                </div>
                                <div className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                    {accrualsSummary.fullySettledBatchesCount || 0} Batches fully cleared
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Remaining Liability</span>
                                    <span className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
                                        <Coins size={18} />
                                    </span>
                                </div>
                                <div className="mt-3">
                                    <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                                        Rs. {(accrualsSummary.totalRemainingLiability || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="mt-1 text-xs font-medium text-slate-500">
                                    Pending settlement against stock or purchase invoices
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stage 1: Raw Yarn Demands</span>
                                    <span className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                                        <Layers size={18} />
                                    </span>
                                </div>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                                        {accrualsSummary.yarnPendingCount || 0}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">Batches Pending</span>
                                </div>
                                <div className="mt-1 text-xs font-medium text-slate-500">
                                    Raw yarn unbilled demands awaiting stock deduction or bill
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stage 3: Dyeing &amp; Finish</span>
                                    <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                                        <Scissors size={18} />
                                    </span>
                                </div>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                        {accrualsSummary.dyeingPendingCount || 0}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">Batches Pending</span>
                                </div>
                                <div className="mt-1 text-xs font-medium text-slate-500">
                                    Wet processing services awaiting invoice clearance
                                </div>
                            </div>
                        </div>

                        {/* Search and Filters Toolbar */}
                        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="relative flex-1 max-w-md">
                                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text"
                                    placeholder="Search Batch #, Output Product, PAC No, Material, Vendor..."
                                    value={accrualSearch}
                                    onChange={(e) => setAccrualSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => setStageFilter("ALL")}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        stageFilter === "ALL"
                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                                    )}
                                >
                                    All Batches ({unsettledBatches.length})
                                </button>
                                <button
                                    onClick={() => setStageFilter("PENDING")}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        stageFilter === "PENDING"
                                            ? "bg-amber-600 text-white shadow-sm"
                                            : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-100"
                                    )}
                                >
                                    ⏳ Pending Settle ({accrualsSummary.unsettledBatchesCount || 0})
                                </button>
                                <button
                                    onClick={() => setStageFilter("YARN")}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        stageFilter === "YARN"
                                            ? "bg-indigo-600 text-white shadow-sm"
                                            : "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100"
                                    )}
                                >
                                    🧶 Yarn Pending ({accrualsSummary.yarnPendingCount || 0})
                                </button>
                                <button
                                    onClick={() => setStageFilter("DYEING")}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        stageFilter === "DYEING"
                                            ? "bg-emerald-600 text-white shadow-sm"
                                            : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100"
                                    )}
                                >
                                    🎨 Dyeing Pending ({accrualsSummary.dyeingPendingCount || 0})
                                </button>
                                <button
                                    onClick={() => setStageFilter("SETTLED")}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        stageFilter === "SETTLED"
                                            ? "bg-teal-600 text-white shadow-sm"
                                            : "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 hover:bg-teal-100"
                                    )}
                                >
                                    ✅ Fully Cleared ({accrualsSummary.fullySettledBatchesCount || 0})
                                </button>
                            </div>
                        </div>

                        {/* ========================================================================= */}
                        {/* SPACIOUS ERP BATCH ACCRUAL LIST & CARD VIEW TOGGLE                        */}
                        {/* ========================================================================= */}
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="p-5 md:px-6 md:py-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/30">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <Layers className="w-5 h-5 text-indigo-500" />
                                        <span>Production Execution Batches &amp; Accrual Demands</span>
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Click on any batch row or card to drill down into stage lot allocations and accrual ledger vouchers.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            fetchSettledHistory();
                                            setIsSettledHistoryOpen(true);
                                        }}
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-600 hover:text-white transition-all shadow-xs cursor-pointer"
                                    >
                                        <History size={14} />
                                        <span>Settled History &amp; CRUD ({settledHistory.length})</span>
                                    </button>
                                    <span className="text-xs font-bold text-slate-400">
                                        Showing {filteredBatches.length} of {unsettledBatches.length} Batch(es)
                                    </span>
                                    <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                                        <button
                                            type="button"
                                            onClick={() => setViewMode("TABLE")}
                                            className={cn(
                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                                viewMode === "TABLE"
                                                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                            )}
                                        >
                                            <List size={14} />
                                            <span>Table View</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setViewMode("CARDS")}
                                            className={cn(
                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                                viewMode === "CARDS"
                                                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                            )}
                                        >
                                            <LayoutGrid size={14} />
                                            <span>Card View</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {filteredBatches.length === 0 ? (
                                <div className="px-6 py-16 text-center text-slate-500">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                                    <span className="font-bold text-sm block text-slate-700 dark:text-slate-300">No Batches Matching Filter</span>
                                    <span className="text-xs text-slate-400">All matching production demands are settled or no records found.</span>
                                </div>
                            ) : viewMode === "TABLE" ? (
                                /* Airy, Spacious ERP Table View (No Congestion) */
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs min-w-[1300px]">
                                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-800 text-[11px]">
                                            <tr>
                                                <th className="px-6 py-4 w-[16%]">Batch / Lot #</th>
                                                <th className="px-6 py-4 w-[17%]">Output Product</th>
                                                <th className="px-6 py-4 w-[19%]">🧶 Stage 1: Yarn</th>
                                                <th className="px-6 py-4 w-[12%]">🧵 Stage 2: Weaving</th>
                                                <th className="px-6 py-4 w-[19%]">🎨 Stage 3: Dyeing / Finish</th>
                                                <th className="px-6 py-4 w-[15%] text-right">Remaining Liability</th>
                                                <th className="px-6 py-4 w-[10%] text-center">Batch Status</th>
                                                <th className="px-6 py-4 w-[8%] text-right">Drill Down</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                            {filteredBatches.map((batch: any) => {
                                                const yarnStage = batch.stages?.yarn;
                                                const weavingStage = batch.stages?.weaving;
                                                const dyeingStage = batch.stages?.dyeingFinish;

                                                const isFullySettled = batch.overallStatus === "FULLY_SETTLED";
                                                const isPartiallySettled = batch.overallStatus === "PARTIALLY_SETTLED";

                                                const firstYarnAcc = yarnStage?.accruals?.[0];
                                                const firstDyeingAcc = dyeingStage?.accruals?.[0];

                                                return (
                                                    <tr 
                                                        key={batch.batchId}
                                                        onClick={() => setSelectedBatchForDrillDown(batch)}
                                                        className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                                                    >
                                                        {/* Batch # */}
                                                        <td className="px-6 py-4.5 whitespace-nowrap">
                                                            <div className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-500 transition-colors">
                                                                {batch.batchNo}
                                                            </div>
                                                            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1 font-medium">
                                                                <span>{new Date(batch.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                                <span>•</span>
                                                                <span>{batch.warehouseName}</span>
                                                            </div>
                                                        </td>

                                                        {/* Output Product */}
                                                        <td className="px-6 py-4.5">
                                                            <div className="font-black text-slate-900 dark:text-white text-sm">
                                                                {batch.outputProductName}
                                                            </div>
                                                            <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                                                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                                                    {batch.outputQuantity.toLocaleString()} {batch.outputUnit}
                                                                </span>
                                                                <span className="text-slate-400 font-normal">Produced</span>
                                                                {batch.outputNetWeightKg && batch.outputUnit !== "KG" && (
                                                                    <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                                                        • {batch.outputNetWeightKg.toLocaleString()} KG Net
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Stage 1: Yarn */}
                                                        <td className="px-6 py-4.5">
                                                            {yarnStage?.status === "SETTLED" ? (
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                                                            <CheckCircle2 size={11} />
                                                                            Settled
                                                                        </span>
                                                                        <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                                                            {yarnStage.totalSettled.toLocaleString()} KG
                                                                        </span>
                                                                    </div>
                                                                    <div className="font-semibold text-slate-700 dark:text-slate-300 text-xs truncate max-w-[220px]" title={firstYarnAcc?.productName}>
                                                                        {firstYarnAcc?.productName || "Physical Yarn"}
                                                                    </div>
                                                                </div>
                                                            ) : yarnStage?.status === "STOCK_ALLOCATED" ? (
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                                                                            <Check size={11} />
                                                                            Stock Lot
                                                                        </span>
                                                                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                                                                            {yarnStage.totalSettled.toLocaleString()} KG
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-xs text-slate-400 font-medium">Warehouse Direct</div>
                                                                </div>
                                                            ) : yarnStage?.status === "PARTIALLY_SETTLED" ? (
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                                                                            <AlertTriangle size={11} />
                                                                            Partial
                                                                        </span>
                                                                        <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                                                                            Rem: {yarnStage.remainingQty.toLocaleString()} KG
                                                                        </span>
                                                                    </div>
                                                                    <div className="font-semibold text-slate-600 dark:text-slate-400 text-xs truncate max-w-[220px]">
                                                                        {firstYarnAcc?.productName || "Physical Yarn"}
                                                                    </div>
                                                                </div>
                                                            ) : yarnStage?.status === "PENDING" ? (
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                                                                            <Clock size={11} />
                                                                            Pending Settle
                                                                        </span>
                                                                        <span className="text-xs font-mono font-bold text-rose-700 dark:text-rose-400">
                                                                            {yarnStage.totalDemanded.toLocaleString()} KG
                                                                        </span>
                                                                    </div>
                                                                    <div className="font-semibold text-slate-600 dark:text-slate-400 text-xs truncate max-w-[220px]">
                                                                        {firstYarnAcc?.productName || "Physical Yarn"}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-slate-400 font-medium">-</span>
                                                            )}
                                                        </td>

                                                        {/* Stage 2: Weaving */}
                                                        <td className="px-6 py-4.5 whitespace-nowrap">
                                                            {weavingStage?.status === "SETTLED" ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                                                        <CheckCircle2 size={11} />
                                                                        Settled
                                                                    </span>
                                                                    <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{weavingStage.totalSettled.toLocaleString()} Units</span>
                                                                </div>
                                                            ) : weavingStage?.status === "IN_HOUSE" ? (
                                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                    🏢 In-House
                                                                </span>
                                                            ) : weavingStage?.status === "PENDING" ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                                                                        <Clock size={11} />
                                                                        Pending
                                                                    </span>
                                                                    <span className="text-xs font-mono font-bold text-rose-700 dark:text-rose-400">{weavingStage.totalDemanded.toLocaleString()} Units</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-slate-400 font-medium">-</span>
                                                            )}
                                                        </td>

                                                        {/* Stage 3: Dyeing / Finish */}
                                                        <td className="px-6 py-4.5">
                                                            {dyeingStage?.status === "SETTLED" ? (
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                                                            <CheckCircle2 size={11} />
                                                                            Settled
                                                                        </span>
                                                                        <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                                                            {dyeingStage.totalSettled.toLocaleString()} KG
                                                                        </span>
                                                                    </div>
                                                                    <div className="font-semibold text-slate-600 dark:text-slate-400 text-xs truncate max-w-[220px]">
                                                                        {firstDyeingAcc?.productName || "Wet Processing"}
                                                                    </div>
                                                                </div>
                                                            ) : dyeingStage?.status === "IN_HOUSE" ? (
                                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                    🏢 In-House
                                                                </span>
                                                            ) : dyeingStage?.status === "PENDING" ? (
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                                                                            <Clock size={11} />
                                                                            Pending Settle
                                                                        </span>
                                                                        <span className="text-xs font-mono font-bold text-rose-700 dark:text-rose-400">
                                                                            {dyeingStage.totalDemanded.toLocaleString()} KG
                                                                        </span>
                                                                    </div>
                                                                    <div className="font-semibold text-slate-600 dark:text-slate-400 text-xs truncate max-w-[220px]" title={firstDyeingAcc?.supplierName}>
                                                                        {firstDyeingAcc?.supplierName || "Processing Vendor"}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-slate-400 font-medium">-</span>
                                                            )}
                                                        </td>

                                                        {/* Remaining Liability */}
                                                        <td className="px-6 py-4.5 text-right whitespace-nowrap">
                                                            <div className={cn(
                                                                "text-sm font-mono font-black",
                                                                batch.remainingLiability > 0 
                                                                    ? "text-rose-600 dark:text-rose-400" 
                                                                    : "text-emerald-600 dark:text-emerald-400"
                                                            )}>
                                                                Rs. {batch.remainingLiability.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                            <div className="text-xs text-slate-400 font-medium mt-1">
                                                                Booked: Rs. {batch.totalAccrualValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                        </td>

                                                        {/* Batch Status */}
                                                        <td className="px-6 py-4.5 text-center whitespace-nowrap">
                                                            {isFullySettled ? (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                    <CheckCircle2 size={12} />
                                                                    All Cleared
                                                                </span>
                                                            ) : isPartiallySettled ? (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                    <AlertTriangle size={12} />
                                                                    Partial Settle
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                                                    <Clock size={12} />
                                                                    Demands Open
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Action Drill Down Button */}
                                                        <td className="px-6 py-4.5 text-right whitespace-nowrap">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedBatchForDrillDown(batch);
                                                                }}
                                                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-indigo-600 hover:text-white transition-all shadow-xs group-hover:bg-indigo-600 group-hover:text-white"
                                                            >
                                                                <Eye size={13} />
                                                                <span>Drill Down</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                /* Spacious Horizontal Card View */
                                <div className="p-5 md:p-6 space-y-4">
                                    {filteredBatches.map((batch: any) => {
                                        const yarnStage = batch.stages?.yarn;
                                        const weavingStage = batch.stages?.weaving;
                                        const dyeingStage = batch.stages?.dyeingFinish;
                                        const firstYarnAcc = yarnStage?.accruals?.[0];
                                        const firstDyeingAcc = dyeingStage?.accruals?.[0];
                                        const isFullySettled = batch.overallStatus === "FULLY_SETTLED";
                                        const isPartiallySettled = batch.overallStatus === "PARTIALLY_SETTLED";

                                        return (
                                            <div
                                                key={batch.batchId}
                                                onClick={() => setSelectedBatchForDrillDown(batch)}
                                                className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer shadow-xs space-y-4"
                                            >
                                                {/* Card Header Bar */}
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <span className="font-mono text-sm font-black px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                            {batch.batchNo}
                                                        </span>
                                                        <span className="text-xs text-slate-400 font-medium">
                                                            {new Date(batch.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} • {batch.warehouseName}
                                                        </span>
                                                        {isFullySettled ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                                                <CheckCircle2 size={12} /> All Cleared
                                                            </span>
                                                        ) : isPartiallySettled ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                                                                <AlertTriangle size={12} /> Partially Settled
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                                                                <Clock size={12} /> Demands Open
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining Liability</span>
                                                            <span className={cn(
                                                                "text-sm font-mono font-black",
                                                                batch.remainingLiability > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                                                            )}>
                                                                Rs. {batch.remainingLiability.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedBatchForDrillDown(batch);
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white transition-all"
                                                        >
                                                            <Eye size={13} />
                                                            <span>Drill Down</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Output & Stages 4-Column Grid */}
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                                                    {/* Output Product */}
                                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Output Product</span>
                                                        <div className="font-black text-slate-900 dark:text-white text-sm mt-0.5">{batch.outputProductName}</div>
                                                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1 font-mono">
                                                            {batch.outputQuantity.toLocaleString()} {batch.outputUnit} Produced
                                                            {batch.outputNetWeightKg && batch.outputUnit !== "KG" && (
                                                                <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                                                                    ({batch.outputNetWeightKg.toLocaleString()} KG Net)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Stage 1: Yarn */}
                                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[10px] uppercase font-bold text-slate-400">🧶 Stage 1: Yarn</span>
                                                            {yarnStage?.status === "SETTLED" ? (
                                                                <span className="text-[10px] font-black text-emerald-600">✓ Settled</span>
                                                            ) : yarnStage?.status === "STOCK_ALLOCATED" ? (
                                                                <span className="text-[10px] font-black text-slate-600">✓ Stock Lot</span>
                                                            ) : (
                                                                <span className="text-[10px] font-black text-rose-600">⏳ Pending</span>
                                                            )}
                                                        </div>
                                                        <div className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate" title={firstYarnAcc?.productName}>
                                                            {firstYarnAcc?.productName || "Physical Yarn"}
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-mono mt-1">
                                                            {yarnStage?.totalDemanded?.toLocaleString()} KG
                                                        </div>
                                                    </div>

                                                    {/* Stage 2: Weaving */}
                                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[10px] uppercase font-bold text-slate-400">🧵 Stage 2: Weaving</span>
                                                            <span className="text-[10px] font-bold text-slate-500">In-House</span>
                                                        </div>
                                                        <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                            In-House / Direct
                                                        </div>
                                                        <div className="text-xs text-slate-400 mt-1">No vendor accrual</div>
                                                    </div>

                                                    {/* Stage 3: Dyeing / Finish */}
                                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[10px] uppercase font-bold text-slate-400">🎨 Stage 3: Dyeing</span>
                                                            {dyeingStage?.status === "SETTLED" ? (
                                                                <span className="text-[10px] font-black text-emerald-600">✓ Settled</span>
                                                            ) : (
                                                                <span className="text-[10px] font-black text-rose-600">⏳ Pending</span>
                                                            )}
                                                        </div>
                                                        <div className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate" title={firstDyeingAcc?.supplierName}>
                                                            {firstDyeingAcc?.supplierName || "Processing Vendor"}
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-mono mt-1">
                                                            {dyeingStage?.totalDemanded?.toLocaleString()} KG
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* DRILL-DOWN MODAL: Full-Width Expansive Dialog (No Screen Waste)           */}
            {/* ========================================================================= */}
            {selectedBatchForDrillDown && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div 
                        className="bg-white dark:bg-slate-900 w-full max-w-[97vw] 2xl:max-w-[95rem] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[96vh] h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 md:px-8 md:py-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-slate-50/80 dark:bg-slate-800/40">
                            <div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className="font-mono text-sm font-black px-3.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-xs">
                                        {selectedBatchForDrillDown.batchNo}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                        <Clock size={14} className="text-slate-400" />
                                        {new Date(selectedBatchForDrillDown.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </span>
                                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                        Warehouse: {selectedBatchForDrillDown.warehouseName}
                                    </span>
                                    {selectedBatchForDrillDown.overallStatus === "FULLY_SETTLED" ? (
                                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                            <CheckCircle2 size={14} />
                                            All Stages Settled
                                        </span>
                                    ) : selectedBatchForDrillDown.overallStatus === "PARTIALLY_SETTLED" ? (
                                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                                            <AlertTriangle size={14} />
                                            Partially Settled (Some Stages Remaining)
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                                            <Clock size={14} />
                                            Demands Open
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 pt-2.5 flex-wrap">
                                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
                                        {selectedBatchForDrillDown.outputProductName}
                                    </h2>
                                    <span className="text-base font-bold text-slate-500">
                                        • {selectedBatchForDrillDown.outputQuantity.toLocaleString()} {selectedBatchForDrillDown.outputUnit} Produced
                                        {selectedBatchForDrillDown.outputNetWeightKg && selectedBatchForDrillDown.outputUnit !== "KG" && ` (${selectedBatchForDrillDown.outputNetWeightKg.toLocaleString()} KG Net)`}
                                    </span>
                                </div>
                                {selectedBatchForDrillDown.specNotes && (
                                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md inline-block">
                                        {selectedBatchForDrillDown.specNotes}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => setSelectedBatchForDrillDown(null)}
                                className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Close (Esc)"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body: Generously Spacious Scrollable Area */}
                        <div className="p-6 md:p-8 overflow-y-auto space-y-8 flex-1">
                            {/* Summary Metrics Bar: Wide 4 Columns */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                                <div className="space-y-1">
                                    <span className="text-slate-400 uppercase font-black tracking-wider text-[10px]">Total Demanded Qty</span>
                                    <div className="text-xl font-black text-slate-800 dark:text-slate-100">
                                        {selectedBatchForDrillDown.totalDemanded.toLocaleString()} Units
                                    </div>
                                    <div className="text-xs text-slate-400 font-medium">Across all production stages</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-slate-400 uppercase font-black tracking-wider text-[10px]">Total Settled Qty</span>
                                    <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                                        {selectedBatchForDrillDown.totalSettledQty.toLocaleString()} Units
                                    </div>
                                    <div className="text-xs text-emerald-600/80 font-medium">
                                        {selectedBatchForDrillDown.totalDemanded > 0 ? ((selectedBatchForDrillDown.totalSettledQty / selectedBatchForDrillDown.totalDemanded) * 100).toFixed(1) : 0}% cleared
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-slate-400 uppercase font-black tracking-wider text-[10px]">Total Booked Cost</span>
                                    <div className="text-xl font-black text-slate-800 dark:text-slate-100">
                                        Rs. {selectedBatchForDrillDown.totalAccrualValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-xs text-slate-400 font-medium">Initial booked liabilities</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-slate-400 uppercase font-black tracking-wider text-[10px]">Remaining Unsettled Liability</span>
                                    <div className="text-xl font-black text-rose-600 dark:text-rose-400">
                                        Rs. {selectedBatchForDrillDown.remainingLiability.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-xs text-rose-600/80 font-medium">Awaiting stock/invoice offset</div>
                                </div>
                            </div>

                            {/* Stage-wise Detailed Cards: Wide 3 Columns */}
                            <div className="space-y-3">
                                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <Layers size={18} className="text-indigo-500" />
                                    <span>Stage Allocation &amp; Settlement Breakdown</span>
                                </h3>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Stage 1: Yarn */}
                                    <div className={cn(
                                        "p-6 rounded-2xl border transition-all flex flex-col justify-between shadow-xs",
                                        selectedBatchForDrillDown.stages?.yarn?.status === "SETTLED"
                                            ? "bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-800/40"
                                            : selectedBatchForDrillDown.stages?.yarn?.status === "STOCK_ALLOCATED"
                                            ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                                            : selectedBatchForDrillDown.stages?.yarn?.status === "PARTIALLY_SETTLED"
                                            ? "bg-amber-50/50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-800/40"
                                            : selectedBatchForDrillDown.stages?.yarn?.status === "PENDING"
                                            ? "bg-rose-50/50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-800/40"
                                            : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60"
                                    )}>
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                    <span className="text-base">🧶</span>
                                                    <span>Stage 1: Raw Yarn</span>
                                                </span>

                                                {selectedBatchForDrillDown.stages?.yarn?.status === "SETTLED" ? (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                                        <CheckCircle2 size={13} />
                                                        Settled (100%)
                                                    </span>
                                                ) : selectedBatchForDrillDown.stages?.yarn?.status === "STOCK_ALLOCATED" ? (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                                                        From Stock Lot
                                                    </span>
                                                ) : selectedBatchForDrillDown.stages?.yarn?.status === "PENDING" ? (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                                                        Pending Settle
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-400">None</span>
                                                )}
                                            </div>

                                            {selectedBatchForDrillDown.stages?.yarn?.accruals && selectedBatchForDrillDown.stages.yarn.accruals.length > 0 ? (
                                                <div className="space-y-3">
                                                    {selectedBatchForDrillDown.stages.yarn.accruals.map((acc: any) => (
                                                        <div key={acc.id} className="text-xs p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 shadow-xs space-y-2">
                                                            <div className="font-black text-sm text-slate-900 dark:text-white">
                                                                {acc.productName}
                                                            </div>
                                                            <div className="text-slate-500 flex justify-between font-medium">
                                                                <span>Demanded: <strong>{acc.qty.toLocaleString()} {acc.unit}</strong></span>
                                                                <span className="font-mono text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded">{acc.accrualNo}</span>
                                                            </div>
                                                            <div className="flex justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-700/60">
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                                    Settled: {acc.billedQty.toLocaleString()} {acc.unit}
                                                                </span>
                                                                <span className="text-rose-600 dark:text-rose-400 font-bold">
                                                                    Rem: {acc.remainingQty.toLocaleString()} {acc.unit}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                                Rate: Rs. {acc.rate.toFixed(2)} | Rem. Amount: Rs. {acc.remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                            {acc.remarks && (
                                                                <div className="text-[11px] text-slate-400 italic break-words pt-1 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg">
                                                                    {acc.remarks}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : selectedBatchForDrillDown.stages?.yarn?.status === "STOCK_ALLOCATED" ? (
                                                <div className="text-xs text-slate-500 p-3 bg-white dark:bg-slate-800 rounded-xl">
                                                    Raw yarn was allocated directly from warehouse physical inventory at execution time.
                                                </div>
                                            ) : (
                                                <div className="text-xs text-slate-400 p-3 bg-white dark:bg-slate-800 rounded-xl">
                                                    No unbilled raw yarn demand booked for this batch.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stage 2: Weaving */}
                                    <div className={cn(
                                        "p-6 rounded-2xl border transition-all flex flex-col justify-between shadow-xs",
                                        selectedBatchForDrillDown.stages?.weaving?.status === "SETTLED"
                                            ? "bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-800/40"
                                            : selectedBatchForDrillDown.stages?.weaving?.status === "IN_HOUSE"
                                            ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                                            : selectedBatchForDrillDown.stages?.weaving?.status === "PENDING"
                                            ? "bg-rose-50/50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-800/40"
                                            : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60"
                                    )}>
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                    <span className="text-base">🧵</span>
                                                    <span>Stage 2: Weaving / Knit</span>
                                                </span>

                                                {selectedBatchForDrillDown.stages?.weaving?.status === "SETTLED" ? (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                                        <CheckCircle2 size={13} />
                                                        Settled (100%)
                                                    </span>
                                                ) : selectedBatchForDrillDown.stages?.weaving?.status === "IN_HOUSE" ? (
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                                                        In-House
                                                    </span>
                                                ) : selectedBatchForDrillDown.stages?.weaving?.status === "PENDING" ? (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                                                        Pending Settle
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-400">None</span>
                                                )}
                                            </div>

                                            {selectedBatchForDrillDown.stages?.weaving?.accruals && selectedBatchForDrillDown.stages.weaving.accruals.length > 0 ? (
                                                <div className="space-y-3">
                                                    {selectedBatchForDrillDown.stages.weaving.accruals.map((acc: any) => (
                                                        <div key={acc.id} className="text-xs p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 shadow-xs space-y-2">
                                                            <div className="font-black text-sm text-slate-900 dark:text-white">
                                                                {acc.productName}
                                                            </div>
                                                            <div className="text-slate-500 flex justify-between font-medium">
                                                                <span>Demanded: <strong>{acc.qty.toLocaleString()} {acc.unit}</strong></span>
                                                                <span className="font-mono text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded">{acc.accrualNo}</span>
                                                            </div>
                                                            <div className="text-xs text-slate-400 truncate">
                                                                Vendor: <strong>{acc.supplierName}</strong>
                                                            </div>
                                                            <div className="flex justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-700/60">
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                                    Settled: {acc.billedQty.toLocaleString()} {acc.unit}
                                                                </span>
                                                                <span className="text-rose-600 dark:text-rose-400 font-bold">
                                                                    Rem: {acc.remainingQty.toLocaleString()} {acc.unit}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-slate-400 p-4 bg-white dark:bg-slate-800 rounded-xl">
                                                    In-house weaving or no third-party outsourced knitting accrual booked.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stage 3: Dyeing / Finishing */}
                                    <div className={cn(
                                        "p-6 rounded-2xl border transition-all flex flex-col justify-between shadow-xs",
                                        selectedBatchForDrillDown.stages?.dyeingFinish?.status === "SETTLED"
                                            ? "bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-800/40"
                                            : selectedBatchForDrillDown.stages?.dyeingFinish?.status === "IN_HOUSE"
                                            ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                                            : selectedBatchForDrillDown.stages?.dyeingFinish?.status === "PENDING"
                                            ? "bg-rose-50/50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-800/40"
                                            : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60"
                                    )}>
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                    <span className="text-base">🎨</span>
                                                    <span>Stage 3: Dyeing / Finish</span>
                                                </span>

                                                {selectedBatchForDrillDown.stages?.dyeingFinish?.status === "SETTLED" ? (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                                        <CheckCircle2 size={13} />
                                                        Settled (100%)
                                                    </span>
                                                ) : selectedBatchForDrillDown.stages?.dyeingFinish?.status === "IN_HOUSE" ? (
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                                                        In-House
                                                    </span>
                                                ) : selectedBatchForDrillDown.stages?.dyeingFinish?.status === "PENDING" ? (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                                                        Pending Settle
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-400">None</span>
                                                )}
                                            </div>

                                            {selectedBatchForDrillDown.stages?.dyeingFinish?.accruals && selectedBatchForDrillDown.stages.dyeingFinish.accruals.length > 0 ? (
                                                <div className="space-y-3">
                                                    {selectedBatchForDrillDown.stages.dyeingFinish.accruals.map((acc: any) => (
                                                        <div key={acc.id} className="text-xs p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 shadow-xs space-y-2">
                                                            <div className="font-black text-sm text-slate-900 dark:text-white">
                                                                {acc.productName}
                                                            </div>
                                                            <div className="text-slate-500 flex justify-between font-medium">
                                                                <span>Demanded: <strong>{acc.qty.toLocaleString()} {acc.unit}</strong></span>
                                                                <span className="font-mono text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded">{acc.accrualNo}</span>
                                                            </div>
                                                            <div className="text-xs text-slate-400 truncate">
                                                                Vendor: <strong>{acc.supplierName}</strong>
                                                            </div>
                                                            <div className="flex justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-700/60">
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                                    Settled: {acc.billedQty.toLocaleString()} {acc.unit}
                                                                </span>
                                                                <span className="text-rose-600 dark:text-rose-400 font-bold">
                                                                    Rem: {acc.remainingQty.toLocaleString()} {acc.unit}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                                Rate: Rs. {acc.rate.toFixed(2)} | Rem. Amount: Rs. {acc.remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-slate-400 p-4 bg-white dark:bg-slate-800 rounded-xl">
                                                    No third-party dyeing or finishing service accrual attached to this batch.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Complete Accrual Lines Table: Full Width with whitespace-nowrap */}
                            <div className="space-y-3">
                                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <FileText size={18} className="text-indigo-500" />
                                    <span>Detailed Accrual Ledger Lines</span>
                                </h3>

                                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold">
                                            <tr>
                                                <th className="px-5 py-3.5 whitespace-nowrap">Accrual #</th>
                                                <th className="px-5 py-3.5 whitespace-nowrap">Stage</th>
                                                <th className="px-5 py-3.5 whitespace-nowrap">Item / Service</th>
                                                <th className="px-5 py-3.5 whitespace-nowrap">Supplier</th>
                                                <th className="px-5 py-3.5 whitespace-nowrap text-right">Demanded</th>
                                                <th className="px-5 py-3.5 whitespace-nowrap text-right">Settled</th>
                                                <th className="px-5 py-3.5 whitespace-nowrap text-right">Remaining</th>
                                                <th className="px-5 py-3.5 whitespace-nowrap text-right">Rate</th>
                                                <th className="px-5 py-3.5 whitespace-nowrap text-right">Rem. Value</th>
                                                <th className="px-5 py-3.5 whitespace-nowrap text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                            {[
                                                ...(selectedBatchForDrillDown.stages?.yarn?.accruals || []),
                                                ...(selectedBatchForDrillDown.stages?.weaving?.accruals || []),
                                                ...(selectedBatchForDrillDown.stages?.dyeingFinish?.accruals || []),
                                                ...(selectedBatchForDrillDown.stages?.other || [])
                                            ].map((acc: any) => (
                                                <tr key={acc.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                                                    <td className="px-5 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                                        {acc.accrualNo}
                                                    </td>
                                                    <td className="px-5 py-3.5 font-bold uppercase text-slate-500 whitespace-nowrap">
                                                        {acc.serviceType || acc.stage}
                                                    </td>
                                                    <td className="px-5 py-3.5 font-black text-slate-900 dark:text-white whitespace-nowrap">
                                                        {acc.productName}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                        {acc.supplierName}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                        {acc.qty.toLocaleString()} {acc.unit}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                        {acc.billedQty.toLocaleString()} {acc.unit}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                                        {acc.remainingQty.toLocaleString()} {acc.unit}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right text-slate-500 whitespace-nowrap">
                                                        Rs. {acc.rate.toFixed(2)}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                                                        Rs. {acc.remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                                                        {acc.isSettled ? (
                                                            <span className="px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                                                BILLED
                                                            </span>
                                                        ) : acc.billedQty > 0 ? (
                                                            <span className="px-3 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                                                                PARTIAL
                                                            </span>
                                                        ) : (
                                                            <span className="px-3 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                                                                PENDING
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 md:px-8 md:py-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex flex-wrap justify-between items-center gap-4">
                            <button
                                onClick={() => setSelectedBatchForDrillDown(null)}
                                className="px-6 py-2.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                            >
                                Close Drill Down
                            </button>

                            <div className="flex items-center gap-3">
                                {selectedBatchForDrillDown.batchId !== 'standalone-accruals' && (
                                    <button
                                        onClick={() => router.push(`/finance/production/execution/${selectedBatchForDrillDown.batchId}`)}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-all border border-slate-700 shadow-sm"
                                    >
                                        <span>Inspect Batch Execution</span>
                                        <ArrowUpRight size={15} />
                                    </button>
                                )}

                                <button
                                    onClick={() => router.push('/finance/purchase/invoices/new')}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 transition-all"
                                >
                                    <span>Settle via Invoice / Stock</span>
                                    <ArrowRight size={15} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* SETTLED ACCRUALS & CLEARING RECORDS MODAL (CRUD: View / Edit / Revert)    */}
            {/* ========================================================================= */}
            {isSettledHistoryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div 
                        className="bg-white dark:bg-slate-900 w-full max-w-[97vw] 2xl:max-w-[95rem] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[96vh] h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 md:px-8 md:py-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-slate-50/80 dark:bg-slate-800/40">
                            <div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                        <History size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                                            Settled Accruals &amp; Stock Clearing History
                                        </h2>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Complete audit trail of all production demands settled against warehouse inventory or vendor purchase bills.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsSettledHistoryOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Search & Summary Bar */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={settledSearch}
                                    onChange={(e) => setSettledSearch(e.target.value)}
                                    placeholder="Filter by Accrual #, Product, Warehouse, Lot, JV #..."
                                    className="w-full pl-9 pr-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xs font-bold text-slate-500">
                                    Total Settled: <strong className="text-slate-900 dark:text-white font-mono">{filteredSettledHistory.length}</strong> Record(s)
                                </span>
                                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    Stock Deductions: {settledHistory.filter(s => s.settlementType === 'STOCK').length}
                                </span>
                                <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                    Vendor Invoices: {settledHistory.filter(s => s.settlementType === 'INVOICE').length}
                                </span>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-y-auto">
                            {filteredSettledHistory.length === 0 ? (
                                <div className="text-center py-24 text-slate-400 space-y-2">
                                    <History size={40} className="mx-auto text-slate-300 dark:text-slate-600 animate-pulse" />
                                    <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No Settled Accrual Records Found</p>
                                    <p className="text-xs text-slate-400">Accruals settled from physical warehouse stock or bills will appear here.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs min-w-[1100px]">
                                        <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase tracking-wider text-[11px] font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                                            <tr>
                                                <th className="px-6 py-4">Accrual #</th>
                                                <th className="px-6 py-4">Settlement Date</th>
                                                <th className="px-6 py-4 text-center">Settlement Mode</th>
                                                <th className="px-6 py-4">Settled Product / Material</th>
                                                <th className="px-6 py-4">Warehouse &amp; Lot</th>
                                                <th className="px-6 py-4 text-right">Settled Qty</th>
                                                <th className="px-6 py-4 text-right">Cost Rate</th>
                                                <th className="px-6 py-4 text-right">Total Amount</th>
                                                <th className="px-6 py-4 text-center">GL Voucher</th>
                                                <th className="px-6 py-4 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                            {filteredSettledHistory.map((s: any) => (
                                                <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                                    <td className="px-6 py-4 font-mono font-black text-indigo-600 dark:text-indigo-400">
                                                        {s.accrualNo}
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-slate-500 whitespace-nowrap">
                                                        {s.settlementDate || "-"}
                                                    </td>
                                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                                        {s.settlementType === 'STOCK' ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                <Package size={12} /> Stock Out
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                <Receipt size={12} /> Invoice
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-900 dark:text-white text-xs">{s.productName}</div>
                                                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{s.productCode}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-semibold text-slate-700 dark:text-slate-300">{s.warehouseName}</div>
                                                        {s.lotNo && s.lotNo !== '-' && (
                                                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">Lot: {s.lotNo}</div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                                        {Number(s.qty).toLocaleString()} KG
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                        Rs. {Number(s.rate).toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                        Rs. {Number(s.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                                        {s.journalEntry ? (
                                                            <span className="font-mono text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                                                {s.journalEntry.number}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setViewingSettlement(s)}
                                                                className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                                                                title="View Details & GL Lines"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingSettlement({
                                                                    ...s,
                                                                    qty: s.qty,
                                                                    rate: s.rate,
                                                                    warehouseId: s.warehouseId,
                                                                    remarks: s.remarks || ''
                                                                })}
                                                                className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                                                                title="Edit Settlement (Qty / Rate / Warehouse)"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={isRevertingSettlement}
                                                                onClick={() => handleRevertSettlement(s)}
                                                                className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors disabled:opacity-50 cursor-pointer"
                                                                title="Revert / Delete Settlement (Restores Stock)"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex justify-between items-center">
                            <span className="text-xs text-slate-500 font-medium">
                                Changes made here automatically adjust Physical Stock Ledger and General Ledger balances.
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsSettledHistoryOpen(false)}
                                className="px-6 py-2.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Viewing Settlement Details Modal */}
            {viewingSettlement && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                    <div 
                        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-slate-50/80 dark:bg-slate-800/40">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                    Settlement Voucher Details
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Accrual #{viewingSettlement.accrualNo} • {viewingSettlement.settlementType === 'STOCK' ? 'Warehouse Stock Deduction' : 'Vendor Bill'}
                                </p>
                            </div>
                            <button
                                onClick={() => setViewingSettlement(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 space-y-2 text-xs">
                                <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase">Product:</span><span className="font-black text-slate-900 dark:text-white">{viewingSettlement.productName}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase">Warehouse:</span><span className="font-bold text-slate-800 dark:text-slate-200">{viewingSettlement.warehouseName}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase">Settled Qty:</span><span className="font-black text-emerald-600 dark:text-emerald-400">{Number(viewingSettlement.qty).toLocaleString()} KG</span></div>
                                <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase">Cost Rate:</span><span className="font-mono font-bold text-slate-900 dark:text-white">Rs. {Number(viewingSettlement.rate).toFixed(2)}</span></div>
                                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700"><span className="text-slate-500 font-black uppercase">Total Value:</span><span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">Rs. {Number(viewingSettlement.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase">Settlement Date:</span><span className="font-mono text-slate-600 dark:text-slate-300">{viewingSettlement.settlementDate}</span></div>
                                {viewingSettlement.remarks && (
                                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-500">
                                        <span className="font-bold">Remarks:</span> {viewingSettlement.remarks}
                                    </div>
                                )}
                            </div>

                            {viewingSettlement.journalEntry ? (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <FileText size={14} className="text-indigo-500" />
                                            General Ledger Voucher ({viewingSettlement.journalEntry.number})
                                        </span>
                                    </div>
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase font-black text-[10px]">
                                                <tr>
                                                    <th className="p-2.5">Account</th>
                                                    <th className="p-2.5 text-right">Debit (PKR)</th>
                                                    <th className="p-2.5 text-right">Credit (PKR)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {viewingSettlement.journalEntry.lines.map((l: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                        <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">
                                                            <div className="font-bold">{l.accountName}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">{l.accountCode}</div>
                                                        </td>
                                                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                            {l.debit > 0 ? l.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                                                        </td>
                                                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                            {l.credit > 0 ? l.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-800/40">
                            <button
                                onClick={() => setViewingSettlement(null)}
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Editing Settlement Modal */}
            {editingSettlement && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                    <div 
                        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-slate-50/80 dark:bg-slate-800/40">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                    Edit Settlement Record
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Accrual #{editingSettlement.accrualNo} • {editingSettlement.productName}
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingSettlement(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Settled Quantity (KG)</label>
                                <input
                                    type="number"
                                    value={editingSettlement.qty}
                                    onChange={(e) => setEditingSettlement({ ...editingSettlement, qty: Number(e.target.value) })}
                                    className="w-full mt-1.5 p-3 text-sm font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Settlement Cost Rate (PKR)</label>
                                <input
                                    type="number"
                                    value={editingSettlement.rate}
                                    onChange={(e) => setEditingSettlement({ ...editingSettlement, rate: Number(e.target.value) })}
                                    className="w-full mt-1.5 p-3 text-sm font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Deduction Warehouse</label>
                                <select
                                    value={editingSettlement.warehouseId}
                                    onChange={(e) => setEditingSettlement({ ...editingSettlement, warehouseId: e.target.value })}
                                    className="w-full mt-1.5 p-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    {warehouses.map((w: any) => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Remarks</label>
                                <input
                                    type="text"
                                    value={editingSettlement.remarks}
                                    onChange={(e) => setEditingSettlement({ ...editingSettlement, remarks: e.target.value })}
                                    className="w-full mt-1.5 p-3 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-300">
                                <strong>Note:</strong> Modifying quantity or rate will adjust the physical inventory deduction (<code className="font-mono">StockLedger</code>), update the General Ledger entry, and recalculate unbilled accrual balances.
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/40">
                            <button
                                type="button"
                                onClick={() => setEditingSettlement(null)}
                                className="px-5 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEditSettlement}
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 cursor-pointer"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
