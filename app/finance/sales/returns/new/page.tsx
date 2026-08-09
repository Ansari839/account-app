"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/api-client";
import MainLayout from "@/components/MainLayout";
import Combobox from "@/components/Combobox";
import { 
    Save, 
    ArrowLeft, 
    Undo2,
    Users,
    Calendar,
    Warehouse,
    Plus,
    Trash2,
    Calculator,
    AlertCircle
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

export default function CreateSalesReturnPage() {
    const router = useRouter();
    const { showNotification } = useNotifications();
    const [loading, setLoading] = useState(false);

    // Master Data
    const [customers, setCustomers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        customerId: "",
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
            const [custRes, accRes, whRes, prodRes] = await Promise.all([
                authenticatedFetch("/api/finance/parties/customers"),
                authenticatedFetch('/api/accounts?type=ASSET&isPosting=true'),
                authenticatedFetch("/api/inventory/warehouses"),
                authenticatedFetch("/api/inventory/products")
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

            setCustomers(combined);

            if (whRes.ok) {
                const json = await whRes.json();
                setWarehouses(json.data || []);
            }

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
        } catch (error) {
            console.error("Failed to fetch master data", error);
        }
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        const item = { ...newItems[index], [field]: value };

        if (field === 'productId') {
            const product = products.find(p => p.id === value);
            if (product) {
                item.rate = Number(product.sellingPrice || product.salePrice || 0);
            }
        }

        item.total = Number(item.qty || 0) * Number(item.rate || 0);
        newItems[index] = item;
        setFormData({ ...formData, items: newItems });
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { id: Date.now().toString(), productId: "", qty: 1, rate: 0, total: 0 }]
        });
    };

    const removeItem = (index: number) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const handleSubmit = async () => {
        if (!formData.customerId || !formData.warehouseId) {
            showNotification('error', "Please select Customer and Warehouse");
            return;
        }

        const validItems = formData.items.filter(i => i.productId && Number(i.qty) > 0);
        if (validItems.length === 0) {
            showNotification('error', "Please add at least one valid item.");
            return;
        }

        setLoading(true);
        try {
            const res = await authenticatedFetch("/api/finance/sales/returns", {
                method: "POST",
                body: JSON.stringify({
                    customerId: formData.customerId,
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
            if (json.success) {
                showNotification('success', 'Sales Return created successfully!');
                router.push(`/finance/sales/returns/${json.data.id}`);
            } else {
                showNotification('error', json.error || "Failed to create return");
            }
        } catch (error) {
            showNotification('error', "An network error occurred");
        } finally {
            setLoading(false);
        }
    };

    const totalReturnAmount = formData.items.reduce((acc, item) => acc + (Number(item.qty || 0) * Number(item.rate || 0)), 0);

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
                        <ArrowLeft size={16} /> Back to Returns
                    </button>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                        <Undo2 size={16} className="text-rose-500" /> New Return
                    </div>
                </div>

                {/* Premium Dark Header Card (Rose themed for Return) */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl shadow-rose-500/10 relative overflow-hidden border border-slate-800">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8">
                        <div className="col-span-12 md:col-span-4 space-y-2">
                            <h1 className="text-4xl font-black text-white tracking-tight">Sales Return</h1>
                            <p className="text-slate-400 font-medium">Issue credit note & return stock</p>
                            <div className="inline-flex items-center gap-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-lg text-xs font-bold mt-4">
                                <AlertCircle size={14} /> Reverts Revenue & Increases Stock
                            </div>
                        </div>
                        
                        <div className="col-span-12 md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-1 md:col-span-2 space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Users size={14} /> Customer Account
                                </label>
                                <Combobox
                                    options={customerOptions}
                                    value={formData.customerId}
                                    onChange={(val) => setFormData({ ...formData, customerId: val })}
                                    placeholder="Select Customer..."
                                    className="w-full bg-slate-900/50 border-slate-700 text-white shadow-inner"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Warehouse size={14} /> Receiving Warehouse
                                </label>
                                <select
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-rose-500"
                                    value={formData.warehouseId}
                                    onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}
                                >
                                    <option value="">Select Warehouse...</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
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
                            
                            <div className="col-span-1 md:col-span-2 space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    Remarks / Reason
                                </label>
                                <input
                                    type="text"
                                    value={formData.remarks}
                                    onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                                    placeholder="e.g. Defective items, wrong dispatch..."
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-rose-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <Undo2 size={20} className="text-rose-500" /> Returned Items
                        </h2>
                        <button 
                            onClick={addItem}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-sm hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
                        >
                            <Plus size={16} /> Add Item
                        </button>
                    </div>

                    <div className="p-6 overflow-x-auto">
                        <div className="min-w-[800px]">
                            <div className="grid grid-cols-12 gap-4 mb-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <div className="col-span-5">Product</div>
                                <div className="col-span-2 text-right">Qty Returned</div>
                                <div className="col-span-2 text-right">Return Rate</div>
                                <div className="col-span-2 text-right">Total</div>
                                <div className="col-span-1 text-center">Act</div>
                            </div>

                            <div className="space-y-3">
                                {formData.items.map((item: any, i: number) => (
                                    <div key={item.id || i} className="grid grid-cols-12 gap-4 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-all hover:border-rose-200 dark:hover:border-rose-500/30">
                                        <div className="col-span-5">
                                            <select
                                                value={item.productId}
                                                onChange={e => handleItemChange(i, 'productId', e.target.value)}
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium"
                                            >
                                                <option value="">Select product...</option>
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                value={item.qty || ''}
                                                onChange={e => handleItemChange(i, 'qty', e.target.value)}
                                                placeholder="0"
                                                min="0"
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 outline-none focus:ring-2 focus:ring-rose-500 font-bold text-sm text-right"
                                            />
                                        </div>
                                        
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                value={item.rate || ''}
                                                onChange={e => handleItemChange(i, 'rate', e.target.value)}
                                                placeholder="0.00"
                                                min="0"
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium text-right"
                                            />
                                        </div>

                                        <div className="col-span-2 flex items-center justify-end px-2">
                                            <span className="font-black text-slate-800 dark:text-white">
                                                {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        <div className="col-span-1 flex justify-center">
                                            <button 
                                                onClick={() => removeItem(i)}
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
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
                            <Calculator size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Credit</p>
                            <p className="text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                                $ {totalReturnAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                            disabled={loading || formData.items.length === 0 || totalReturnAmount <= 0}
                            className={cn(
                                "flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-white bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 shadow-xl shadow-rose-500/20 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2",
                                (loading || formData.items.length === 0 || totalReturnAmount <= 0) && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <Save size={18} />
                            {loading ? 'Processing...' : 'Confirm Return'}
                        </button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
