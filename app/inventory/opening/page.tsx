"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import DataTable, { Column } from "@/components/DataTable";
import Combobox from "@/components/Combobox";
import { 
    Plus, 
    Layers, 
    Package, 
    Warehouse, 
    Tags, 
    Calendar, 
    Calculator, 
    CheckCircle2, 
    AlertCircle, 
    Trash2, 
    X, 
    Globe, 
    Sparkles, 
    ShieldAlert
} from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function OpeningStockPage() {
    const { showNotification } = useNotifications();
    
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Dropdown Data
    const [products, setProducts] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        productId: "",
        warehouseId: "",
        stage: "RAW", // RAW | GREY | FINISH
        origin: "LOCAL", // LOCAL | IMPORT
        isEFS: false,
        qty: "",
        costRate: "",
        itpRate: "",
        batchNo: "",
        date: new Date().toISOString().split("T")[0]
    });

    useEffect(() => {
        fetchEntries();
        fetchDropdowns();
    }, []);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch("/api/inventory/opening");
            const json = await res.json();
            if (json.success) setEntries(json.data);
        } catch (e) {
            console.error("Error fetching opening entries:", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchDropdowns = async () => {
        try {
            const [prodRes, whRes] = await Promise.all([
                authenticatedFetch("/api/inventory/products"),
                authenticatedFetch("/api/inventory/warehouses")
            ]);

            if (prodRes.ok) {
                const prodJson = await prodRes.json();
                if (prodJson.success) setProducts(prodJson.data);
            }
            if (whRes.ok) {
                const whJson = await whRes.json();
                if (whJson.success) setWarehouses(whJson.data);
            }
        } catch (e) {
            console.error("Error fetching dropdowns:", e);
        }
    };

    const handleProductSelect = (id: string) => {
        const prod = products.find(p => p.id === id);
        setFormData(prev => ({
            ...prev,
            productId: id,
            stage: prod?.stage || "RAW"
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.productId) {
            showNotification("error", "Please select a product");
            return;
        }
        if (!formData.warehouseId) {
            showNotification("error", "Please select a warehouse");
            return;
        }
        if (Number(formData.qty) <= 0) {
            showNotification("error", "Quantity must be greater than 0");
            return;
        }

        setSubmitting(true);
        try {
            const res = await authenticatedFetch("/api/inventory/opening", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const json = await res.json();
            if (json.success) {
                showNotification("success", "Opening stock added successfully!");
                setModalOpen(false);
                setFormData({
                    productId: "",
                    warehouseId: "",
                    stage: "RAW",
                    origin: "LOCAL",
                    isEFS: false,
                    qty: "",
                    costRate: "",
                    itpRate: "",
                    batchNo: "",
                    date: new Date().toISOString().split("T")[0]
                });
                fetchEntries();
            } else {
                showNotification("error", json.error || "Failed to add opening stock");
            }
        } catch (e) {
            showNotification("error", "Network error while saving opening stock");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to remove this opening stock record?")) return;

        try {
            const res = await authenticatedFetch(`/api/inventory/opening?id=${id}`, {
                method: "DELETE"
            });
            const json = await res.json();
            if (json.success) {
                showNotification("success", "Opening stock removed");
                fetchEntries();
            } else {
                showNotification("error", json.error || "Failed to delete");
            }
        } catch (e) {
            showNotification("error", "Network error");
        }
    };

    // Calculate Summary Totals
    const totalQty = entries.reduce((acc, e) => acc + (Number(e.qty) || 0), 0);
    const totalValue = entries.reduce((acc, e) => acc + (Number(e.totalValue) || 0), 0);
    const localCount = entries.filter(e => e.origin === "LOCAL").length;
    const importCount = entries.filter(e => e.origin === "IMPORT").length;

    const selectedProduct = products.find(p => p.id === formData.productId);

    const columns: Column<any>[] = [
        {
            header: "Product / Item",
            accessor: (row) => (
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{row.productName}</span>
                        {row.isService && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tight bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                                Service / Unconsumed
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">{row.productCode}</span>
                </div>
            )
        },
        {
            header: "Type & Origin",
            accessor: (row) => (
                <div className="flex flex-wrap items-center gap-1.5">
                    {row.origin === "LOCAL" ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            LOCAL
                        </span>
                    ) : (
                        <>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                IMPORT
                            </span>
                            {row.isEFS ? (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30" title="Non-Saleable locally, only consumable in production">
                                    EFS
                                </span>
                            ) : (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                    NON-EFS
                                </span>
                            )}
                        </>
                    )}
                </div>
            )
        },
        {
            header: "Stage",
            accessor: (row) => {
                const stageColors: Record<string, string> = {
                    RAW: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                    GREY: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                    FINISH: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                };
                return (
                    <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border", stageColors[row.stage] || "bg-slate-100 text-slate-600")}>
                        {row.stage}
                    </span>
                );
            }
        },
        {
            header: "Warehouse",
            accessor: "warehouseName"
        },
        {
            header: "Quantity",
            accessor: (row) => (
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {Number(row.qty).toLocaleString()} <span className="text-[10px] font-sans text-slate-400">{row.unitName}</span>
                </div>
            )
        },
        {
            header: "Book Rate (PKR)",
            accessor: (row) => (
                <div className="font-mono text-slate-700 dark:text-slate-300">
                    Rs. {Number(row.costRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
            )
        },
        {
            header: "ITP Rate (PKR)",
            accessor: (row) => (
                row.origin === "IMPORT" && Number(row.itpRate) > 0 ? (
                    <span className="font-mono text-amber-600 dark:text-amber-400 font-bold text-xs">
                        Rs. {Number(row.itpRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                ) : (
                    <span className="text-slate-400 text-xs">—</span>
                )
            )
        },
        {
            header: "Total Value (PKR)",
            accessor: (row) => (
                <span className="font-mono font-black text-slate-900 dark:text-white">
                    Rs. {Number(row.totalValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
            )
        },
        {
            header: "Batch / GD #",
            accessor: (row) => (
                <span className="text-xs font-mono text-slate-500">
                    {row.batchNo || "—"}
                </span>
            )
        },
        {
            header: "Actions",
            accessor: (row) => (
                <button
                    onClick={() => handleDelete(row.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="Remove Entry"
                >
                    <Trash2 size={16} />
                </button>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="space-y-6 animate-in fade-in duration-500 pb-32">
                {/* Header Action Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                                Inventory Master
                            </span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            Opening Stock Entry
                        </h1>
                        <p className="text-sm font-medium text-slate-500 mt-1">
                            Record initial inventory balances with Local / Import, EFS, Stage, and Service tags.
                        </p>
                    </div>

                    <button
                        onClick={() => setModalOpen(true)}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                    >
                        <Plus size={18} /> Add Opening Stock
                    </button>
                </div>

                {/* Summary Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Package size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Opening Lots</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{entries.length}</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <Calculator size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Book Value</p>
                            <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5 font-mono">
                                Rs. {totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <Tags size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Local Stock Lots</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{localCount}</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400">
                            <Globe size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Import Stock Lots</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{importCount}</p>
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <DataTable 
                        data={entries} 
                        columns={columns} 
                        isLoading={loading} 
                        searchPlaceholder="Search by item, batch, warehouse..." 
                    />
                </div>
            </div>

            {/* Modal: Add Opening Stock Form */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <Package size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Add Opening Stock</h3>
                                    <p className="text-xs font-bold text-slate-400">Specify lot origin, stage, and valuation</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* Product Selection */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Package size={14} className="text-indigo-500" /> Product / Item <span className="text-rose-500">*</span>
                                </label>
                                <Combobox
                                    options={products.map(p => ({
                                        value: p.id,
                                        label: `${p.name} (${p.code})${p.isService ? ' [Service/Unconsumed]' : ''}`
                                    }))}
                                    value={formData.productId}
                                    onChange={handleProductSelect}
                                    placeholder="Search and select product or service..."
                                    searchPlaceholder="Search product name or code..."
                                    className="w-full"
                                />
                                {selectedProduct?.isService && (
                                    <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1 mt-1">
                                        <Sparkles size={12} /> Service item selected — will be added as unconsumed local service inventory.
                                    </p>
                                )}
                            </div>

                            {/* Warehouse & Date */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                        <Warehouse size={14} className="text-indigo-500" /> Target Warehouse <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        required
                                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                        value={formData.warehouseId}
                                        onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}
                                    >
                                        <option value="">Select Warehouse...</option>
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                        <Calendar size={14} className="text-indigo-500" /> Opening Date <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Production Stage Option */}
                            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Layers size={14} className="text-indigo-500" /> Production Stage <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: "RAW", label: "RAW", desc: "Yarn / Raw Material" },
                                        { id: "GREY", label: "GREY", desc: "Loom / Kora Fabric" },
                                        { id: "FINISH", label: "FINISH", desc: "Processed / Dyed Fabric" }
                                    ].map(s => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, stage: s.id })}
                                            className={cn(
                                                "p-3 rounded-xl border text-left transition-all",
                                                formData.stage === s.id
                                                    ? "bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm"
                                                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                                            )}
                                        >
                                            <div className="text-xs font-black uppercase">{s.label}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{s.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Origin & Scheme: Local vs Import (EFS / Non-EFS) */}
                            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Globe size={14} className="text-indigo-500" /> Origin & Type <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, origin: "LOCAL", isEFS: false })}
                                        className={cn(
                                            "p-3 rounded-xl border text-left transition-all",
                                            formData.origin === "LOCAL"
                                                ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm"
                                                : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                                        )}
                                    >
                                        <div className="text-xs font-black uppercase flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Local Stock
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">Purchased locally or service</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, origin: "IMPORT" })}
                                        className={cn(
                                            "p-3 rounded-xl border text-left transition-all",
                                            formData.origin === "IMPORT"
                                                ? "bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400 font-bold shadow-sm"
                                                : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                                        )}
                                    >
                                        <div className="text-xs font-black uppercase flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-sky-500"></span> Import Stock
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">Imported under GD</div>
                                    </button>
                                </div>

                                {/* EFS vs Non-EFS sub-selection for Import */}
                                {formData.origin === "IMPORT" && (
                                    <div className="p-3 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 space-y-2 mt-2">
                                        <span className="text-[11px] font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider block">
                                            Select Import Scheme:
                                        </span>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="importScheme"
                                                    checked={formData.isEFS}
                                                    onChange={() => setFormData({ ...formData, isEFS: true })}
                                                    className="text-amber-500 focus:ring-amber-500"
                                                />
                                                <div>
                                                    <span className="text-xs font-black text-amber-600 dark:text-amber-400">EFS (Export Facilitation)</span>
                                                    <span className="text-[10px] text-slate-400 block">Strictly consumable in production only (Non-saleable)</span>
                                                </div>
                                            </label>

                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="importScheme"
                                                    checked={!formData.isEFS}
                                                    onChange={() => setFormData({ ...formData, isEFS: false })}
                                                    className="text-indigo-500 focus:ring-indigo-500"
                                                />
                                                <div>
                                                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">Non-EFS (Commercial)</span>
                                                    <span className="text-[10px] text-slate-400 block">Commercial import (Saleable locally)</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Quantity, Book Rate, ITP Rate */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Quantity <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0.0001"
                                        step="any"
                                        placeholder="0.00"
                                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-right"
                                        value={formData.qty}
                                        onChange={e => setFormData({ ...formData, qty: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Book Rate (PKR) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="any"
                                        placeholder="Cost / unit"
                                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-right"
                                        value={formData.costRate}
                                        onChange={e => setFormData({ ...formData, costRate: e.target.value })}
                                    />
                                </div>

                                {formData.origin === "IMPORT" ? (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                            ITP Rate (PKR)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            placeholder="Customs ITP rate"
                                            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-amber-500/40 text-amber-600 dark:text-amber-400 outline-none focus:ring-2 focus:ring-amber-500 text-sm font-bold text-right"
                                            value={formData.itpRate}
                                            onChange={e => setFormData({ ...formData, itpRate: e.target.value })}
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            Total Value (PKR)
                                        </label>
                                        <div className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 font-mono font-bold text-right text-sm text-slate-700 dark:text-slate-300">
                                            Rs. {(Number(formData.qty || 0) * Number(formData.costRate || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Batch / Lot / GD # */}
                            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Lot # / Batch # / GD Number
                                </label>
                                <input
                                    type="text"
                                    placeholder={formData.origin === "IMPORT" ? "e.g. KAPE-HC-12345-2026" : "e.g. LOT-2026-001"}
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                                    value={formData.batchNo}
                                    onChange={e => setFormData({ ...formData, batchNo: e.target.value })}
                                />
                            </div>

                            {/* Modal Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 text-sm transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {submitting ? "Saving..." : "Save Opening Stock"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
