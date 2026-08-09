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
    ShoppingCart,
    Users,
    Calendar,
    Warehouse,
    Calculator,
    CheckCircle2
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

export default function NewSalesOrderPage() {
    const router = useRouter();
    const { showNotification } = useNotifications();

    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Master Data
    const [customers, setCustomers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);

    // Form Data
    const [formData, setFormData] = useState<any>({
        customerId: '',
        warehouseId: '',
        date: new Date().toISOString().split('T')[0],
        expectedDate: '',
        items: []
    });

    useEffect(() => {
        fetchDropdowns();
    }, []);

    const fetchDropdowns = async () => {
        try {
            const [custRes, accRes, whRes, prodRes, unitRes] = await Promise.all([
                authenticatedFetch('/api/finance/parties/customers'),
                authenticatedFetch('/api/accounts?type=ASSET&isPosting=true'),
                authenticatedFetch('/api/inventory/warehouses'),
                authenticatedFetch('/api/inventory/products'),
                authenticatedFetch('/api/inventory/units'),
            ]);

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

            if (custRes.ok) setCustomers(combined);
            if (whRes.ok) setWarehouses((await whRes.json()).data || []);
            if (prodRes.ok) {
                const pJson = await prodRes.json();
                setProducts(pJson.data || (pJson.products ? pJson.products : []));
            }
            if (unitRes.ok) setUnits((await unitRes.json()).data || []);
        } catch (e) {
            console.error("Failed to load dropdowns", e);
        }
    };

    const addItem = () => {
        setFormData((prev: any) => ({
            ...prev,
            items: [...prev.items, { id: Date.now().toString(), productId: '', unitId: '', qty: 1, rate: 0, total: 0 }]
        }));
    };

    const updateItem = (id: string, field: string, value: any) => {
        setFormData((prev: any) => {
            const newItems = prev.items.map((item: any) => {
                if (item.id === id) {
                    let refinedValue = value;
                    if (field === "qty" || field === "rate") {
                        refinedValue = isNaN(value) ? 0 : value;
                    }
                    
                    const updatedItem = { ...item, [field]: refinedValue };

                    if (field === 'productId') {
                        const prod = products.find(p => p.id === value);
                        if (prod) {
                            updatedItem.rate = Number(prod.sellingPrice || 0);
                            if (prod.baseUnitId) {
                                updatedItem.unitId = prod.baseUnitId;
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

    const removeItem = (id: string) => {
        setFormData((prev: any) => ({
            ...prev,
            items: prev.items.filter((item: any) => item.id !== id)
        }));
    };

    const calculateTotal = () => {
        return formData.items.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
    };

    const handleSubmit = async () => {
        if (!formData.customerId) {
            showNotification('error', 'Please select a Customer.');
            return;
        }

        const validItems = formData.items.filter((i: any) => i.productId && Number(i.qty) > 0);
        if (validItems.length === 0) {
            showNotification('error', 'Please add at least one valid item with quantity.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await authenticatedFetch('/api/finance/sales/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, items: validItems })
            });

            if (res.ok) {
                showNotification('success', 'Sales Order created successfully!');
                router.push('/finance/sales/orders');
            } else {
                const json = await res.json();
                showNotification('error', json.error || 'Failed to create Sales Order.');
            }
        } catch (error) {
            showNotification('error', 'Network error while saving order.');
        } finally {
            setIsSubmitting(false);
        }
    };

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
                        <ArrowLeft size={16} /> Back to Orders
                    </button>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                        <CheckCircle2 size={16} className="text-emerald-500" /> New SO
                    </div>
                </div>

                {/* Premium Dark Header Card */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl shadow-indigo-500/10 relative overflow-hidden border border-slate-800">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8">
                        <div className="col-span-12 md:col-span-4 space-y-2">
                            <h1 className="text-4xl font-black text-white tracking-tight">New Order</h1>
                            <p className="text-slate-400 font-medium">Create a Sales Order for customer</p>
                        </div>
                        
                        <div className="col-span-12 md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Users size={14} /> Customer
                                </label>
                                <Combobox
                                    options={customerOptions}
                                    value={formData.customerId}
                                    onChange={(val) => setFormData({ ...formData, customerId: val })}
                                    placeholder="Select customer..."
                                    className="w-full bg-slate-900/50 border-slate-700 text-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Warehouse size={14} /> Fulfill From Warehouse
                                </label>
                                <select
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={formData.warehouseId}
                                    onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}
                                >
                                    <option value="">Default Warehouse (Optional)</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Calendar size={14} /> Order Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Calendar size={14} /> Expected Delivery Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.expectedDate}
                                    onChange={e => setFormData({ ...formData, expectedDate: e.target.value })}
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <ShoppingCart size={20} className="text-indigo-500" /> Order Items
                        </h2>
                        <button 
                            onClick={addItem}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                        >
                            <Plus size={16} /> Add Product
                        </button>
                    </div>

                    <div className="p-6 overflow-x-auto">
                        <div className="min-w-[800px]">
                            <div className="grid grid-cols-12 gap-4 mb-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <div className="col-span-4">Product</div>
                                <div className="col-span-2">Unit</div>
                                <div className="col-span-2">Quantity</div>
                                <div className="col-span-2">Rate</div>
                                <div className="col-span-1 text-right">Total</div>
                                <div className="col-span-1 text-center">Act</div>
                            </div>

                            <div className="space-y-3">
                                {formData.items.map((item: any) => (
                                    <div key={item.id} className="grid grid-cols-12 gap-4 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-all hover:border-indigo-200 dark:hover:border-indigo-500/30">
                                        <div className="col-span-4">
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
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                value={item.qty || ''}
                                                onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value))}
                                                placeholder="1"
                                                min="0"
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm text-right"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                value={item.rate || ''}
                                                onChange={e => updateItem(item.id, 'rate', parseFloat(e.target.value))}
                                                placeholder="0.00"
                                                min="0"
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-right"
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
                                        No items. Please add items to the order.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Calculator size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Order Total</p>
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
                                "flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-xl shadow-indigo-500/20 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2",
                                (isSubmitting || formData.items.length === 0) && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <Save size={18} />
                            {isSubmitting ? 'Saving...' : 'Create Order'}
                        </button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
