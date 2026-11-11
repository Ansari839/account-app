"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import DataTable, { Column } from "@/components/DataTable";
import OpeningStockModal from "@/components/inventory/OpeningStockModal";
import { 
    Plus, 
    Layers, 
    Package, 
    Warehouse, 
    Tags, 
    Calculator, 
    AlertCircle, 
    Trash2, 
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

    useEffect(() => {
        fetchEntries();
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
            <OpeningStockModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={fetchEntries}
            />
        </MainLayout>
    );
}
