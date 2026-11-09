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

export default function NewImportInvoicePage() {
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
    const [accounts, setAccounts] = useState<any[]>([]);
    const [isGrnMandatory, setIsGrnMandatory] = useState(false);
    const [currency, setCurrency] = useState<{ symbol: string }>({ symbol: '$' });

    // Form Data
    const [formData, setFormData] = useState<any>({
        sourceType: "PO", // PO | GRN | DIRECT
        sourceId: "",
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
        exchangeRate: 1.0, // Fallback
        docExchangeRate: 1.0, // Bank Doc Retirement Rate
        customsExchangeRate: 1.0, // Customs GD Currency Rate
        foreignTotal: 0,
        items: [],
        gdTaxes: [],
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
                console.log("Fetched units:", uJson);
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
                    foreignRate: item.rate,
                    rate: item.rate,
                    foreignAmount: available * item.rate,
                    total: available * item.rate,
                    isEFS: false,
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
                foreignRate: item.poItem?.rate || 0,
                rate: item.poItem?.rate || 0,
                foreignAmount: item.qtyReceived * (item.poItem?.rate || 0),
                total: item.qtyReceived * (item.poItem?.rate || 0),
                isEFS: false,
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
                            setUnits((prev: any) => {
                                if (prev.some((u: any) => u.id === prod.baseUnitId)) return prev;
                                return [...prev, { id: prod.baseUnitId, name: prod.baseUnit?.name || 'Unit' }];
                            });
                        } else if (prod?.baseUnit?.id) {
                            updatedItem.unitId = prod.baseUnit.id;
                            setUnits((prev: any) => {
                                if (prev.some((u: any) => u.id === prod.baseUnit.id)) return prev;
                                return [...prev, { id: prod.baseUnit.id, name: prod.baseUnit.name || 'Unit' }];
                            });
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
            // If they typed a rate, calculate it. Otherwise, use the manually entered taxAmount.
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
                    // If they manually type tax amount, zero out the rate
                    if (field === 'taxAmount') {
                        updated.taxAmount = isNaN(value) ? 0 : value;
                        updated.rate = 0; // It becomes a fixed amount charge
                    }
                    return updated;
                }
                return t;
            })
        }));
    };

    const handleSubmit = async () => {
        if (!formData.supplierId) {
            showNotification('error', 'Please select a Supplier / Account.');
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

            const res = await authenticatedFetch('/api/finance/purchase/invoices/import', {
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
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl shadow-indigo-500/10 relative border border-slate-800 z-10">
                    <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    </div>
                    
                    <div className="relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-8">
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
                        
                        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-5">
                            {formData.sourceType !== "DIRECT" ? (
                                <div className="md:col-span-3 space-y-2">
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
                                            <Building2 size={14} /> Import Account / Supplier
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
                                            <Building2 size={14} /> Beneficiary Name (Foreign Exporter)
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
                                            <Warehouse size={14} /> Target Warehouse
                                        </label>
                                        <select
                                            className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                            value={formData.warehouseId}
                                            onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                                        >
                                            <option value="">Choose Warehouse...</option>
                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                </>
                            )}

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
                        {formData.sourceType === "DIRECT" && (
                            <button 
                                onClick={handleAddItem}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                            >
                                <Plus size={16} /> Add Product
                            </button>
                        )}
                    </div>

                    <div className="p-6 overflow-visible">
                        <div className="min-w-[800px]">
                            <div className="grid grid-cols-12 gap-4 mb-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <div className="col-span-3">Product</div>
                                <div className="col-span-1">Unit</div>
                                {formData.sourceType !== "DIRECT" && <div className="col-span-1 text-center">Avail</div>}
                                <div className="col-span-2">Bill Qty</div>
                                <div className="col-span-2">Rate (FC)</div>
                                <div className="col-span-1 text-center">EFS</div>
                                <div className="col-span-2 text-right">Total (FC)</div>
                                {formData.sourceType === "DIRECT" && <div className="col-span-1 text-center">Act</div>}
                            </div>

                            <div className="space-y-4">
                                {formData.items.map((item: any, index: number) => {
                                    const qty = Number(item.qty || 0);
                                    const assessedVal = Number(item.assessedValuePKR || 0);
                                    const itpRate = Number(item.itpRate || 0);

                                    return (
                                        <div key={item.id} className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 transition-all hover:border-indigo-300 dark:hover:border-indigo-500/40">
                                            {/* Tier 1: Product, Qty, Commercial Supplier Rate */}
                                            <div className="grid grid-cols-12 gap-3 items-center">
                                                <div className="col-span-4">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Product</label>
                                                    {formData.sourceType !== "DIRECT" ? (
                                                        <div className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                                            {item.productName}
                                                        </div>
                                                    ) : (
                                                        <Combobox
                                                            options={products.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))}
                                                            value={item.productId}
                                                            onChange={(val) => updateItem(item.id, 'productId', val)}
                                                            placeholder="Select product..."
                                                            searchPlaceholder="Search products..."
                                                            className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                                        />
                                                    )}
                                                </div>

                                                <div className="col-span-2">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Unit</label>
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
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Bill Qty</label>
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
                                                
                                                <div className="col-span-2">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Supplier Rate ($)</label>
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
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">EFS</label>
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
                                                    {formData.sourceType === "DIRECT" && (
                                                        <button 
                                                            onClick={() => handleRemoveItem(item.id)}
                                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                                                            title="Remove Item"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Tier 2: Customs Assessed Value & ITP Formula Breakdown */}
                                            <div className="bg-white/80 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/80 flex flex-wrap items-center gap-4 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Assessed Rate ($):</span>
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        value={item.assessedRate || ''}
                                                        onChange={e => updateItem(item.id, 'assessedRate', parseFloat(e.target.value))}
                                                        placeholder="Assessed $"
                                                        className="w-24 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right font-medium text-xs text-slate-800 dark:text-slate-200"
                                                    />
                                                </div>

                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    <span className="text-[10px] font-bold uppercase">Assessed PKR:</span>
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                                        Rs. {assessedVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">CD:</span>
                                                    <input
                                                        type="number"
                                                        value={item.cdAmount || ''}
                                                        onChange={e => updateItem(item.id, 'cdAmount', parseFloat(e.target.value))}
                                                        placeholder="CD"
                                                        className="w-20 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right font-medium text-xs text-slate-800 dark:text-slate-200"
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">RD:</span>
                                                    <input
                                                        type="number"
                                                        value={item.rdAmount || ''}
                                                        onChange={e => updateItem(item.id, 'rdAmount', parseFloat(e.target.value))}
                                                        placeholder="RD"
                                                        className="w-20 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right font-medium text-xs text-slate-800 dark:text-slate-200"
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">ACD:</span>
                                                    <input
                                                        type="number"
                                                        value={item.acdAmount || ''}
                                                        onChange={e => updateItem(item.id, 'acdAmount', parseFloat(e.target.value))}
                                                        placeholder="ACD"
                                                        className="w-20 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right font-medium text-xs text-slate-800 dark:text-slate-200"
                                                    />
                                                </div>

                                                {/* Calculated ITP Rate Badge */}
                                                <div className="ml-auto flex items-center gap-2">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">(Assessed+RD+CD+ACD)/Qty:</span>
                                                    <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 rounded-lg font-black text-xs">
                                                        ITP Rate: Rs. {itpRate.toFixed(2)} / unit
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {formData.items.length === 0 && (
                                    <div className="text-center p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 font-bold">
                                        No items. Please select a source or add items.
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
                                {(formData.taxes || []).length === 0 && (
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
                    <div className="flex items-center gap-6 md:gap-8 overflow-x-auto pb-2 md:pb-0">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subtotal</span>
                            <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
                                {currency.symbol} {calculateSummary().subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        
                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
                        
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tax Amount</span>
                            <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
                                + {currency.symbol} {calculateSummary().taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>

                        {formData.hasDiscount && (
                            <>
                                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Discount</span>
                                    <span className="text-lg font-bold text-rose-500">
                                        - {currency.symbol} {calculateSummary().discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </>
                        )}

                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 hidden md:flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Calculator size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Grand Total</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mt-0.5">
                                    {currency.symbol} {calculateSummary().grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
