"use client";

import React, { useState, useEffect } from "react";
import { authenticatedFetch } from "@/lib/api-client";
import Combobox from "@/components/Combobox";
import { 
    Layers, 
    Package, 
    Warehouse, 
    Calendar, 
    X, 
    Globe, 
    Sparkles, 
    ShieldAlert,
    Save
} from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import { cn } from "@/lib/utils";

export interface OpeningStockProduct {
    id: string;
    name: string;
    code?: string;
    stage?: string | null;
    isService?: boolean;
}

interface OpeningStockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    product?: OpeningStockProduct | null;
}

export default function OpeningStockModal({
    isOpen,
    onClose,
    onSuccess,
    product: preselectedProduct
}: OpeningStockModalProps) {
    const { showNotification } = useNotifications();
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
        if (isOpen) {
            fetchDropdowns();
            if (preselectedProduct) {
                setFormData(prev => ({
                    ...prev,
                    productId: preselectedProduct.id,
                    stage: preselectedProduct.stage || "RAW"
                }));
            }
        }
    }, [isOpen, preselectedProduct]);

    const fetchDropdowns = async () => {
        try {
            const [prodRes, whRes] = await Promise.all([
                authenticatedFetch("/api/inventory/products"),
                authenticatedFetch("/api/inventory/warehouses")
            ]);

            if (prodRes.ok) {
                const prodJson = await prodRes.json();
                if (prodJson.success) setProducts(prodJson.data || []);
            }
            if (whRes.ok) {
                const whJson = await whRes.json();
                if (whJson.success) {
                    const whs = whJson.data || [];
                    setWarehouses(whs);
                    // auto select first warehouse if not selected
                    if (whs.length > 0) {
                        setFormData(prev => ({
                            ...prev,
                            warehouseId: prev.warehouseId || whs[0].id
                        }));
                    }
                }
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

    const activeProductId = preselectedProduct?.id || formData.productId;
    const currentProduct = preselectedProduct || products.find(p => p.id === activeProductId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const pId = preselectedProduct?.id || formData.productId;

        if (!pId) {
            showNotification("error", "Please select a product");
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
                body: JSON.stringify({
                    productId: pId,
                    warehouseId: formData.warehouseId,
                    stage: formData.stage,
                    origin: formData.origin,
                    isEFS: formData.origin === "IMPORT" ? formData.isEFS : false,
                    qty: Number(formData.qty),
                    costRate: Number(formData.costRate) || 0,
                    itpRate: formData.origin === "IMPORT" ? (Number(formData.itpRate) || null) : null,
                    batchNo: formData.batchNo || null,
                    date: formData.date
                })
            });

            const json = await res.json();
            if (res.ok && json.success) {
                showNotification("success", "Opening stock recorded successfully!");
                onClose();
                if (onSuccess) onSuccess();
            } else {
                showNotification("error", json.error || "Failed to save opening stock");
            }
        } catch (e: any) {
            showNotification("error", e.message || "An error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const totalBookValue = (Number(formData.qty) || 0) * (Number(formData.costRate) || 0);
    const totalITPValue = (Number(formData.qty) || 0) * (Number(formData.itpRate) || 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
                
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                            <Layers size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Add Opening Stock</h3>
                            <p className="text-xs font-bold text-slate-400">Specify lot origin, stage, and valuation</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    {/* Product Selection */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Package size={14} className="text-indigo-500" /> Product / Item <span className="text-rose-500">*</span>
                        </label>
                        {preselectedProduct ? (
                            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                                        {preselectedProduct.name}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                        Code: {preselectedProduct.code || "N/A"}
                                    </div>
                                </div>
                                <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                    Selected
                                </span>
                            </div>
                        ) : (
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
                        )}
                        {currentProduct?.isService && (
                            <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1 mt-1">
                                <Sparkles size={12} /> Service item selected — will be added as unconsumed local service inventory.
                            </p>
                        )}
                    </div>

                    {/* Warehouse & Date */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Warehouse size={14} className="text-indigo-500" /> Target Warehouse <span className="text-slate-400 font-normal lowercase">(optional)</span>
                            </label>
                            <select
                                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                value={formData.warehouseId}
                                onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}
                            >
                                <option value="">Default Warehouse (Auto)</option>
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
                        <div className="grid grid-cols-3 gap-2">
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
                                        "p-2.5 rounded-xl border text-left transition-all",
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

                        {/* Import Scheme: EFS vs Non-EFS */}
                        {formData.origin === "IMPORT" && (
                            <div className="mt-3 p-3.5 rounded-2xl bg-sky-500/5 border border-sky-500/20 space-y-2 animate-in fade-in duration-200">
                                <label className="text-xs font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <ShieldAlert size={14} /> Customs Scheme (EFS / Commercial)
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className={cn(
                                        "flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs font-bold transition-all",
                                        formData.isEFS
                                            ? "bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400"
                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                    )}>
                                        <input
                                            type="radio"
                                            name="modalIsEFS"
                                            checked={formData.isEFS === true}
                                            onChange={() => setFormData({ ...formData, isEFS: true })}
                                            className="text-amber-600 focus:ring-amber-500"
                                        />
                                        <div>
                                            <div>EFS (Duty Exempted)</div>
                                            <div className="text-[10px] text-amber-500 font-normal">Production consumption only</div>
                                        </div>
                                    </label>

                                    <label className={cn(
                                        "flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs font-bold transition-all",
                                        !formData.isEFS
                                            ? "bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-400"
                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                    )}>
                                        <input
                                            type="radio"
                                            name="modalIsEFS"
                                            checked={formData.isEFS === false}
                                            onChange={() => setFormData({ ...formData, isEFS: false })}
                                            className="text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <div>Non-EFS (Commercial)</div>
                                            <div className="text-[10px] text-slate-400 font-normal">Saleable locally</div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quantity & Valuation */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                Quantity <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="number"
                                step="any"
                                min="0.0001"
                                required
                                placeholder="0.00"
                                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold text-right"
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
                                step="any"
                                min="0"
                                required
                                placeholder="Cost / unit"
                                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold text-right"
                                value={formData.costRate}
                                onChange={e => setFormData({ ...formData, costRate: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Total Value (PKR)
                            </label>
                            <div className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-bold text-right">
                                Rs. {totalBookValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>

                    {/* ITP Rate (Import only) */}
                    {formData.origin === "IMPORT" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 animate-in fade-in duration-200">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider">
                                    Customs ITP Rate (PKR)
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    placeholder="Assessed + Duties / Qty"
                                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-sky-500 text-sm font-semibold text-right"
                                    value={formData.itpRate}
                                    onChange={e => setFormData({ ...formData, itpRate: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Total ITP Value (PKR)
                                </label>
                                <div className="w-full p-2.5 rounded-xl bg-white/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-300 text-sm font-bold text-right">
                                    Rs. {totalITPValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Lot / Batch / GD Number */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Lot # / Batch # / GD Number
                        </label>
                        <input
                            type="text"
                            placeholder={formData.origin === "IMPORT" ? "e.g. GD-KAPE-HC-12345" : "e.g. LOT-2026-001"}
                            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                            value={formData.batchNo}
                            onChange={e => setFormData({ ...formData, batchNo: e.target.value })}
                        />
                    </div>

                    {/* Modal Actions */}
                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center gap-2 text-sm"
                        >
                            <Save size={16} />
                            {submitting ? "Saving..." : "Save Opening Stock"}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}
