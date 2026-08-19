"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import Combobox from "@/components/Combobox";
import { useRouter } from "next/navigation";
import { 
    Save, 
    ArrowLeft, 
    FileText,
    Users,
    Calendar,
    Warehouse,
    Plus,
    Trash2,
    Calculator,
    Settings2,
    ArrowUpRight
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

export default function NewSalesInvoicePage() {
    const router = useRouter();
    const { showNotification } = useNotifications();

    const [isSubmitting, setIsSubmitting] = useState(false);

    const [sources, setSources] = useState<any[]>([]);
    const [selectedSource, setSelectedSource] = useState<any>(null);
    const [customers, setCustomers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [taxCodes, setTaxCodes] = useState<any[]>([]);
    const [currency, setCurrency] = useState<{ symbol: string }>({ symbol: '$' });
    const [isDoMandatory, setIsDoMandatory] = useState(false);

    const [formData, setFormData] = useState<any>({
        sourceType: "SO", // SO | DO | DIRECT
        sourceId: "",
        customerId: "",
        warehouseId: "",
        date: new Date().toISOString().split("T")[0],
        dueDate: "",
        hasDiscount: false,
        discountAmount: 0,
        discountType: "FIXED",
        items: [],
    });

    useEffect(() => {
        fetchSettings();
        loadDropdowns();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await authenticatedFetch("/api/settings/inventory");
            const json = await res.json();
            if (json.success) {
                const mandatory = json.data.DO_MANDATORY === "true";
                setIsDoMandatory(mandatory);
                if (mandatory) {
                    setFormData((p: any) => ({ ...p, sourceType: "DO" }));
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const loadDropdowns = async () => {
        try {
            const [custRes, accRes, whRes, prodRes, unitRes, taxRes, currRes] = await Promise.all([
                authenticatedFetch("/api/finance/parties/customers"),
                authenticatedFetch('/api/accounts?type=ASSET&isPosting=true'),
                authenticatedFetch("/api/inventory/warehouses"),
                authenticatedFetch("/api/inventory/products"),
                authenticatedFetch("/api/inventory/units"),
                authenticatedFetch("/api/finance/tax"),
                authenticatedFetch("/api/finance/currency"),
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
            if (taxRes.ok) {
                const tJson = await taxRes.json();
                setTaxCodes(tJson.data || []);
            }
            if (currRes.ok) {
                const currJson = await currRes.json();
                if (currJson.success) {
                    const base = currJson.data.find((c: any) => c.isBase);
                    if (base) setCurrency({ symbol: base.symbol });
                }
            }
        } catch (e) {
            console.error("Failed to load dropdowns", e);
        }
    };

    const fetchSources = async (type: string) => {
        try {
            const endpoint =
                type === "SO"
                    ? "/api/finance/sales/orders"
                    : "/api/finance/sales/delivery-notes";

            const res = await authenticatedFetch(endpoint);
            const json = await res.json();
            if (json.success) {
                let data = json.data;
                if (type === "DO") {
                    data = data.filter((d: any) => !d.invoices || d.invoices.length === 0);
                }
                setSources(data);
            }
        } catch (e) {
            console.error("Failed to load sources", e);
        }
    };

    useEffect(() => {
        if (formData.sourceType !== "DIRECT") {
            fetchSources(formData.sourceType);
        }
    }, [formData.sourceType]);

    const handleSelectSource = (id: string) => {
        const source = sources.find((s) => s.id === id);
        if (!source) {
            setFormData({ ...formData, sourceId: id, items: [] });
            setSelectedSource(null);
            return;
        }

        setSelectedSource(source);

        let items: any[] = [];

        if (formData.sourceType === "SO") {
            items = source.items.map((item: any) => {
                const available = item.qty - (item.invoicedQty || 0);
                return {
                    id: item.id, // For tracking in UI mapping
                    productId: item.productId,
                    productName: item.product?.name,
                    productCode: item.product?.code,
                    unitId: item.unitId,
                    soItemId: item.id,
                    qtyAvailable: available,
                    qty: Math.max(0, available),
                    rate: item.rate,
                    total: available * item.rate,
                };
            });
        } else {
            items = source.items.map((item: any) => ({
                id: item.id,
                productId: item.productId,
                productName: item.product?.name,
                productCode: item.product?.code,
                unitId: item.unitId,
                doItemId: item.id,
                soItemId: item.soItemId,
                qtyAvailable: item.qty,
                qty: item.qty,
                rate: item.soItem?.rate || 0,
                total: item.qty * (item.soItem?.rate || 0),
            }));
        }

        setFormData({
            ...formData,
            sourceId: id,
            customerId: source.customerId,
            warehouseId: source.warehouseId || "",
            items,
        });
    };

    const handleAddItem = () => {
        setFormData((prev: any) => ({
            ...prev,
            items: [...prev.items, { id: Date.now().toString(), productId: "", productName: "", unitId: "", qty: 1, rate: 0, taxCodeId: "", taxRate: 0, taxAmount: 0, total: 0 }]
        }));
    };

    const handleRemoveItem = (id: string) => {
        setFormData((prev: any) => ({
            ...prev,
            items: prev.items.filter((item: any) => item.id !== id)
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

                    if (field === "productId") {
                        const prod = products.find(p => p.id === value);
                        if (prod) {
                            updatedItem.productName = prod.name;
                            updatedItem.productCode = prod.code;
                            updatedItem.rate = Number(prod.sellingPrice || 0);
                            if (prod.baseUnitId) {
                                updatedItem.unitId = prod.baseUnitId;
                            }
                        }
                    }
                    
                    if (field === "taxCodeId") {
                        const tax = taxCodes.find(t => t.id === value);
                        updatedItem.taxRate = tax ? Number(tax.rate) : 0;
                    }

                    const subtotal = Number(updatedItem.qty || 0) * Number(updatedItem.rate || 0);
                    const taxAmt = subtotal * ((updatedItem.taxRate || 0) / 100);
                    updatedItem.taxAmount = taxAmt;
                    updatedItem.total = subtotal + taxAmt;
                    
                    return updatedItem;
                }
                return item;
            });
            return { ...prev, items: newItems };
        });
    };

    const calculateTotal = () => {
        let sum = formData.items.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
        if (formData.hasDiscount) {
            sum -= Number(formData.discountAmount || 0);
        }
        return sum;
    };

    const handleSubmit = async () => {
        if (!formData.customerId) {
            showNotification('error', "Please select a Customer.");
            return;
        }

        const validItems = formData.items.filter((i: any) => i.productId && Number(i.qty) > 0);
        if (validItems.length === 0) {
            showNotification('error', "Please add at least one valid item with quantity.");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                orderId: formData.sourceType === "SO" ? formData.sourceId : undefined,
                doId: formData.sourceType === "DO" ? formData.sourceId : undefined,
                items: validItems
            };

            const res = await authenticatedFetch("/api/finance/sales/invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (res.ok && json.success) {
                showNotification('success', 'Sales Invoice created successfully!');
                router.push('/finance/sales/invoices');
            } else {
                showNotification('error', json.error || "Failed to create invoice");
            }
        } catch (error) {
            showNotification('error', 'Network error while saving invoice.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const sourceOptions = sources.map(s => ({
        value: s.id,
        label: `${formData.sourceType === "SO" ? s.orderNo : s.doNo} - ${s.customer?.name || "Unknown"} (${s.customer?.code || ""})`
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
                        <ArrowLeft size={16} /> Back to Invoices
                    </button>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                        <ArrowUpRight size={16} className="text-blue-500" /> New Bill
                    </div>
                </div>

                {/* Premium Dark Header Card */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl shadow-blue-500/10 relative overflow-hidden border border-slate-800">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8">
                        <div className="col-span-12 md:col-span-4 space-y-4">
                            <div>
                                <h1 className="text-4xl font-black text-white tracking-tight">Sales Invoice</h1>
                                <p className="text-slate-400 font-medium">Create a bill for customer</p>
                            </div>
                            
                            <div className="bg-slate-900/50 rounded-xl p-2 border border-slate-700/50 inline-flex">
                                <button
                                    onClick={() => setFormData({ ...formData, sourceType: "SO", sourceId: "", items: [] })}
                                    disabled={isDoMandatory}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                        formData.sourceType === "SO" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-white",
                                        isDoMandatory && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    From Order
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, sourceType: "DO", sourceId: "", items: [] })}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                        formData.sourceType === "DO" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-white"
                                    )}
                                >
                                    From Delivery
                                </button>
                                {!isDoMandatory && (
                                    <button
                                        onClick={() => setFormData({ ...formData, sourceType: "DIRECT", sourceId: "", items: [] })}
                                        className={cn(
                                            "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                            formData.sourceType === "DIRECT" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-white"
                                        )}
                                    >
                                        Direct
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className="col-span-12 md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {formData.sourceType !== "DIRECT" ? (
                                <div className="col-span-1 md:col-span-2 space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        <FileText size={14} /> Select {formData.sourceType === "SO" ? "Sales Order" : "Delivery Note"}
                                    </label>
                                    <Combobox
                                        options={sourceOptions}
                                        value={formData.sourceId}
                                        onChange={handleSelectSource}
                                        placeholder={`Search ${formData.sourceType}...`}
                                        className="w-full bg-slate-900/50 border-slate-700 text-white shadow-inner"
                                    />
                                </div>
                            ) : null}

                            <div className={cn("space-y-2", formData.sourceType === "DIRECT" ? "col-span-1 md:col-span-2" : "")}>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Users size={14} /> Customer Account
                                </label>
                                <Combobox
                                    options={customerOptions}
                                    value={formData.customerId}
                                    onChange={(val) => setFormData({ ...formData, customerId: val })}
                                    placeholder="Select Customer..."
                                    disabled={formData.sourceType !== "DIRECT"}
                                    className="w-full bg-slate-900/50 border-slate-700 text-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Warehouse size={14} /> Warehouse
                                </label>
                                <select
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.warehouseId}
                                    onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}
                                >
                                    <option value="">Select Warehouse...</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Calendar size={14} /> Invoice Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Calendar size={14} /> Due Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.dueDate}
                                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <Settings2 size={20} className="text-blue-500" /> Invoice Items
                        </h2>
                        {formData.sourceType === "DIRECT" && (
                            <button 
                                onClick={handleAddItem}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-sm hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                            >
                                <Plus size={16} /> Add Product
                            </button>
                        )}
                    </div>

                    <div className="p-6 overflow-x-auto">
                        <div className="min-w-[800px]">
                            <div className="grid grid-cols-12 gap-4 mb-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <div className={formData.sourceType === "DIRECT" ? "col-span-3" : "col-span-4"}>Product</div>
                                <div className="col-span-2">Unit</div>
                                {formData.sourceType !== "DIRECT" && <div className="col-span-1 text-right">Aval. Qty</div>}
                                <div className="col-span-1 text-right">Bill Qty</div>
                                <div className="col-span-1 text-right">Rate</div>
                                <div className="col-span-2 text-right">Tax</div>
                                <div className="col-span-1 text-right">Total</div>
                                {formData.sourceType === "DIRECT" && <div className="col-span-1 text-center">Act</div>}
                            </div>

                            <div className="space-y-3">
                                {formData.items.map((item: any) => (
                                    <div key={item.id} className="grid grid-cols-12 gap-4 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-all hover:border-blue-200 dark:hover:border-blue-500/30">
                                        <div className={formData.sourceType === "DIRECT" ? "col-span-4" : "col-span-5"}>
                                            {formData.sourceType === "DIRECT" ? (
                                                <select
                                                    value={item.productId}
                                                    onChange={e => updateItem(item.id, 'productId', e.target.value)}
                                                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                                                >
                                                    <option value="">Select product...</option>
                                                    {products.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div>
                                                    <div className="font-bold text-sm text-slate-900 dark:text-white">{item.productName}</div>
                                                    <div className="text-xs text-slate-500">{item.productCode}</div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-2">
                                            <select
                                                value={item.unitId}
                                                onChange={e => updateItem(item.id, 'unitId', e.target.value)}
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                                            >
                                                <option value="">Unit</option>
                                                {units.map(u => (
                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        {formData.sourceType !== "DIRECT" && (
                                            <div className="col-span-1 text-right font-medium text-slate-400">
                                                {item.qtyAvailable}
                                            </div>
                                        )}
                                        
                                        <div className="col-span-1">
                                            <input
                                                type="number"
                                                value={item.qty || ''}
                                                onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value))}
                                                max={formData.sourceType !== "DIRECT" ? item.qtyAvailable : undefined}
                                                placeholder="0"
                                                min="0"
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm text-right"
                                            />
                                        </div>
                                        
                                        <div className="col-span-1">
                                            <input
                                                type="number"
                                                value={item.rate || ''}
                                                onChange={e => updateItem(item.id, 'rate', parseFloat(e.target.value))}
                                                placeholder="0.00"
                                                min="0"
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-right"
                                            />
                                        </div>
                                        
                                        <div className="col-span-2">
                                            <select
                                                value={item.taxCodeId || ''}
                                                onChange={e => updateItem(item.id, 'taxCodeId', e.target.value)}
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                                            >
                                                <option value="">No Tax</option>
                                                {taxCodes.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-span-1 flex items-center justify-end px-2">
                                            <span className="font-black text-slate-800 dark:text-white">
                                                {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        {formData.sourceType === "DIRECT" && (
                                            <div className="col-span-1 flex justify-center">
                                                <button 
                                                    onClick={() => handleRemoveItem(item.id)}
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
                                        No items. Please add items or select a valid source.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Discount Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-6 mb-8 mt-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                Invoice Discount
                            </h2>
                            <p className="text-xs text-slate-400">Apply a document-level discount to this invoice.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={formData.hasDiscount}
                                onChange={e => setFormData({...formData, hasDiscount: e.target.checked})}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    {formData.hasDiscount && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Discount Amount</label>
                                <input
                                    type="number"
                                    value={formData.discountAmount || ''}
                                    onChange={e => setFormData({ ...formData, discountAmount: parseFloat(e.target.value) })}
                                    placeholder="0.00"
                                    min="0"
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Calculator size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bill Total</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                {currency.symbol} {calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                                "flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-xl shadow-blue-500/20 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2",
                                (isSubmitting || formData.items.length === 0) && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <Save size={18} />
                            {isSubmitting ? 'Processing...' : 'Confirm Invoice'}
                        </button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
