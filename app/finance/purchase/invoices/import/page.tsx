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
    FileText
} from "lucide-react";
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

export default function NewImportInvoicePage() {
    const router = useRouter();
    const { showNotification } = useNotifications();

    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Master Data
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [taxCodes, setTaxCodes] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [currency, setCurrency] = useState<{ symbol: string }>({ symbol: '$' });

    // Form Data - Direct Import Bill (No PO / GRN)
    const [formData, setFormData] = useState<any>({
        supplierId: "",
        beneficiaryName: "",
        gdNumber: "",
        blNumber: "",
        warehouseId: "",
        date: new Date().toISOString().split("T")[0],
        dueDate: "",
        hasDiscount: false,
        discountAmount: 0,
        discountType: "FIXED",
        exchangeRate: 1.0,
        docExchangeRate: 1.0, // Bank Doc Retirement Rate
        customsExchangeRate: 1.0, // Customs GD Currency Rate
        foreignTotal: 0,
        items: [
            { 
                id: Date.now().toString(), 
                productId: "", 
                productName: "", 
                unitId: "", 
                qty: 1, 
                foreignRate: 0, 
                rate: 0, 
                foreignAmount: 0, 
                total: 0, 
                isEFS: false,
                assessedRate: 0,
                cdAmount: 0,
                rdAmount: 0,
                acdAmount: 0,
                itpRate: 0,
                assessedValuePKR: 0
            }
        ],
        gdTaxes: [],
    });

    useEffect(() => {
        fetchDropdowns();
    }, []);

    const fetchDropdowns = async () => {
        try {
            const [supRes, accRes, whRes, prodRes, unitRes, taxRes, currRes] = await Promise.all([
                authenticatedFetch("/api/finance/parties/suppliers"),
                authenticatedFetch('/api/accounts?isPosting=true'),
                authenticatedFetch("/api/inventory/warehouses"),
                authenticatedFetch("/api/inventory/products"),
                authenticatedFetch("/api/inventory/units"),
                authenticatedFetch("/api/finance/tax"),
                authenticatedFetch("/api/finance/currency"),
            ]);

            const sups = supRes.ok ? (await supRes.json()).data || [] : [];
            const accs = accRes.ok ? (await accRes.json()).accounts || [] : [];
            setAccounts(accs);
            
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
            if (unitRes.ok) {
                const uJson = await unitRes.json();
                setUnits(uJson.data || []);
            }
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
        } catch (error) {
            console.error("Error fetching dropdowns:", error);
        }
    };

    const handleAddItem = () => {
        setFormData((prev: any) => ({
            ...prev,
            items: [
                ...prev.items,
                { 
                    id: Date.now().toString() + Math.random().toString().slice(-4), 
                    productId: "", 
                    productName: "", 
                    unitId: "", 
                    qty: 1, 
                    foreignRate: 0, 
                    rate: 0, 
                    foreignAmount: 0, 
                    total: 0, 
                    isEFS: false,
                    assessedRate: 0,
                    cdAmount: 0,
                    rdAmount: 0,
                    acdAmount: 0,
                    itpRate: 0,
                    assessedValuePKR: 0
                }
            ]
        }));
    };

    const handleExchangeRateChange = (field: 'docExchangeRate' | 'customsExchangeRate', value: number) => {
        const numVal = isNaN(value) ? 0 : value;
        setFormData((prev: any) => {
            const docXRate = field === 'docExchangeRate' ? numVal : Number(prev.docExchangeRate || 1);
            const customsXRate = field === 'customsExchangeRate' ? numVal : Number(prev.customsExchangeRate || 1);

            const updatedItems = prev.items.map((item: any) => {
                const qty = Number(item.qty || 0);
                const foreignRate = Number(item.foreignRate || 0);
                const subtotalFC = qty * foreignRate;
                const assessedRate = Number(item.assessedRate || 0);
                const assessedValuePKR = (assessedRate * qty) * customsXRate;
                const cd = Number(item.cdAmount || 0);
                const rd = Number(item.rdAmount || 0);
                const acd = Number(item.acdAmount || 0);
                const itpRate = qty > 0 ? ((assessedValuePKR + cd + rd + acd) / qty) : 0;

                return {
                    ...item,
                    foreignAmount: subtotalFC,
                    rate: foreignRate * docXRate,
                    total: subtotalFC * docXRate,
                    assessedValuePKR,
                    itpRate
                };
            });

            return {
                ...prev,
                [field]: numVal,
                exchangeRate: docXRate,
                items: updatedItems
            };
        });
    };

    const handleRemoveItem = (id: string) => {
        setFormData((prev: any) => ({
            ...prev,
            items: prev.items.filter((item: any) => item.id !== id)
        }));
    };

    const updateItem = (id: string, field: string, value: any) => {
        setFormData((prev: any) => {
            const customsXRate = Number(prev.customsExchangeRate || prev.exchangeRate || 1);
            const docXRate = Number(prev.docExchangeRate || prev.exchangeRate || 1);

            const newItems = prev.items.map((item: any) => {
                if (item.id === id) {
                    let refinedValue = value;
                    if (["qty", "foreignRate", "rate", "assessedRate", "cdAmount", "rdAmount", "acdAmount"].includes(field)) {
                        refinedValue = isNaN(value) ? 0 : value;
                    }
                    const updatedItem = { ...item, [field]: refinedValue };
                    
                    if (field === "productId") {
                        const prod = products.find(p => p.id === value);
                        updatedItem.productName = prod?.name || "";
                        updatedItem.rate = Number(prod?.purchasePrice || 0);
                        if (prod?.baseUnitId) {
                            updatedItem.unitId = prod.baseUnitId;
                        } else if (prod?.Unit?.id) {
                            updatedItem.unitId = prod.Unit.id;
                        }
                        if (prod?.itpRate) {
                            updatedItem.assessedRate = Number(prod.itpRate);
                        }
                    }

                    const qty = Number(updatedItem.qty || 0);
                    const foreignRate = Number(updatedItem.foreignRate || 0);
                    const subtotalFC = qty * foreignRate;
                    updatedItem.foreignAmount = subtotalFC; 
                    updatedItem.rate = foreignRate * docXRate;
                    updatedItem.total = subtotalFC * docXRate;

                    // ITP Rate Formula: (Assessed Value in PKR + RD + CD + ACD) / QTY
                    const assessedRate = Number(updatedItem.assessedRate || 0);
                    const assessedValuePKR = (assessedRate * qty) * customsXRate;
                    const cd = Number(updatedItem.cdAmount || 0);
                    const rd = Number(updatedItem.rdAmount || 0);
                    const acd = Number(updatedItem.acdAmount || 0);
                    
                    updatedItem.assessedValuePKR = assessedValuePKR;
                    updatedItem.itpRate = qty > 0 ? ((assessedValuePKR + cd + rd + acd) / qty) : 0;
                    
                    return updatedItem;
                }
                return item;
            });
            return { ...prev, items: newItems };
        });
    };

    const calculateSummary = () => {
        const subtotal = formData.items.reduce((sum: number, item: any) => sum + ((Number(item.qty) || 0) * (Number(item.rate) || 0)), 0);
        const discount = formData.hasDiscount ? Number(formData.discountAmount || 0) : 0;
        
        let currentTotal = subtotal - discount;
        let taxTotal = 0;
        
        // Calculate cascading taxes
        const calculatedTaxes = (formData.gdTaxes || []).map((tax: any) => {
            const baseAmount = tax.calculation === 'PREVIOUS_TOTAL' ? currentTotal : (subtotal - discount);
            const rate = Number(tax.rate) || 0;
            const taxAmount = rate > 0 ? (baseAmount * (rate / 100)) : (Number(tax.taxAmount) || 0);
            
            taxTotal += taxAmount;
            currentTotal += taxAmount;
            
            return { ...tax, baseAmount, taxAmount };
        });

        const grandTotal = subtotal - discount + taxTotal;
        
        return { subtotal, discount, taxTotal, grandTotal, calculatedTaxes };
    };

    const handleAddTax = () => {
        setFormData((prev: any) => ({
            ...prev,
            gdTaxes: [
                ...(prev.gdTaxes || []),
                { id: Date.now().toString(), taxCodeId: "", taxName: "", calculation: "NET_TOTAL", rate: 0, taxAmount: 0, isCapitalized: false, accountId: null }
            ]
        }));
    };

    const handleRemoveTax = (id: string) => {
        setFormData((prev: any) => ({
            ...prev,
            gdTaxes: (prev.gdTaxes || []).filter((t: any) => t.id !== id)
        }));
    };

    const updateTax = (id: string, field: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            gdTaxes: (prev.gdTaxes || []).map((t: any) => {
                if (t.id === id) {
                    const updated = { ...t, [field]: value };
                    if (field === 'taxCodeId') {
                        if (value === 'MANUAL') {
                            updated.taxName = 'Manual Tax';
                        } else {
                            const tc = taxCodes.find(x => x.id === value);
                            if (tc) {
                                updated.taxName = tc.name;
                                updated.rate = Number(tc.rate);
                                updated.accountId = tc.accountId;
                            }
                        }
                    }
                    if (field === 'taxAmount') {
                        updated.taxAmount = isNaN(value) ? 0 : value;
                        updated.rate = 0;
                    }
                    return updated;
                }
                return t;
            })
        }));
    };

    const handleSubmit = async () => {
        if (!formData.supplierId) {
            showNotification('error', 'Please select a Supplier / Import Account.');
            return;
        }

        const validItems = formData.items.filter((i: any) => i.productId && Number(i.qty) > 0);
        if (validItems.length === 0) {
            showNotification('error', 'Please add at least one valid item with quantity.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                items: validItems
            };

            const res = await authenticatedFetch('/api/finance/purchase/invoices/import', {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                showNotification('success', 'Import Invoice created successfully!');
                router.push('/finance/purchase/invoices');
            } else {
                const json = await res.json();
                showNotification('error', json.error || 'Failed to create import invoice.');
            }
        } catch (error) {
            showNotification('error', 'Network error while saving import invoice.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const supplierOptions = suppliers.map(s => ({
        value: s.id,
        label: `${s.code ? `${s.code} - ` : ''}${s.name}`
    }));

    const productOptions = products.map(p => {
        const catName = p.Category?.name || p.category?.name || '-';
        const hs = p.hsCode ? ` (HS: ${p.hsCode})` : '';
        return {
            value: p.id,
            label: `${p.name} [${catName}]${hs} - ${p.code}`
        };
    });

    return (
        <MainLayout>
            <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-36 animate-in fade-in duration-500">
                {/* Header Action Bar */}
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors font-bold text-sm"
                    >
                        <ArrowLeft size={16} /> Back to Invoices
                    </button>
                    <span className="text-xs font-bold px-3 py-1 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 rounded-full uppercase tracking-wider">
                        Direct Import Purchase
                    </span>
                </div>

                {/* Import Hero Card */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl shadow-indigo-500/10 relative border border-slate-800 z-10">
                    <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    </div>
                    
                    <div className="relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Title Header */}
                        <div className="lg:col-span-3 space-y-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30">
                                        ● Direct Import Bill
                                    </span>
                                </div>
                                <h1 className="text-3xl font-black text-white tracking-tight">New Import Bill</h1>
                                <p className="text-slate-400 font-medium text-xs mt-1 leading-relaxed">
                                    Direct Goods Declaration (GD) & Commercial Import Invoice with EFS & ITP calculation.
                                </p>
                            </div>
                        </div>
                        
                        {/* Import Details Form */}
                        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Building2 size={14} /> Import Account / Supplier <span className="text-rose-400">*</span>
                                </label>
                                <Combobox
                                    options={supplierOptions}
                                    value={formData.supplierId}
                                    onChange={(val) => setFormData({ ...formData, supplierId: val })}
                                    placeholder="Select import account..."
                                    className="w-full bg-slate-900/50 border-slate-700 text-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Building2 size={14} /> Beneficiary (Foreign Exporter)
                                </label>
                                <input
                                    type="text"
                                    value={formData.beneficiaryName || ''}
                                    onChange={(e) => setFormData({ ...formData, beneficiaryName: e.target.value })}
                                    placeholder="e.g. Shaoxing Textiles Co."
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Warehouse size={14} /> Target Warehouse (Optional)
                                </label>
                                <select
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    value={formData.warehouseId}
                                    onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                                >
                                    <option value="">Choose Warehouse (Optional)...</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>

                            {/* GD & BL Info */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest">
                                    <FileText size={14} /> GD Number
                                </label>
                                <input
                                    type="text"
                                    value={formData.gdNumber || ''}
                                    onChange={(e) => setFormData({ ...formData, gdNumber: e.target.value })}
                                    placeholder="e.g. KAPE-HC-12345-2026"
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-indigo-500/30 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <FileText size={14} /> BL Number
                                </label>
                                <input
                                    type="text"
                                    value={formData.blNumber || ''}
                                    onChange={(e) => setFormData({ ...formData, blNumber: e.target.value })}
                                    placeholder="e.g. MAEU12345678"
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Calendar size={14} /> Invoice Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                            </div>

                            {/* Dual Exchange Rates */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest" title="Commercial Bank exchange rate charged when retiring shipping documents">
                                    <Calculator size={14} /> Bank Doc Rate (PKR)
                                </label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={formData.docExchangeRate || ''}
                                    onChange={(e) => handleExchangeRateChange('docExchangeRate', parseFloat(e.target.value))}
                                    placeholder="e.g. 280.50"
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-emerald-500/40 text-emerald-300 outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                                />
                                <span className="text-[10px] text-slate-500 block">Supplier commercial cost rate</span>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest" title="Customs/National Bank exchange rate printed on GD for duties">
                                    <Calculator size={14} /> Customs GD Rate (PKR)
                                </label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={formData.customsExchangeRate || ''}
                                    onChange={(e) => handleExchangeRateChange('customsExchangeRate', parseFloat(e.target.value))}
                                    placeholder="e.g. 278.20"
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-amber-500/40 text-amber-300 outline-none focus:ring-2 focus:ring-amber-500 text-sm font-bold"
                                />
                                <span className="text-[10px] text-slate-500 block">GD duty assessment currency rate</span>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Calculator size={14} /> Foreign Total (Invoice Val)
                                </label>
                                <input
                                    type="number"
                                    value={formData.foreignTotal || ''}
                                    onChange={(e) => setFormData({ ...formData, foreignTotal: parseFloat(e.target.value) })}
                                    placeholder="0.00"
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                                />
                                <span className="text-[10px] text-slate-500 block">Foreign currency sum</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <Receipt size={20} className="text-indigo-500" /> Billed Items
                        </h2>
                        <button 
                            onClick={handleAddItem}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                        >
                            <Plus size={16} /> Add Product
                        </button>
                    </div>

                    <div className="p-6 overflow-visible">
                        <div className="w-full">
                            <div className="grid grid-cols-12 gap-4 mb-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <div className="col-span-4">Product</div>
                                <div className="col-span-2">Unit</div>
                                <div className="col-span-2 text-right">Bill Qty</div>
                                <div className="col-span-2 text-right">Supplier Rate ($)</div>
                                <div className="col-span-1 text-center">EFS</div>
                                <div className="col-span-1 text-center">Action</div>
                            </div>

                            <div className="space-y-4">
                                {formData.items.map((item: any) => {
                                    const itpRate = Number(item.itpRate || 0);
                                    const qty = Number(item.qty || 0);
                                    const foreignRate = Number(item.foreignRate || 0);
                                    const totalFC = qty * foreignRate;

                                    return (
                                        <div key={item.id} className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4 transition-all hover:border-indigo-300 dark:hover:border-indigo-500/40">
                                            {/* Tier 1: Product, Qty, Commercial Supplier Rate */}
                                            <div className="grid grid-cols-12 gap-4 items-center">
                                                <div className="col-span-4">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Product</label>
                                                    <Combobox
                                                        options={productOptions}
                                                        value={item.productId}
                                                        onChange={(val) => updateItem(item.id, 'productId', val)}
                                                        placeholder="Select product..."
                                                        searchPlaceholder="Search products by name, category, HS code..."
                                                        className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                                    />
                                                </div>

                                                <div className="col-span-2">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Unit</label>
                                                    <Combobox
                                                        options={units.map(u => ({ value: u.id, label: u.name }))}
                                                        value={item.unitId || ''}
                                                        onChange={(val) => updateItem(item.id, 'unitId', val)}
                                                        placeholder="Unit..."
                                                        searchPlaceholder="Search units..."
                                                        className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                                    />
                                                </div>

                                                <div className="col-span-2">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1 text-right">Bill Qty</label>
                                                    <input
                                                        type="number"
                                                        value={item.qty || ''}
                                                        onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value))}
                                                        placeholder="0"
                                                        min="0"
                                                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm text-right"
                                                    />
                                                </div>
                                                
                                                <div className="col-span-2">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Supplier Rate ($)</label>
                                                        {totalFC > 0 && (
                                                            <span className="text-[10px] font-extrabold text-emerald-500 dark:text-emerald-400">
                                                                Total: ${totalFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        value={item.foreignRate || ''}
                                                        onChange={e => updateItem(item.id, 'foreignRate', parseFloat(e.target.value))}
                                                        placeholder="0.00"
                                                        min="0"
                                                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold text-right text-slate-900 dark:text-white"
                                                    />
                                                </div>

                                                <div className="col-span-1 text-center">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">EFS</label>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            className="sr-only peer" 
                                                            checked={item.isEFS}
                                                            onChange={e => updateItem(item.id, 'isEFS', e.target.checked)}
                                                        />
                                                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
                                                    </label>
                                                    {item.isEFS && <span className="text-[9px] block font-black text-amber-500 tracking-tighter">ONLY CONSUM</span>}
                                                </div>

                                                <div className="col-span-1 flex justify-center items-center pt-4">
                                                    <button 
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                                                        title="Remove Item"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Tier 2: Customs Assessed Value & ITP Formula Breakdown */}
                                            <div className="bg-white/80 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/80 flex flex-wrap items-center gap-6 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Customs Assessed Rate ($):</span>
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        value={item.assessedRate || ''}
                                                        onChange={e => updateItem(item.id, 'assessedRate', parseFloat(e.target.value))}
                                                        placeholder="Rate ($)"
                                                        className="w-32 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right font-semibold text-xs text-slate-800 dark:text-slate-200"
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">CD (PKR):</span>
                                                    <input
                                                        type="number"
                                                        value={item.cdAmount || ''}
                                                        onChange={e => updateItem(item.id, 'cdAmount', parseFloat(e.target.value))}
                                                        placeholder="CD"
                                                        className="w-28 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right font-semibold text-xs text-slate-800 dark:text-slate-200"
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">RD (PKR):</span>
                                                    <input
                                                        type="number"
                                                        value={item.rdAmount || ''}
                                                        onChange={e => updateItem(item.id, 'rdAmount', parseFloat(e.target.value))}
                                                        placeholder="RD"
                                                        className="w-28 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right font-semibold text-xs text-slate-800 dark:text-slate-200"
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">ACD (PKR):</span>
                                                    <input
                                                        type="number"
                                                        value={item.acdAmount || ''}
                                                        onChange={e => updateItem(item.id, 'acdAmount', parseFloat(e.target.value))}
                                                        placeholder="ACD"
                                                        className="w-28 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right font-semibold text-xs text-slate-800 dark:text-slate-200"
                                                    />
                                                </div>

                                                {/* Calculated ITP Rate Badge */}
                                                <div className="ml-auto flex items-center gap-3">
                                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">(Assessed+RD+CD+ACD)/Qty:</span>
                                                    <span className="px-4 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 rounded-xl font-black text-sm">
                                                        ITP Rate: Rs. {itpRate.toFixed(2)} / unit
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {formData.items.length === 0 && (
                                    <div className="text-center p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 font-bold flex flex-col items-center justify-center gap-3">
                                        <p>No items added yet. Click below to add an import product.</p>
                                        <button
                                            onClick={handleAddItem}
                                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                        >
                                            <Plus size={14} /> Add Product
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Taxes & Charges Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible mt-6">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <Receipt size={20} className="text-indigo-500" /> Taxes & Charges
                        </h2>
                        <button 
                            onClick={handleAddTax}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                        >
                            <Plus size={16} /> Add Tax
                        </button>
                    </div>

                    <div className="p-6 overflow-visible">
                        <div className="min-w-[700px]">
                            <div className="grid grid-cols-12 gap-4 mb-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <div className="col-span-2">Tax Type</div>
                                <div className="col-span-2">Account</div>
                                <div className="col-span-2">Calculate On</div>
                                <div className="col-span-1 text-right">Base</div>
                                <div className="col-span-1 text-right">Rate %</div>
                                <div className="col-span-2 text-right">PKR Amount</div>
                                <div className="col-span-1 text-center">Capit.</div>
                                <div className="col-span-1 text-center">Act</div>
                            </div>

                            <div className="space-y-3">
                                {(formData.gdTaxes || []).map((tax: any, index: number) => {
                                    const computed = calculateSummary().calculatedTaxes[index];
                                    return (
                                        <div key={tax.id} className="grid grid-cols-12 gap-4 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-all hover:border-indigo-200 dark:hover:border-indigo-500/30">
                                            <div className="col-span-2">
                                                <Combobox
                                                    options={[
                                                        ...taxCodes.map(t => ({ value: t.id, label: t.name })),
                                                        { value: 'MANUAL', label: 'Manual Tax' }
                                                    ]}
                                                    value={tax.taxCodeId || ''}
                                                    onChange={(val) => updateTax(tax.id, 'taxCodeId', val)}
                                                    placeholder="Select Tax..."
                                                    searchPlaceholder="Search taxes..."
                                                    className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <Combobox
                                                    options={accounts.map(a => ({ value: a.id, label: a.name }))}
                                                    value={tax.accountId || ''}
                                                    onChange={(val) => updateTax(tax.id, 'accountId', val)}
                                                    placeholder="Account..."
                                                    searchPlaceholder="Search accounts..."
                                                    className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <Combobox
                                                    options={[
                                                        { value: 'NET_TOTAL', label: 'Net Total (Subtotal - Discount)' },
                                                        { value: 'PREVIOUS_TOTAL', label: 'Previous Row Total (Cascading)' }
                                                    ]}
                                                    value={tax.calculation}
                                                    onChange={(val) => updateTax(tax.id, 'calculation', val)}
                                                    placeholder="Calculate On..."
                                                    searchPlaceholder="Search options..."
                                                    className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                                />
                                            </div>
                                            <div className="col-span-1 text-right font-medium text-slate-500">
                                                {computed?.baseAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                            <div className="col-span-1">
                                                <input
                                                    type="number"
                                                    value={tax.rate || ''}
                                                    onChange={e => updateTax(tax.id, 'rate', parseFloat(e.target.value))}
                                                    placeholder="0"
                                                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-right"
                                                />
                                            </div>
                                            <div className="col-span-2 text-right font-black text-slate-800 dark:text-white">
                                                {computed?.taxAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                            <div className="col-span-1 flex justify-center items-center">
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        className="sr-only peer" 
                                                        checked={tax.isCapitalized}
                                                        onChange={e => updateTax(tax.id, 'isCapitalized', e.target.checked)}
                                                    />
                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                                </label>
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                <button 
                                                    onClick={() => handleRemoveTax(tax.id)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {(formData.gdTaxes || []).length === 0 && (
                                    <div className="text-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 font-bold text-sm">
                                        No taxes added. Click "Add Tax" to apply document-level taxes.
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
                            <h3 className="text-base font-black text-slate-800 dark:text-white">Commercial Discount</h3>
                            <p className="text-xs text-slate-400">Apply foreign currency or overall bill discount</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={formData.hasDiscount}
                                onChange={e => setFormData({ ...formData, hasDiscount: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    {formData.hasDiscount && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Discount Amount (PKR)</label>
                                <input
                                    type="number"
                                    value={formData.discountAmount || ''}
                                    onChange={e => setFormData({ ...formData, discountAmount: parseFloat(e.target.value) || 0 })}
                                    placeholder="0.00"
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky Action Footer */}
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl rounded-[2.5rem] p-4 flex flex-col md:flex-row items-center justify-between gap-6 max-w-[1700px] w-[95%] transition-all">
                    <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-start px-2">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subtotal</p>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                                Rs. {calculateSummary().subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tax Amount</p>
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                + Rs. {calculateSummary().taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                        </div>

                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 hidden md:flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Calculator size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Grand Total</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mt-0.5">
                                    Rs. {calculateSummary().grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            </div>
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
