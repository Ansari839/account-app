"use client";

import React, { useState, useEffect, useMemo } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import { 
    PackageSearch, Loader2, ArrowRight, Layers, Factory, 
    CheckCircle2, Clock, AlertCircle, FileText, ExternalLink, 
    ChevronDown, ChevronUp, Search, Filter, Warehouse as WarehouseIcon, 
    Tag, Coins, Check, ArrowUpRight, Scissors, Sparkles, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useCompany } from "@/context/CompanyContext";

export default function ProductionDashboard() {
    const router = useRouter();
    const { isManufacturing, permissionsLoaded } = useCompany();

    // Top-Level Mode: Requirement: "kam 1 or 2 tab wise kr dena shi"
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
    const [expandedBatchIds, setExpandedBatchIds] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchDashboardData();
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

    const toggleBatchExpand = (batchId: string) => {
        setExpandedBatchIds(prev => ({
            ...prev,
            [batchId]: !prev[batchId]
        }));
    };

    // Requirement 1: Only categories with stock > 0 are present in `categories`.
    const activeCategory = categories.find(c => c.id === activeTab) || (categories.length > 0 ? categories[0] : null);

    // Filter products within active category
    const filteredProducts = useMemo(() => {
        if (!activeCategory || !activeCategory.products) return [];
        return activeCategory.products.filter((p: any) => {
            // Strictly stockBalance > 0
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
                    /* TAB 2: UNSETTLED ACCRUALS (PRODUCTION & STAGE-WISE TRACKING)              */
                    /* ========================================================================= */
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {/* Summary Metrics Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unsettled Batches</span>
                                    <span className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                                        <Clock size={20} />
                                    </span>
                                </div>
                                <div className="mt-4 flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-slate-900 dark:text-white">
                                        {accrualsSummary.unsettledBatchesCount || 0}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">
                                        of {accrualsSummary.totalBatches || 0} Total Batches
                                    </span>
                                </div>
                                <div className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                                    {accrualsSummary.fullySettledBatchesCount || 0} Batches fully cleared
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Remaining Liability</span>
                                    <span className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
                                        <Coins size={20} />
                                    </span>
                                </div>
                                <div className="mt-4">
                                    <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                                        Rs. {(accrualsSummary.totalRemainingLiability || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="mt-2 text-xs font-medium text-slate-500">
                                    Pending settlement against warehouse stock or purchase invoices
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stage 1: Raw Yarn Demands</span>
                                    <span className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                                        <Layers size={20} />
                                    </span>
                                </div>
                                <div className="mt-4 flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                                        {accrualsSummary.yarnPendingCount || 0}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">Pending Batches</span>
                                </div>
                                <div className="mt-2 text-xs font-medium text-slate-500">
                                    Raw yarn unbilled demands awaiting stock deduction or bill
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stage 3: Dyeing &amp; Finish</span>
                                    <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                                        <Scissors size={20} />
                                    </span>
                                </div>
                                <div className="mt-4 flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                                        {accrualsSummary.dyeingPendingCount || 0}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">Pending Batches</span>
                                </div>
                                <div className="mt-2 text-xs font-medium text-slate-500">
                                    Wet processing services awaiting supplier invoice clearance
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
                                    className="w-full pl-10 pr-4 py-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
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

                        {/* Batches Production-wise List */}
                        {filteredBatches.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800">
                                <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-3" />
                                <h3 className="text-xl font-black text-slate-900 dark:text-white">No Pending Accruals Found</h3>
                                <p className="text-slate-500 text-sm mt-1 max-w-md text-center">
                                    All production batches matching the selected filter have their stage demands and accruals fully settled.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {filteredBatches.map((batch: any) => {
                                    const isExpanded = Boolean(expandedBatchIds[batch.batchId]);
                                    const isFullySettled = batch.overallStatus === "FULLY_SETTLED";
                                    const isPartiallySettled = batch.overallStatus === "PARTIALLY_SETTLED";

                                    // Stage objects
                                    const yarnStage = batch.stages?.yarn;
                                    const weavingStage = batch.stages?.weaving;
                                    const dyeingStage = batch.stages?.dyeingFinish;

                                    return (
                                        <div 
                                            key={batch.batchId}
                                            className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all overflow-hidden"
                                        >
                                            {/* Batch Card Top Bar */}
                                            <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <span className="font-mono text-sm font-black px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                            {batch.batchNo}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                                            <Clock size={13} />
                                                            {new Date(batch.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                        </span>
                                                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                                            {batch.warehouseName}
                                                        </span>
                                                        {isFullySettled ? (
                                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                                                <CheckCircle2 size={13} />
                                                                All Stages Settled
                                                            </span>
                                                        ) : isPartiallySettled ? (
                                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                                                                <AlertTriangle size={13} />
                                                                Partially Settled (Some Stages Remaining)
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                                                                <Clock size={13} />
                                                                All Demands Pending Settlement
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-3 pt-1">
                                                        <span className="text-lg font-black text-slate-900 dark:text-white">
                                                            {batch.outputProductName}
                                                        </span>
                                                        <span className="text-sm font-bold text-slate-500">
                                                            • {batch.outputQuantity.toLocaleString()} {batch.outputUnit} Produced
                                                        </span>
                                                        {batch.specNotes && (
                                                            <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                                {batch.specNotes}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-3 self-end lg:self-center">
                                                    <div className="text-right pr-2">
                                                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                            Remaining Liability
                                                        </div>
                                                        <div className="text-lg font-black text-rose-600 dark:text-rose-400">
                                                            Rs. {batch.remainingLiability.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                    </div>

                                                    {batch.batchId !== 'standalone-accruals' && (
                                                        <button
                                                            onClick={() => router.push(`/finance/production/execution/${batch.batchId}`)}
                                                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all shadow-sm"
                                                        >
                                                            <span>Inspect Batch</span>
                                                            <ArrowUpRight size={14} />
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => router.push('/finance/purchase/invoices/new')}
                                                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-500/20"
                                                    >
                                                        <span>Settle via Invoice / Stock</span>
                                                        <ArrowRight size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Stage-wise Breakdown Grid (Requirement: "yani stages wise us me pta chle k yarn ho gya he other like weaiving or finish wale baki") */}
                                            <div className="p-6">
                                                <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                                                    <Layers size={13} />
                                                    <span>Stage-Wise Settlement Status</span>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    {/* STAGE 1: RAW YARN */}
                                                    <div className={cn(
                                                        "p-5 rounded-2xl border transition-all flex flex-col justify-between",
                                                        yarnStage?.status === "SETTLED"
                                                            ? "bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-800/40"
                                                            : yarnStage?.status === "STOCK_ALLOCATED"
                                                            ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                                                            : yarnStage?.status === "PARTIALLY_SETTLED"
                                                            ? "bg-amber-50/50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-800/40"
                                                            : yarnStage?.status === "PENDING"
                                                            ? "bg-rose-50/50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-800/40"
                                                            : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60"
                                                    )}>
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                                                    <span>🧶</span>
                                                                    <span>Stage 1: Raw Yarn</span>
                                                                </span>

                                                                {yarnStage?.status === "SETTLED" ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                                                        <CheckCircle2 size={12} />
                                                                        Settled (100%)
                                                                    </span>
                                                                ) : yarnStage?.status === "STOCK_ALLOCATED" ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                                                                        <Check size={12} />
                                                                        From Warehouse Stock
                                                                    </span>
                                                                ) : yarnStage?.status === "PARTIALLY_SETTLED" ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                                                                        <AlertTriangle size={12} />
                                                                        Partially Settled
                                                                    </span>
                                                                ) : yarnStage?.status === "PENDING" ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                                                                        <Clock size={12} />
                                                                        Pending Settlement
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[11px] font-bold text-slate-400">None / In-House</span>
                                                                )}
                                                            </div>

                                                            {yarnStage?.accruals && yarnStage.accruals.length > 0 ? (
                                                                <div className="space-y-2 mt-3">
                                                                    {yarnStage.accruals.map((acc: any) => (
                                                                        <div key={acc.id} className="text-xs">
                                                                            <div className="font-bold text-slate-900 dark:text-white truncate">
                                                                                {acc.productName}
                                                                            </div>
                                                                            <div className="text-slate-500 flex items-center justify-between mt-0.5 font-medium">
                                                                                <span>Demanded: {acc.qty.toLocaleString()} {acc.unit}</span>
                                                                                <span className="font-mono text-slate-400">{acc.accrualNo}</span>
                                                                            </div>
                                                                            <div className="flex items-center justify-between mt-1 text-[11px]">
                                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                                                    Settled: {acc.billedQty.toLocaleString()} {acc.unit}
                                                                                </span>
                                                                                <span className="text-rose-600 dark:text-rose-400 font-bold">
                                                                                    Rem: {acc.remainingQty.toLocaleString()} {acc.unit}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-1">
                                                                                Amount: Rs. {acc.remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : yarnStage?.status === "STOCK_ALLOCATED" ? (
                                                                <div className="mt-3 text-xs text-slate-500">
                                                                    Physical raw yarn allocated directly from warehouse inventory during batch processing.
                                                                </div>
                                                            ) : (
                                                                <div className="mt-3 text-xs text-slate-400">
                                                                    No external yarn unbilled demand attached to this batch.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* STAGE 2: WEAVING / KNITTING */}
                                                    <div className={cn(
                                                        "p-5 rounded-2xl border transition-all flex flex-col justify-between",
                                                        weavingStage?.status === "SETTLED"
                                                            ? "bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-800/40"
                                                            : weavingStage?.status === "IN_HOUSE"
                                                            ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                                                            : weavingStage?.status === "PARTIALLY_SETTLED"
                                                            ? "bg-amber-50/50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-800/40"
                                                            : weavingStage?.status === "PENDING"
                                                            ? "bg-rose-50/50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-800/40"
                                                            : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60"
                                                    )}>
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                                                    <span>🧵</span>
                                                                    <span>Stage 2: Weaving / Knit</span>
                                                                </span>

                                                                {weavingStage?.status === "SETTLED" ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                                                        <CheckCircle2 size={12} />
                                                                        Settled (100%)
                                                                    </span>
                                                                ) : weavingStage?.status === "IN_HOUSE" ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                                                                        In-House / None
                                                                    </span>
                                                                ) : weavingStage?.status === "PARTIALLY_SETTLED" ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                                                                        <AlertTriangle size={12} />
                                                                        Partially Settled
                                                                    </span>
                                                                ) : weavingStage?.status === "PENDING" ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                                                                        <Clock size={12} />
                                                                        Pending Settlement
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[11px] font-bold text-slate-400">None / In-House</span>
                                                                )}
                                                            </div>

                                                            {weavingStage?.accruals && weavingStage.accruals.length > 0 ? (
                                                                <div className="space-y-2 mt-3">
                                                                    {weavingStage.accruals.map((acc: any) => (
                                                                        <div key={acc.id} className="text-xs">
                                                                            <div className="font-bold text-slate-900 dark:text-white truncate">
                                                                                {acc.productName}
                                                                            </div>
                                                                            <div className="text-slate-500 flex items-center justify-between mt-0.5 font-medium">
                                                                                <span>Demanded: {acc.qty.toLocaleString()} {acc.unit}</span>
                                                                                <span className="font-mono text-slate-400">{acc.accrualNo}</span>
                                                                            </div>
                                                                            <div className="text-slate-400 text-[11px] mt-0.5">
                                                                                Vendor: {acc.supplierName}
                                                                            </div>
                                                                            <div className="flex items-center justify-between mt-1 text-[11px]">
                                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                                                    Settled: {acc.billedQty.toLocaleString()} {acc.unit}
                                                                                </span>
                                                                                <span className="text-rose-600 dark:text-rose-400 font-bold">
                                                                                    Rem: {acc.remainingQty.toLocaleString()} {acc.unit}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-1">
                                                                                Amount: Rs. {acc.remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="mt-3 text-xs text-slate-400">
                                                                    In-house weaving or no third-party outsourced knitting accrual booked.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* STAGE 3: DYEING / FINISHING / SERVICES */}
                                                    <div className={cn(
                                                        "p-5 rounded-2xl border transition-all flex flex-col justify-between",
                                                        dyeingStage?.status === "SETTLED"
                                                            ? "bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-800/40"
                                                            : dyeingStage?.status === "IN_HOUSE"
                                                            ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                                                            : dyeingStage?.status === "PARTIALLY_SETTLED"
                                                            ? "bg-amber-50/50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-800/40"
                                                            : dyeingStage?.status === "PENDING"
                                                            ? "bg-rose-50/50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-800/40"
                                                            : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60"
                                                    )}>
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                                                    <span>🎨</span>
                                                                    <span>Stage 3: Dyeing / Finish</span>
                                                                </span>

                                                                {dyeingStage?.status === "SETTLED" ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                                                        <CheckCircle2 size={12} />
                                                                        Settled (100%)
                                                                    </span>
                                                                ) : dyeingStage?.status === "IN_HOUSE" ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                                                                        In-House / None
                                                                    </span>
                                                                ) : dyeingStage?.status === "PARTIALLY_SETTLED" ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                                                                        <AlertTriangle size={12} />
                                                                        Partially Settled
                                                                    </span>
                                                                ) : dyeingStage?.status === "PENDING" ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                                                                        <Clock size={12} />
                                                                        Pending Settlement
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[11px] font-bold text-slate-400">None / In-House</span>
                                                                )}
                                                            </div>

                                                            {dyeingStage?.accruals && dyeingStage.accruals.length > 0 ? (
                                                                <div className="space-y-2 mt-3">
                                                                    {dyeingStage.accruals.map((acc: any) => (
                                                                        <div key={acc.id} className="text-xs">
                                                                            <div className="font-bold text-slate-900 dark:text-white truncate">
                                                                                {acc.productName}
                                                                            </div>
                                                                            <div className="text-slate-500 flex items-center justify-between mt-0.5 font-medium">
                                                                                <span>Demanded: {acc.qty.toLocaleString()} {acc.unit}</span>
                                                                                <span className="font-mono text-slate-400">{acc.accrualNo}</span>
                                                                            </div>
                                                                            <div className="text-slate-400 text-[11px] mt-0.5 truncate">
                                                                                Vendor: {acc.supplierName}
                                                                            </div>
                                                                            <div className="flex items-center justify-between mt-1 text-[11px]">
                                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                                                    Settled: {acc.billedQty.toLocaleString()} {acc.unit}
                                                                                </span>
                                                                                <span className="text-rose-600 dark:text-rose-400 font-bold">
                                                                                    Rem: {acc.remainingQty.toLocaleString()} {acc.unit}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-1">
                                                                                Amount: Rs. {acc.remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="mt-3 text-xs text-slate-400">
                                                                    No external dyeing or finishing service accrual attached to this batch.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Expandable Line Details Toggle */}
                                                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                                                    <button
                                                        onClick={() => toggleBatchExpand(batch.batchId)}
                                                        className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                                    >
                                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        <span>{isExpanded ? "Hide Line Details" : "View Detailed Line Items & Calculations"}</span>
                                                    </button>
                                                    
                                                    <span className="text-slate-400 font-medium">
                                                        Total Settled: {batch.totalSettledQty.toLocaleString()} Units | Demanded: {batch.totalDemanded.toLocaleString()} Units
                                                    </span>
                                                </div>

                                                {/* Expanded Details Table */}
                                                {isExpanded && (
                                                    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 animate-in fade-in duration-300">
                                                        <table className="w-full text-left text-xs">
                                                            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold">
                                                                <tr>
                                                                    <th className="px-4 py-2.5">Accrual #</th>
                                                                    <th className="px-4 py-2.5">Stage</th>
                                                                    <th className="px-4 py-2.5">Material / Service</th>
                                                                    <th className="px-4 py-2.5">Supplier / Origin</th>
                                                                    <th className="px-4 py-2.5 text-right">Demanded</th>
                                                                    <th className="px-4 py-2.5 text-right">Settled</th>
                                                                    <th className="px-4 py-2.5 text-right">Remaining</th>
                                                                    <th className="px-4 py-2.5 text-right">Cost Rate</th>
                                                                    <th className="px-4 py-2.5 text-right">Rem. Value</th>
                                                                    <th className="px-4 py-2.5 text-center">Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                                                {[
                                                                    ...(yarnStage?.accruals || []),
                                                                    ...(weavingStage?.accruals || []),
                                                                    ...(dyeingStage?.accruals || []),
                                                                    ...(batch.stages?.other || [])
                                                                ].map((acc: any) => (
                                                                    <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                                        <td className="px-4 py-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                                            {acc.accrualNo}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 font-bold uppercase text-slate-500">
                                                                            {acc.serviceType || acc.stage}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                                                                            {acc.productName}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-slate-500">
                                                                            {acc.supplierName}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-right font-medium text-slate-700 dark:text-slate-300">
                                                                            {acc.qty.toLocaleString()} {acc.unit}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                                            {acc.billedQty.toLocaleString()} {acc.unit}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-right font-bold text-rose-600 dark:text-rose-400">
                                                                            {acc.remainingQty.toLocaleString()} {acc.unit}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-right text-slate-500">
                                                                            Rs. {acc.rate.toFixed(2)}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-right font-black text-slate-900 dark:text-white">
                                                                            Rs. {acc.remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-center">
                                                                            {acc.isSettled ? (
                                                                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                                                                    BILLED
                                                                                </span>
                                                                            ) : acc.billedQty > 0 ? (
                                                                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                                                                                    PARTIAL
                                                                                </span>
                                                                            ) : (
                                                                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                                                                                    PENDING
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
