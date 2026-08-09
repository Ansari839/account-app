"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import Combobox from '@/components/Combobox';
import { useRouter } from 'next/navigation';
import { 
    Save, 
    ArrowLeft, 
    Plus, 
    Trash2, 
    PackageOpen,
    Building2,
    Calendar,
    Warehouse,
    FileText,
    CheckCircle2
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

export default function NewGRNPage() {
    const router = useRouter();
    const { showNotification } = useNotifications();

    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Master Data
    const [pos, setPos] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [selectedPO, setSelectedPO] = useState<any>(null);

    // Form Data
    const [formData, setFormData] = useState<any>({
        poId: '',
        supplierId: '',
        warehouseId: '',
        date: new Date().toISOString().split('T')[0],
        items: []
    });

    useEffect(() => {
        fetchDropdowns();
        fetchOpenPOs();
    }, []);

    const fetchDropdowns = async () => {
        try {
            const [supRes, accRes, whRes, prodRes, unitRes] = await Promise.all([
                authenticatedFetch('/api/finance/parties/suppliers'),
                authenticatedFetch('/api/accounts?type=LIABILITY&isPosting=true'),
                authenticatedFetch('/api/inventory/warehouses'),
                authenticatedFetch('/api/inventory/products'),
                authenticatedFetch('/api/inventory/units'),
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

            if (supRes.ok) setSuppliers(combined);
            if (whRes.ok) setWarehouses((await whRes.json()).data || []);
            if (prodRes.ok) setProducts((await prodRes.json()).data || []);
            if (unitRes.ok) setUnits((await unitRes.json()).data || []);
        } catch (e) {
            console.error("Failed to load dropdowns", e);
        }
    };

    const fetchOpenPOs = async () => {
        try {
            const res = await authenticatedFetch('/api/finance/purchase/orders?status=OPEN');
            const json = await res.json();
            if (json.success) setPos(json.data);
        } catch (e) { console.error(e); }
    };

    const handleSelectPO = (poId: string) => {
        const po = pos.find(p => p.id === poId);
        if (!po) {
            setSelectedPO(null);
            setFormData({
                ...formData,
                poId: '',
                supplierId: '',
                items: []
            });
            return;
        }

        setSelectedPO(po);
        setFormData({
            ...formData,
            poId: po.id,
            supplierId: po.supplierId,
            warehouseId: po.warehouseId || formData.warehouseId,
            items: po.items.map((item: any) => ({
                id: Date.now().toString() + Math.random(),
                productId: item.productId,
                productName: item.product?.name,
                unitId: item.unitId,
                poItemId: item.id,
                qtyOrdered: item.qty,
                qtyReceivedPrior: item.receivedQty || 0,
                qtyReceived: Math.max(0, item.qty - (item.receivedQty || 0)), 
                qtyRejected: 0,
                rate: item.rate
            }))
        });
    };

    const addItem = () => {
        setFormData((prev: any) => ({
            ...prev,
            items: [...prev.items, { id: Date.now().toString(), productId: '', unitId: '', qtyReceived: 1, qtyRejected: 0, rate: 0 }]
        }));
    };

    const updateItem = (id: string, field: string, value: any) => {
        setFormData((prev: any) => {
            const newItems = prev.items.map((item: any) => {
                if (item.id === id) {
                    let refinedValue = value;
                    if (field === "qtyReceived" || field === "qtyRejected" || field === "rate") {
                        refinedValue = isNaN(value) ? 0 : value;
                    }
                    return { ...item, [field]: refinedValue };
                }
                return item;
            });
            return { ...prev, items: newItems };
        });
    };

    const removeItem = (id: string) => {
        setFormData((prev: any) => ({
            ...prev,
            items: prev.items.filter((item: any) => item.id !== id)
        }));
    };

    const handleSubmit = async () => {
        if (!formData.warehouseId) {
            showNotification('error', 'Please select a Warehouse.');
            return;
        }
        
        if (!formData.poId && !formData.supplierId) {
            showNotification('error', 'Please select a Supplier or a Purchase Order.');
            return;
        }

        const validItems = formData.items.filter((i: any) => i.productId && (Number(i.qtyReceived) > 0 || Number(i.qtyRejected) > 0));
        if (validItems.length === 0) {
            showNotification('error', 'Please add at least one valid item with received/rejected quantity.');
            return;
        }

        // Over-fulfillment check
        const overFullfilled = formData.items.some((it: any) => it.qtyReceived > (it.qtyOrdered - (it.qtyReceivedPrior || 0)));
        if (overFullfilled) {
            if (!confirm("Received quantity exceeds PO order. An 'Addendum PO' will be automatically created for the excess. Proceed?")) {
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const res = await authenticatedFetch('/api/finance/purchase/grn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, items: validItems })
            });

            if (res.ok) {
                showNotification('success', 'GRN created successfully!');
                router.push('/finance/purchase/grn');
            } else {
                const json = await res.json();
                showNotification('error', json.error || 'Failed to create GRN.');
            }
        } catch (error) {
            showNotification('error', 'Network error while saving GRN.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const supplierOptions = suppliers.map(s => ({
        value: s.id,
        label: `${s.code} - ${s.name}`
    }));

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto space-y-6 pb-32 animate-in fade-in duration-500">
                {/* Header Action Bar */}
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors font-bold text-sm"
                    >
                        <ArrowLeft size={16} /> Back to Receipts
                    </button>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                        <CheckCircle2 size={16} className="text-emerald-500" /> New Receipt
                    </div>
                </div>

                {/* Premium Dark Header Card */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl shadow-indigo-500/10 relative overflow-hidden border border-slate-800">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8">
                        <div className="col-span-12 md:col-span-4 space-y-2">
                            <h1 className="text-4xl font-black text-white tracking-tight">New GRN</h1>
                            <p className="text-slate-400 font-medium">Record items received in warehouse</p>
                        </div>
                        
                        <div className="col-span-12 md:col-span-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="lg:col-span-2 space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <FileText size={14} /> Link Purchase Order
                                </label>
                                <select
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={formData.poId}
                                    onChange={(e) => handleSelectPO(e.target.value)}
                                >
                                    <option value="">Direct GRN (No PO)</option>
                                    {pos.map(p => <option key={p.id} value={p.id}>{p.poNo} - {p.supplier?.name}</option>)}
                                </select>
                            </div>
                            
                            {!formData.poId && (
                                <div className="lg:col-span-2 space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        <Building2 size={14} /> Supplier Account
                                    </label>
                                    <Combobox
                                        options={supplierOptions}
                                        value={formData.supplierId}
                                        onChange={(val) => setFormData({ ...formData, supplierId: val })}
                                        placeholder="Select supplier..."
                                        className="w-full bg-slate-900/50 border-slate-700 text-white"
                                    />
                                </div>
                            )}

                            <div className="lg:col-span-2 space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Warehouse size={14} /> Target Warehouse
                                </label>
                                <select
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                    value={formData.warehouseId}
                                    onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}
                                >
                                    <option value="">Choose Warehouse...</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>

                            {!selectedPO && (
                                <div className="lg:col-span-2 space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        <Calendar size={14} /> Received Date
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Items Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <PackageOpen size={20} className="text-indigo-500" /> Receiving Items
                        </h2>
                        {!formData.poId && (
                            <button 
                                onClick={addItem}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                            >
                                <Plus size={16} /> Add Product
                            </button>
                        )}
                    </div>

                    <div className="p-6 overflow-x-auto">
                        <div className="min-w-[800px]">
                            <div className="grid grid-cols-12 gap-4 mb-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <div className="col-span-4">Product</div>
                                <div className="col-span-2">Unit</div>
                                {formData.poId && <div className="col-span-2">Ordered / Prior</div>}
                                <div className={formData.poId ? "col-span-2" : "col-span-2"}>Receive Qty</div>
                                <div className="col-span-1">Reject Qty</div>
                                {!formData.poId && <div className="col-span-2">Rate</div>}
                                {!formData.poId && <div className="col-span-1 text-center">Act</div>}
                            </div>

                            <div className="space-y-3">
                                {formData.items.map((item: any, index: number) => (
                                    <div key={item.id} className={cn(
                                        "grid grid-cols-12 gap-4 items-center p-3 rounded-2xl border transition-all",
                                        item.qtyReceived > 0 
                                            ? "bg-indigo-50/30 dark:bg-indigo-500/5 border-indigo-100 dark:border-indigo-500/20" 
                                            : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50"
                                    )}>
                                        <div className="col-span-4">
                                            {formData.poId ? (
                                                <div className="px-2 font-bold text-slate-800 dark:text-slate-200">
                                                    {item.productName}
                                                </div>
                                            ) : (
                                                <select
                                                    value={item.productId}
                                                    onChange={e => updateItem(item.id, 'productId', e.target.value)}
                                                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                                >
                                                    <option value="">Select product...</option>
                                                    {products.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                        <div className="col-span-2">
                                            <select
                                                value={item.unitId}
                                                onChange={e => updateItem(item.id, 'unitId', e.target.value)}
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                            >
                                                <option value="">Unit</option>
                                                {units.map(u => (
                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        {formData.poId && (
                                            <div className="col-span-2 flex items-center gap-2 px-2 text-sm">
                                                <span className="font-bold text-slate-700 dark:text-slate-300">{item.qtyOrdered}</span>
                                                <span className="text-slate-400">/</span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{item.qtyReceivedPrior}</span>
                                            </div>
                                        )}

                                        <div className={formData.poId ? "col-span-2" : "col-span-2"}>
                                            <input
                                                type="number"
                                                value={item.qtyReceived || ''}
                                                onChange={e => updateItem(item.id, 'qtyReceived', parseFloat(e.target.value))}
                                                placeholder="0"
                                                min="0"
                                                max={formData.poId ? (item.qtyOrdered - item.qtyReceivedPrior) : undefined}
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                                            />
                                        </div>
                                        
                                        <div className="col-span-1">
                                            <input
                                                type="number"
                                                value={item.qtyRejected || ''}
                                                onChange={e => updateItem(item.id, 'qtyRejected', parseFloat(e.target.value))}
                                                placeholder="0"
                                                min="0"
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 outline-none focus:ring-2 focus:ring-rose-500 font-bold text-sm"
                                            />
                                        </div>

                                        {!formData.poId && (
                                            <div className="col-span-2">
                                                <input
                                                    type="number"
                                                    value={item.rate || ''}
                                                    onChange={e => updateItem(item.id, 'rate', parseFloat(e.target.value))}
                                                    placeholder="0.00"
                                                    min="0"
                                                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                                />
                                            </div>
                                        )}

                                        {!formData.poId && (
                                            <div className="col-span-1 flex justify-center">
                                                <button 
                                                    onClick={() => removeItem(item.id)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {formData.items.length === 0 && (
                                    <div className="text-center p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 font-bold">
                                        No items to receive.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-end gap-4">
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
                                "flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-xl shadow-emerald-500/20 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2",
                                (isSubmitting || formData.items.length === 0) && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <Save size={18} />
                            {isSubmitting ? 'Saving...' : 'Confirm Receipt'}
                        </button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
