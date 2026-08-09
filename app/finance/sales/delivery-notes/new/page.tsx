"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import Combobox from "@/components/Combobox";
import { useRouter } from "next/navigation";
import { 
    Save, 
    ArrowLeft, 
    Truck,
    Users,
    Calendar,
    Warehouse,
    ClipboardList,
    AlertCircle
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

export default function NewDeliveryNotePage() {
    const router = useRouter();
    const { showNotification } = useNotifications();

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Master Data
    const [orders, setOrders] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);

    // Form State
    const [formData, setFormData] = useState<any>({
        orderId: "",
        customerId: "",
        warehouseId: "",
        date: new Date().toISOString().split("T")[0],
        remarks: "",
        items: [],
    });

    useEffect(() => {
        fetchDropdowns();
    }, []);

    const fetchDropdowns = async () => {
        try {
            const [soRes, custRes, accRes, whRes, unitRes] = await Promise.all([
                authenticatedFetch("/api/finance/sales/orders?status=OPEN"),
                authenticatedFetch("/api/finance/parties/customers"),
                authenticatedFetch('/api/accounts?type=ASSET&isPosting=true'),
                authenticatedFetch("/api/inventory/warehouses"),
                authenticatedFetch("/api/inventory/units"),
            ]);

            if (soRes.ok) {
                const soData = await soRes.json();
                setOrders(soData.data || []);
            }

            const custs = custRes.ok ? (await custRes.json()).data || [] : [];
            const accs = accRes.ok ? (await accRes.json()).accounts || [] : [];
            const combined = [...custs];
            const existingIds = new Set(custs.map((c: any) => c.id));
            accs.forEach((a: any) => {
                if (!existingIds.has(a.id)) {
                    combined.push(a);
                    existingIds.add(a.id);
                }
            });

            setCustomers(combined);

            if (whRes.ok) setWarehouses((await whRes.json()).data || []);
            if (unitRes.ok) setUnits((await unitRes.json()).data || []);
        } catch (e) {
            console.error("Failed to fetch dropdowns", e);
        }
    };

    const handleSelectOrder = (id: string) => {
        const order = orders.find(o => o.id === id);
        if (!order) {
            setFormData({ ...formData, orderId: id, items: [] });
            return;
        }

        const items = order.items.map((it: any) => ({
            id: it.id,
            productId: it.productId,
            productName: it.product?.name,
            productCode: it.product?.code,
            unitId: it.unitId,
            orderItemId: it.id,
            qtyOrdered: Number(it.qty),
            qtyFulfilled: Number(it.fulfilledQty || 0),
            qtyShipped: Math.max(0, Number(it.qty) - Number(it.fulfilledQty || 0)),
        }));

        setFormData({
            ...formData,
            orderId: id,
            customerId: order.customerId,
            warehouseId: order.warehouseId || "",
            items,
        });
    };

    const handleSubmit = async () => {
        if (!formData.orderId || !formData.warehouseId) {
            showNotification('error', 'Please select Sales Order and Warehouse.');
            return;
        }

        const validItems = formData.items.filter((i: any) => i.qtyShipped > 0);
        if (validItems.length === 0) {
            showNotification('error', 'Please ship at least one item.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await authenticatedFetch("/api/finance/sales/delivery-notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, items: validItems }),
            });

            const json = await res.json();
            if (res.ok && json.success) {
                showNotification('success', 'Delivery Note created successfully!');
                router.push('/finance/sales/delivery-notes');
            } else {
                showNotification('error', json.error || "Failed to create delivery note");
            }
        } catch (error) {
            showNotification('error', 'Network error while saving Delivery Note.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const orderOptions = orders.map(o => ({
        value: o.id,
        label: `${o.orderNo} - ${o.customer?.name}`
    }));

    const customerOptions = customers.map(c => ({
        value: c.id,
        label: c.code ? `(${c.code}) ${c.name}` : c.name
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
                        <ArrowLeft size={16} /> Back to Delivery Notes
                    </button>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                        <Truck size={16} className="text-emerald-500" /> New DN
                    </div>
                </div>

                {/* Premium Dark Header Card */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl shadow-emerald-500/10 relative overflow-hidden border border-slate-800">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8">
                        <div className="col-span-12 md:col-span-4 space-y-2">
                            <h1 className="text-4xl font-black text-white tracking-tight">Delivery Note</h1>
                            <p className="text-slate-400 font-medium">Dispatch stock for Sales Order</p>
                        </div>
                        
                        <div className="col-span-12 md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-1 md:col-span-2 space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <ClipboardList size={14} /> Sales Order Reference
                                </label>
                                <Combobox
                                    options={orderOptions}
                                    value={formData.orderId}
                                    onChange={handleSelectOrder}
                                    placeholder="Search Sales Order..."
                                    className="w-full bg-slate-900/50 border-slate-700 text-white shadow-inner"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Users size={14} /> Customer Account
                                </label>
                                <Combobox
                                    options={customerOptions}
                                    value={formData.customerId}
                                    onChange={(val) => setFormData({ ...formData, customerId: val })}
                                    placeholder="Auto-filled from PO..."
                                    disabled={true}
                                    className="w-full bg-slate-900/50 border-slate-700 text-white opacity-80"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Warehouse size={14} /> Dispatch Warehouse
                                </label>
                                <select
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                    value={formData.warehouseId}
                                    onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}
                                >
                                    <option value="">Select Warehouse...</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Section */}
                {formData.orderId ? (
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                            <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Truck size={20} className="text-emerald-500" /> Items to Dispatch
                            </h2>
                        </div>

                        <div className="p-6 overflow-x-auto">
                            <div className="min-w-[800px]">
                                <div className="grid grid-cols-12 gap-4 mb-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                    <div className="col-span-5">Product</div>
                                    <div className="col-span-2">Unit</div>
                                    <div className="col-span-1 text-right">Ordered</div>
                                    <div className="col-span-1 text-right">Prev. Del</div>
                                    <div className="col-span-3">To Ship Now</div>
                                </div>

                                <div className="space-y-3">
                                    {formData.items.map((item: any, i: number) => {
                                        const remaining = item.qtyOrdered - item.qtyFulfilled;
                                        const isOver = item.qtyShipped > remaining;

                                        return (
                                            <div key={item.id} className="grid grid-cols-12 gap-4 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-all hover:border-emerald-200 dark:hover:border-emerald-500/30">
                                                <div className="col-span-5">
                                                    <div className="font-bold text-sm text-slate-900 dark:text-white">{item.productName}</div>
                                                    <div className="text-xs text-slate-500">{item.productCode}</div>
                                                </div>
                                                <div className="col-span-2">
                                                    <select
                                                        value={item.unitId}
                                                        onChange={(e) => {
                                                            const n = [...formData.items];
                                                            n[i].unitId = e.target.value;
                                                            setFormData({ ...formData, items: n });
                                                        }}
                                                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
                                                    >
                                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                    </select>
                                                </div>
                                                
                                                <div className="col-span-1 text-right font-medium text-slate-600 dark:text-slate-400">
                                                    {item.qtyOrdered}
                                                </div>
                                                
                                                <div className="col-span-1 text-right font-medium text-slate-600 dark:text-slate-400">
                                                    {item.qtyFulfilled}
                                                </div>
                                                
                                                <div className="col-span-3 pl-4">
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            value={item.qtyShipped === '' ? '' : item.qtyShipped}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                const n = [...formData.items];
                                                                n[i].qtyShipped = val === '' ? '' : parseFloat(val);
                                                                setFormData({ ...formData, items: n });
                                                            }}
                                                            className={cn(
                                                                "w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border outline-none focus:ring-2 font-bold text-sm text-right transition-colors pr-12",
                                                                isOver 
                                                                    ? "border-rose-300 dark:border-rose-500/50 focus:ring-rose-500 text-rose-600 dark:text-rose-400"
                                                                    : "border-emerald-200 dark:border-emerald-500/30 focus:ring-emerald-500 text-emerald-700 dark:text-emerald-400"
                                                            )}
                                                        />
                                                        {isOver && (
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500" title="Exceeds ordered quantity">
                                                                <AlertCircle size={16} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {formData.items.length === 0 && (
                                        <div className="text-center p-12 text-slate-400 font-bold">
                                            No items found in this Sales Order.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white/50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 p-16 text-center">
                        <ClipboardList size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">No Sales Order Selected</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                            Please select a Sales Order from the header above to load the items for dispatch.
                        </p>
                    </div>
                )}
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
                            disabled={isSubmitting || formData.items.length === 0 || !formData.orderId}
                            className={cn(
                                "flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-xl shadow-emerald-500/20 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2",
                                (isSubmitting || formData.items.length === 0 || !formData.orderId) && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <Save size={18} />
                            {isSubmitting ? 'Processing...' : 'Confirm Delivery'}
                        </button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
