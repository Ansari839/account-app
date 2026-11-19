"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/api-client";
import MainLayout from "@/components/MainLayout";
import Combobox from "@/components/Combobox";
import { ArrowLeft, Save, Trash2, Plus, ArrowUpRight, Building2, Warehouse, Calendar, FileText, Settings2 } from "lucide-react";
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

export default function CreatePurchaseReturnPage() {
    const router = useRouter();
    const { showNotification } = useNotifications();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Master Data
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        supplierId: "",
        warehouseId: "",
        date: new Date().toISOString().split('T')[0],
        remarks: "",
        items: [] as any[]
    });

    useEffect(() => {
        fetchMasterData();
    }, []);

    const fetchMasterData = async () => {
        try {
            const [supRes, accRes, whRes, prodRes, unitRes] = await Promise.all([
                authenticatedFetch("/api/finance/parties/suppliers"),
                authenticatedFetch('/api/accounts?type=LIABILITY&isPosting=true'),
                authenticatedFetch("/api/inventory/warehouses"),
                authenticatedFetch("/api/inventory/products"),
                authenticatedFetch("/api/inventory/units")
            ]);

            const sups = supRes.ok ? (await supRes.json()).data || [] : [];
            const accs = accRes.ok ? (await accRes.json()).accounts || [] : [];
            const combined = [...sups];
            const existingIds = new Set(sups.map((s: any) => s.id));
            accs.forEach((a: any) => {
                if (!existingIds.has(a.id)) {
                    combined.push(a);
                    existingIds.add(a.id);
                }
            });

            setSuppliers(combined);

            if (whRes.ok) setWarehouses((await whRes.json()).data || []);
            
            if (prodRes.ok) {
                const json = await prodRes.json();
                if (Array.isArray(json.data)) {
                    setProducts(json.data);
                } else if (json.data && Array.isArray(json.data.products)) {
                    setProducts(json.data.products);
                } else {
                    setProducts(json.data || []);
                }
            }

            if (unitRes.ok) setUnits((await unitRes.json()).data || []);
        } catch (error) {
            console.error("Failed to fetch master data", error);
        }
    };

    const handleItemChange = (id: string, field: string, value: any) => {
        setFormData((prev: any) => {
            const newItems = prev.items.map((item: any) => {
                if (item.id === id) {
                    let refinedValue = value;
                    if (field === "qty" || field === "rate") {
                        refinedValue = isNaN(value) ? 0 : value;
                    }
                    const updatedItem = { ...item, [field]: refinedValue };

                    if (field === 'productId') {
                        const product = products.find(p => p.id === value);
                        if (product) {
                            updatedItem.rate = Number(product.purchasePrice || product.costPrice || 0);
                            if (product.baseUnitId) {
                                updatedItem.unitId = product.baseUnitId;
                            }
                        }
                    }

                    updatedItem.total = Number(updatedItem.qty || 0) * Number(updatedItem.rate || 0);
                    return updatedItem;
                }
                return item;
            });
            return { ...prev, items: newItems };
        });
    };

    const addItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { id: Date.now().toString(), productId: "", unitId: "", qty: 1, rate: 0, total: 0 }]
        }));
    };

    const removeItem = (id: string) => {
        setFormData(prev => ({ ...prev, items: prev.items.filter((item: any) => item.id !== id) }));
    };

    const calculateTotal = () => {
        return formData.items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    };

    const handleSubmit = async () => {
        if (!formData.supplierId) {
            showNotification('error', "Please select a Supplier/Account.");
            return;
        }
        if (!formData.warehouseId) {
            showNotification('error', "Please select a Warehouse.");
            return;
        }

        const validItems = formData.items.filter(i => i.productId && i.qty > 0);
        if (validItems.length === 0) {
            showNotification('error', "Please add at least one valid item.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await authenticatedFetch("/api/finance/purchase/returns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    supplierId: formData.supplierId,
                    warehouseId: formData.warehouseId,
                    date: formData.date,
                    remarks: formData.remarks,
                    items: validItems.map(i => ({
                        productId: i.productId,
                        qty: Number(i.qty),
                        rate: Number(i.rate)
                    }))
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                showNotification('success', 'Purchase Return / Debit Note created successfully!');
                router.push(`/finance/purchase/returns/${json.data.id}`);
            } else {
                showNotification('error', json.error || "Failed to create return");
            }
        } catch (error) {
            showNotification('error', "An error occurred while saving the return.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const supplierOptions = suppliers.map(s => ({
        value: s.id,
        label: s.code ? `(${s.code}) ${s.name}` : s.name
    }));

    const warehouseOptions = warehouses.map(w => ({
        value: w.id,
        label: w.name
    }));

    const productOptions = products.map(p => ({
        value: p.id,
        label: `${p.name} (${p.code})`,
        sublabel: p.category?.name ? `Category: ${p.category.name}` : undefined
    }));

    const unitOptions = units.map(u => ({
        value: u.id,
        label: u.name
    }));

    return (
        <MainLayout>
            <div className="max-w-[98%] 2xl:max-w-[1700px] mx-auto px-2 sm:px-4 space-y-6 pb-32 animate-in fade-in duration-500">
                {/* Header Action Bar */}
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors font-bold text-sm"
                    >
                        <ArrowLeft size={16} /> Back to Returns
                    </button>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                        <ArrowUpRight size={16} className="text-rose-500" /> New Debit Note
                    </div>
                </div>

                {/* Premium Dark Header Card */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl shadow-rose-500/10 relative border border-slate-800 z-20">
                    <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    </div>
                    
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8">
                        <div className="col-span-12 md:col-span-4 space-y-2">
                            <h1 className="text-4xl font-black text-white tracking-tight">Purchase Return</h1>
                            <p className="text-slate-400 font-medium">Issue a Debit Note to supplier</p>
                        </div>
                        
                        <div className="col-span-12 md:col-span-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="lg:col-span-2 space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Building2 size={14} /> Supplier Account
                                </label>
                                <Combobox
                                    options={supplierOptions}
                                    value={formData.supplierId}
                                    onChange={(val) => setFormData({ ...formData, supplierId: val })}
                                    placeholder="Select supplier..."
                                    className="w-full bg-slate-900/60 border-slate-700 text-white"
                                />
                            </div>

                            <div className="lg:col-span-2 space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Warehouse size={14} /> From Warehouse
                                </label>
                                <Combobox
                                    options={warehouseOptions}
                                    value={formData.warehouseId}
                                    onChange={(val) => setFormData({ ...formData, warehouseId: val })}
                                    placeholder="Choose Warehouse..."
                                    className="w-full bg-slate-900/60 border-slate-700 text-white"
                                />
                            </div>

                            <div className="lg:col-span-2 space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Calendar size={14} /> Return Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-rose-500"
                                />
                            </div>

                            <div className="lg:col-span-4 space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <FileText size={14} /> Reason / Remarks
                                </label>
                                <textarea
                                    value={formData.remarks}
                                    onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                                    rows={1}
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                                    placeholder="Enter reason for return..."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <Settings2 size={20} className="text-rose-500" /> Return Items
                        </h2>
                        <button 
                            onClick={addItem}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-sm hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
                        >
                            <Plus size={16} /> Add Product
                        </button>
                    </div>

                    <div className="p-6 overflow-x-auto">
                        <div className="min-w-[800px]">
                            <div className="grid grid-cols-12 gap-4 mb-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <div className="col-span-4">Product</div>
                                <div className="col-span-2">Unit</div>
                                <div className="col-span-2">Return Qty</div>
                                <div className="col-span-2">Rate</div>
                                <div className="col-span-1 text-right">Total</div>
                                <div className="col-span-1 text-center">Act</div>
                            </div>

                            <div className="space-y-3">
                                {formData.items.map((item: any) => (
                                    <div key={item.id} className="grid grid-cols-12 gap-4 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-all hover:border-rose-200 dark:hover:border-rose-500/30">
                                        <div className="col-span-4">
                                            <Combobox
                                                options={productOptions}
                                                value={item.productId}
                                                onChange={val => handleItemChange(item.id, 'productId', val)}
                                                placeholder="Select product..."
                                                size="sm"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <Combobox
                                                options={unitOptions}
                                                value={item.unitId}
                                                onChange={val => handleItemChange(item.id, 'unitId', val)}
                                                placeholder="Unit"
                                                size="sm"
                                            />
                                        </div>
                                        
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                value={item.qty || ''}
                                                onChange={e => handleItemChange(item.id, 'qty', parseFloat(e.target.value))}
                                                placeholder="0"
                                                min="0"
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 outline-none focus:ring-2 focus:ring-rose-500 font-bold text-sm text-right"
                                            />
                                        </div>
                                        
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                value={item.rate || ''}
                                                onChange={e => handleItemChange(item.id, 'rate', parseFloat(e.target.value))}
                                                placeholder="0.00"
                                                min="0"
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium text-right"
                                            />
                                        </div>

                                        <div className="col-span-1 flex items-center justify-end px-2">
                                            <span className="font-black text-slate-800 dark:text-white">
                                                {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        <div className="col-span-1 flex justify-center">
                                            <button 
                                                onClick={() => removeItem(item.id)}
                                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {formData.items.length === 0 && (
                                    <div className="text-center p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 font-bold">
                                        No items. Please add items to return.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-[98%] 2xl:max-w-[1700px] mx-auto px-2 sm:px-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
                            <ArrowUpRight size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Return Value</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                $ {calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <button 
                            onClick={() => router.back()}
                            className="flex-1 md:flex-none px-6 py-4 rounded-2xl font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors uppercase tracking-widest text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={isSubmitting || formData.items.length === 0}
                            className={cn(
                                "flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-white bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 shadow-xl shadow-rose-500/20 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2",
                                (isSubmitting || formData.items.length === 0) && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <Save size={18} />
                            {isSubmitting ? 'Processing...' : 'Confirm Return'}
                        </button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
