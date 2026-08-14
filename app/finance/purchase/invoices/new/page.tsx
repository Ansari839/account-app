"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import Combobox from "@/components/Combobox";
import { useRouter } from "next/navigation";
import { 
    Save, 
    ArrowLeft, 
    Plus, 
    Trash2, 
    Receipt,
    Building2,
    Calendar,
    Warehouse,
    Calculator,
    CheckCircle2,
    Settings2,
    FileText,
    Truck
} from "lucide-react";
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

export default function NewPurchaseInvoicePage() {
    const router = useRouter();
    const { showNotification } = useNotifications();

    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Master Data
    const [sources, setSources] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [taxCodes, setTaxCodes] = useState<any[]>([]);
    const [isGrnMandatory, setIsGrnMandatory] = useState(false);

    // Form Data
    const [formData, setFormData] = useState<any>({
        sourceType: "PO", // PO | GRN | DIRECT
        sourceId: "",
        supplierId: "",
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
        fetchDropdowns();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await authenticatedFetch("/api/settings/inventory");
            const json = await res.json();
            if (json.success) {
                const mandatory = json.data.INVENTORY_GRN_MANDATORY === "true";
                setIsGrnMandatory(mandatory);
                if (mandatory) {
                    setFormData((p: any) => ({ ...p, sourceType: "GRN" }));
                }
            }
        } catch (e) { console.error(e); }
    };

    const fetchDropdowns = async () => {
        try {
            const [supRes, accRes, whRes, prodRes, unitRes, taxRes] = await Promise.all([
                authenticatedFetch("/api/finance/parties/suppliers"),
                authenticatedFetch('/api/accounts?isPosting=true'),
                authenticatedFetch("/api/inventory/warehouses"),
                authenticatedFetch("/api/inventory/products"),
                authenticatedFetch("/api/inventory/units"),
                authenticatedFetch("/api/finance/tax"),
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
            if (prodRes.ok) setProducts((await prodRes.json()).data || []);
            if (unitRes.ok) setUnits((await unitRes.json()).data || []);
            if (taxRes.ok) {
                const tJson = await taxRes.json();
                setTaxCodes(tJson.data || []);
            }
        } catch (e) { console.error(e); }
    };

    const fetchSources = async (type: string) => {
        try {
            const endpoint = type === "PO"
                ? "/api/finance/purchase/orders?status=OPEN"
                : "/api/finance/purchase/grn";
            const res = await authenticatedFetch(endpoint);
            const json = await res.json();
            if (json.success) {
                let data = json.data;
                if (type === "GRN") {
                    data = data.filter((g: any) => !g.invoices || g.invoices.length === 0);
                }
                setSources(data);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (formData.sourceType !== "DIRECT") {
            fetchSources(formData.sourceType);
        } else {
            setSources([]);
            setFormData((prev: any) => ({ ...prev, sourceId: '', items: [] }));
        }
    }, [formData.sourceType]);

    const handleSelectSource = (id: string) => {
        const source = sources.find((s) => s.id === id);
        if (!source) {
            setFormData((prev: any) => ({ ...prev, sourceId: '', items: [] }));
            return;
        }

        let items: any[] = [];
        if (formData.sourceType === "PO") {
            items = source.items.map((item: any) => {
                const available = item.qty - (item.invoicedQty || 0);
                return {
                    id: Date.now().toString() + Math.random(),
                    productId: item.productId,
                    productName: item.product?.name,
                    unitId: item.unitId,
                    poItemId: item.id,
                    qtyAvailable: available,
                    qty: Math.max(0, available),
                    rate: item.rate,
                    total: available * item.rate,
                };
            });
        } else {
            items = source.items.map((item: any) => ({
                id: Date.now().toString() + Math.random(),
                productId: item.productId,
                productName: item.product?.name,
                unitId: item.unitId,
                grnItemId: item.id,
                poItemId: item.poItemId,
                qtyAvailable: item.qtyReceived,
                qty: item.qtyReceived,
                rate: item.poItem?.rate || 0,
                total: item.qtyReceived * (item.poItem?.rate || 0),
            }));
        }

        setFormData({
            ...formData,
            sourceId: id,
            supplierId: source.supplierId,
            items,
        });
    };

    const handleAddItem = () => {
        setFormData((prev: any) => ({
            ...prev,
            items: [
                ...prev.items,
                { id: Date.now().toString(), productId: "", productName: "", unitId: "", qty: 1, rate: 0, taxCodeId: "", taxRate: 0, taxAmount: 0, total: 0 }
            ]
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
                        updatedItem.productName = prod?.name || "";
                        updatedItem.rate = Number(prod?.purchasePrice || 0);
                        if (prod?.baseUnitId) {
                            updatedItem.unitId = prod.baseUnitId;
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
        if (!formData.supplierId) {
            showNotification('error', 'Please select a Supplier / Account.');
            return;
        }

        if (formData.sourceType === "DIRECT" && !formData.warehouseId) {
            showNotification('error', 'Please select a Warehouse for direct invoices.');
            return;
        }

        const validItems = formData.items.filter((i: any) => i.productId && Number(i.qty) > 0);
        if (validItems.length === 0) {
            showNotification('error', 'Please add at least one valid item.');
            return;
        }

        if (formData.sourceType !== "DIRECT") {
            const overFullfilled = formData.items.some((it: any) => it.qty > it.qtyAvailable);
            if (overFullfilled) {
                if (!confirm("One or more items exceed the remaining PO/GRN quantity. An 'Addendum PO' will be automatically created for the excess. Proceed?")) {
                    return;
                }
            }
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                items: validItems,
                poId: formData.sourceType === "PO" ? formData.sourceId : undefined,
                grnId: formData.sourceType === "GRN" ? formData.sourceId : undefined,
            };

            const res = await authenticatedFetch('/api/finance/purchase/invoices', {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                showNotification('success', 'Purchase Invoice created successfully!');
                router.push('/finance/purchase/invoices');
            } else {
                const json = await res.json();
                showNotification('error', json.error || 'Failed to create invoice.');
            }
        } catch (error) {
            showNotification('error', 'Network error while saving invoice.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const supplierOptions = suppliers.map(s => ({
        value: s.id,
        label: `${s.code} - ${s.name}`
    }));

    const sourceOptions = sources.map(s => ({
        value: s.id,
        label: `${formData.sourceType === "PO" ? s.poNo : s.grnNo} - ${s.supplier?.name || "Unknown"}`
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
                        <CheckCircle2 size={16} className="text-emerald-500" /> New Bill
                    </div>
                </div>

                {/* Premium Dark Header Card */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl shadow-indigo-500/10 relative overflow-hidden border border-slate-800">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-4 space-y-4">
                            <div>
                                <h1 className="text-4xl font-black text-white tracking-tight">New Bill</h1>
                                <p className="text-slate-400 font-medium">Create a Purchase Invoice</p>
                            </div>
                            
                            <div className="bg-slate-900/80 rounded-xl p-2 flex gap-1 border border-slate-800">
                                <button 
                                    onClick={() => setFormData({ ...formData, sourceType: "PO", sourceId: "", items: [] })}
                                    disabled={isGrnMandatory}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                                        formData.sourceType === "PO" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200",
                                        isGrnMandatory && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <FileText size={14} /> PO
                                </button>
                                <button 
                                    onClick={() => setFormData({ ...formData, sourceType: "GRN", sourceId: "", items: [] })}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                                        formData.sourceType === "GRN" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                                    )}
                                >
                                    <Truck size={14} /> GRN
                                </button>
                                {!isGrnMandatory && (
                                    <button 
                                        onClick={() => setFormData({ ...formData, sourceType: "DIRECT", sourceId: "", items: [] })}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                                            formData.sourceType === "DIRECT" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                                        )}
                                    >
                                        <Settings2 size={14} /> Direct
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {formData.sourceType !== "DIRECT" ? (
                                <div className="md:col-span-2 space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        <FileText size={14} /> Link {formData.sourceType}
                                    </label>
                                    <Combobox
                                        options={sourceOptions}
                                        value={formData.sourceId}
                                        onChange={(val) => handleSelectSource(val)}
                                        placeholder={`Select ${formData.sourceType}...`}
                                        className="w-full bg-slate-900/50 border-slate-700 text-white"
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
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
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            <Warehouse size={14} /> Target Warehouse
                                        </label>
                                        <select
                                            className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={formData.warehouseId}
                                            onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                                        >
                                            <option value="">Choose Warehouse...</option>
                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                </>
                            )}

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Calendar size={14} /> Invoice Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Calendar size={14} /> Due Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.dueDate}
                                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
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
                            <Receipt size={20} className="text-indigo-500" /> Billed Items
                        </h2>
                        {formData.sourceType === "DIRECT" && (
                            <button 
                                onClick={handleAddItem}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                            >
                                <Plus size={16} /> Add Product
                            </button>
                        )}
                    </div>

                    <div className="p-6 overflow-x-auto">
                        <div className="min-w-[800px]">
                            <div className="grid grid-cols-12 gap-4 mb-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <div className="col-span-3">Product</div>
                                <div className="col-span-2">Unit</div>
                                {formData.sourceType !== "DIRECT" && <div className="col-span-1 text-center">Available</div>}
                                <div className={formData.sourceType !== "DIRECT" ? "col-span-1" : "col-span-2"}>Bill Qty</div>
                                <div className={formData.sourceType !== "DIRECT" ? "col-span-1" : "col-span-1"}>Rate</div>
                                <div className="col-span-2 text-right">Tax</div>
                                <div className="col-span-2 text-right">Total</div>
                                {formData.sourceType === "DIRECT" && <div className="col-span-1 text-center">Act</div>}
                            </div>

                            <div className="space-y-3">
                                {formData.items.map((item: any, index: number) => (
                                    <div key={item.id} className="grid grid-cols-12 gap-4 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-all hover:border-indigo-200 dark:hover:border-indigo-500/30">
                                        <div className="col-span-4">
                                            {formData.sourceType !== "DIRECT" ? (
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
                                        
                                        {formData.sourceType !== "DIRECT" && (
                                            <div className="col-span-1 text-center text-sm">
                                                <span className="font-bold text-slate-500">{item.qtyAvailable}</span>
                                            </div>
                                        )}

                                        <div className={formData.sourceType !== "DIRECT" ? "col-span-2" : "col-span-2"}>
                                            <input
                                                type="number"
                                                value={item.qty || ''}
                                                onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value))}
                                                placeholder="0"
                                                min="0"
                                                max={formData.sourceType !== "DIRECT" ? item.qtyAvailable : undefined}
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm text-right"
                                            />
                                        </div>
                                        
                                        <div className={formData.sourceType !== "DIRECT" ? "col-span-1" : "col-span-1"}>
                                            <input
                                                type="number"
                                                value={item.rate || ''}
                                                onChange={e => updateItem(item.id, 'rate', parseFloat(e.target.value))}
                                                placeholder="0.00"
                                                min="0"
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-right"
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <select
                                                value={item.taxCodeId || ''}
                                                onChange={e => updateItem(item.id, 'taxCodeId', e.target.value)}
                                                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                            >
                                                <option value="">No Tax</option>
                                                {taxCodes.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-span-2 flex items-center justify-end px-2">
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
                                        No items. Please select a source or add items.
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
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
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
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
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
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Calculator size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bill Total</p>
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
                            {isSubmitting ? 'Saving...' : 'Create Bill'}
                        </button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
