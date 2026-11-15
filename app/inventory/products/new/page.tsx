"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import Combobox from '@/components/Combobox';
import { 
    Save, 
    ArrowLeft, 
    PackageSearch,
    Tags,
    Scale,
    Plus,
    Trash2,
    Barcode,
    Layers,
    Info,
    Warehouse,
    Globe,
    Calendar,
    ShieldAlert
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

interface Variant {
    name: string;
    sku: string;
    price: number;
}

export default function NewProductPage() {
    const router = useRouter();
    const { showNotification } = useNotifications();
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState<any>({
        code: '', 
        name: '', 
        categoryId: '', 
        baseUnitId: '', 
        canBeSold: true,
        canBePurchased: true,
        isManufactured: false,
        stage: '', // RAW, GREY, FINISH
        isService: false,
        variants: [] as Variant[],
        // Notice: Accounting fields are omitted from UI, backend will handle or we'll set it at Category level later
    });

    const [variantInput, setVariantInput] = useState('');

    // Dropdown Data
    const [categories, setCategories] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);

    // Opening Stock State
    const [enableOpeningStock, setEnableOpeningStock] = useState(false);
    const [openingStock, setOpeningStock] = useState({
        warehouseId: '',
        stage: 'RAW',
        origin: 'LOCAL',
        isEFS: false,
        qty: '',
        costRate: '',
        itpRate: '',
        batchNo: '',
        date: new Date().toISOString().split('T')[0]
    });

    // Multi-Invoice State for Services
    const [serviceInvoices, setServiceInvoices] = useState<Array<{
        id: string;
        date: string;
        partyInfo: string;
        qty: string;
        costRate: string;
    }>>([
        { id: '1', date: new Date().toISOString().split('T')[0], partyInfo: '', qty: '', costRate: '' }
    ]);

    const handleAddServiceInvoice = () => {
        setServiceInvoices(prev => [
            ...prev,
            { id: String(Date.now()), date: new Date().toISOString().split('T')[0], partyInfo: '', qty: '', costRate: '' }
        ]);
    };

    const handleRemoveServiceInvoice = (id: string) => {
        if (serviceInvoices.length <= 1) return;
        setServiceInvoices(prev => prev.filter(inv => inv.id !== id));
    };

    const handleServiceInvoiceChange = (id: string, field: string, value: string) => {
        setServiceInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, [field]: value } : inv));
    };

    const totalServiceQty = serviceInvoices.reduce((acc, inv) => acc + (Number(inv.qty) || 0), 0);
    const totalServiceValue = serviceInvoices.reduce((acc, inv) => acc + ((Number(inv.qty) || 0) * (Number(inv.costRate) || 0)), 0);

    useEffect(() => {
        fetchDropdowns();
    }, []);

    const fetchDropdowns = async () => {
        try {
            const [catRes, unitRes, whRes] = await Promise.all([
                authenticatedFetch('/api/inventory/categories'),
                authenticatedFetch('/api/admin/units'),
                authenticatedFetch('/api/inventory/warehouses')
            ]);

            if (catRes.ok) {
                const catJson = await catRes.json();
                if (catJson.success) setCategories(catJson.data);
            }
            if (unitRes.ok) {
                const unitJson = await unitRes.json();
                if (unitJson.success) setUnits(unitJson.data);
            }
            if (whRes.ok) {
                const whJson = await whRes.json();
                if (whJson.success) {
                    const whs = whJson.data || [];
                    setWarehouses(whs);
                    if (whs.length > 0) {
                        setOpeningStock(prev => ({
                            ...prev,
                            warehouseId: prev.warehouseId || whs[0].id
                        }));
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching dropdowns:", error);
        }
    };

    const handleAddVariant = (e?: React.KeyboardEvent | React.MouseEvent) => {
        if (e && 'key' in e && e.key !== 'Enter') return;
        if (e) e.preventDefault();

        const val = variantInput.trim();
        if (val) {
            const skuSuffix = `-${val.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
            const newVariant = {
                name: val,
                sku: skuSuffix,
                price: 0
            };
            setFormData({
                ...formData,
                variants: [...formData.variants, newVariant]
            });
            setVariantInput('');
        }
    };

    const removeVariant = (idx: number) => {
        const newVariants = [...formData.variants];
        newVariants.splice(idx, 1);
        setFormData({ ...formData, variants: newVariants });
    };

    const handleVariantChange = (idx: number, field: string, value: string | number) => {
        const newVariants = [...formData.variants];
        newVariants[idx] = { ...newVariants[idx], [field]: value };
        setFormData({ ...formData, variants: newVariants });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.name?.trim() || !formData.categoryId || !formData.baseUnitId || !formData.hsCode?.trim()) {
            showNotification('error', 'Please fill in all required fields (Name, Category, Unit, HS Code).');
            return;
        }

        setLoading(true);
        const payload = {
            ...formData,
            categoryId: formData.categoryId || null,
            baseUnitId: formData.baseUnitId || null,
            // Explicitly sending null for accounting so backend handles it via defaults
            inventoryAccountId: null,
            cogsAccountId: null,
            salesAccountId: null,
            purchaseAccountId: null,
            canBeSold: formData.canBeSold,
            canBePurchased: formData.canBePurchased,
            isManufactured: formData.isManufactured,
            stage: formData.isManufactured ? (formData.stage || null) : null,
            isService: formData.isService,
            variants: formData.variants.map((v: any) => ({
                ...v,
                price: Number(v.price) || 0
            }))
        };

        try {
            const res = await authenticatedFetch('/api/inventory/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();

            if (res.ok && json.success) {
                const createdProduct = json.data;

                // If user entered opening stock, record it directly
                if (enableOpeningStock) {
                    if (formData.isService) {
                        const validInvoices = serviceInvoices.filter(inv => Number(inv.qty) > 0);
                        if (validInvoices.length > 0) {
                            try {
                                for (const inv of validInvoices) {
                                    await authenticatedFetch('/api/inventory/opening', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            productId: createdProduct.id,
                                            warehouseId: null,
                                            stage: 'RAW',
                                            origin: 'LOCAL',
                                            isEFS: false,
                                            qty: Number(inv.qty),
                                            costRate: Number(inv.costRate) || 0,
                                            batchNo: inv.partyInfo || null,
                                            date: inv.date || new Date().toISOString().split('T')[0]
                                        })
                                    });
                                }
                                showNotification('success', `Product and ${validInvoices.length} opening service invoice(s) recorded successfully!`);
                            } catch (openErr) {
                                console.error('Failed to save service opening balance:', openErr);
                                showNotification('warning', 'Product created, but some opening service records could not be saved.');
                            }
                        } else {
                            showNotification('success', 'Product created successfully!');
                        }
                    } else if (Number(openingStock.qty) > 0) {
                        try {
                            await authenticatedFetch('/api/inventory/opening', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    productId: createdProduct.id,
                                    warehouseId: openingStock.warehouseId,
                                    stage: openingStock.stage || formData.stage || 'RAW',
                                    origin: openingStock.origin,
                                    isEFS: openingStock.origin === 'IMPORT' ? openingStock.isEFS : false,
                                    qty: Number(openingStock.qty),
                                    costRate: Number(openingStock.costRate) || 0,
                                    itpRate: openingStock.origin === 'IMPORT' ? (Number(openingStock.itpRate) || null) : null,
                                    batchNo: openingStock.batchNo || null,
                                    date: openingStock.date
                                })
                            });
                            showNotification('success', 'Product and opening stock created successfully!');
                        } catch (openErr) {
                            console.error('Failed to save opening stock:', openErr);
                            showNotification('warning', 'Product created, but opening stock could not be recorded.');
                        }
                    } else {
                        showNotification('success', 'Product created successfully!');
                    }
                } else {
                    showNotification('success', 'Product created successfully!');
                }

                router.push('/inventory/products');
            } else {
                showNotification('error', json.error || "Failed to save product");
            }
        } catch (err) {
            showNotification('error', "An error occurred while saving the product");
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 pb-32 animate-in fade-in duration-500">
                {/* Header Action Bar */}
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors font-bold text-sm"
                    >
                        <ArrowLeft size={16} /> Back to Products
                    </button>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                        <PackageSearch size={16} className="text-violet-500" /> New Item
                    </div>
                </div>

                {/* Premium Dark Header Card */}
                <div className="bg-slate-950 rounded-[2rem] p-6 sm:p-10 shadow-2xl shadow-violet-500/10 relative overflow-hidden border border-slate-800 space-y-8">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    {/* Header Row */}
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">New Product</h1>
                            <p className="text-slate-300 font-medium text-base mt-1">Add an item to your inventory catalog</p>
                        </div>
                        <div className="inline-flex items-center gap-2 bg-violet-500/15 text-violet-300 border border-violet-500/30 px-3.5 py-2 rounded-xl text-xs font-bold w-fit">
                            <Info size={16} /> Accounting mapping has been simplified
                        </div>
                    </div>
                    
                    {/* Inputs Grid */}
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* SKU */}
                        <div className="col-span-12 md:col-span-3 space-y-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                                <Barcode size={15} className="text-violet-400" /> Product Code (SKU)
                            </label>
                            <input
                                type="text"
                                placeholder="Auto-generated if empty"
                                className="w-full p-3.5 rounded-xl bg-slate-900/60 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-500 font-mono text-base font-medium"
                                value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value })}
                            />
                        </div>

                        {/* Product Name */}
                        <div className="col-span-12 md:col-span-6 space-y-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                                <PackageSearch size={15} className="text-violet-400" /> Product Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Premium Cotton Yarn / Dyeing Service / Dyed Fabric"
                                className="w-full p-3.5 rounded-xl bg-slate-900/60 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-500 text-base font-semibold"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        {/* HS Code */}
                        <div className="col-span-12 md:col-span-3 space-y-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                                <Barcode size={15} className="text-violet-400" /> HS Code <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. 5402.3300"
                                className="w-full p-3.5 rounded-xl bg-slate-900/60 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-500 font-mono text-base font-medium"
                                value={formData.hsCode || ''}
                                onChange={e => setFormData({ ...formData, hsCode: e.target.value })}
                            />
                        </div>

                        {/* Category (Combobox) */}
                        <div className="col-span-12 md:col-span-6 space-y-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                                <Tags size={15} className="text-violet-400" /> Category <span className="text-rose-500">*</span>
                            </label>
                            <Combobox
                                options={categories.map(c => ({ value: c.id, label: c.name }))}
                                value={formData.categoryId}
                                onChange={val => setFormData({ ...formData, categoryId: val })}
                                placeholder="Select Category..."
                                searchPlaceholder="Search category..."
                                forceDark={true}
                                className="p-3.5 text-base font-semibold"
                            />
                        </div>

                        {/* Base Unit (Combobox) */}
                        <div className="col-span-12 md:col-span-6 space-y-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                                <Scale size={15} className="text-violet-400" /> Base Unit <span className="text-rose-500">*</span>
                            </label>
                            <Combobox
                                options={units.map(u => ({ value: u.id, label: `${u.name} (${u.code})` }))}
                                value={formData.baseUnitId}
                                onChange={val => setFormData({ ...formData, baseUnitId: val })}
                                placeholder="Select Unit..."
                                searchPlaceholder="Search unit..."
                                forceDark={true}
                                className="p-3.5 text-base font-semibold"
                            />
                        </div>
                    </div>

                    {/* Product Behavior */}
                    <div className="border-t border-slate-800 pt-8 bg-slate-950/50 space-y-4">
                        <h3 className="text-xl font-black text-white tracking-tight">Product Behavior</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <label className="flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/50 cursor-pointer hover:border-violet-500/50 hover:bg-slate-900 transition-all">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 rounded-md border-slate-700 text-violet-500 focus:ring-violet-500 bg-slate-800"
                                    checked={formData.canBeSold}
                                    onChange={(e) => setFormData({...formData, canBeSold: e.target.checked})}
                                />
                                <div>
                                    <div className="text-base font-bold text-white">Can be Sold</div>
                                    <div className="text-xs text-slate-400 mt-0.5">Available in Sales Invoices</div>
                                </div>
                            </label>
                            
                            <label className="flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/50 cursor-pointer hover:border-violet-500/50 hover:bg-slate-900 transition-all">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 rounded-md border-slate-700 text-violet-500 focus:ring-violet-500 bg-slate-800"
                                    checked={formData.canBePurchased}
                                    onChange={(e) => setFormData({...formData, canBePurchased: e.target.checked})}
                                />
                                <div>
                                    <div className="text-base font-bold text-white">Can be Purchased</div>
                                    <div className="text-xs text-slate-400 mt-0.5">Available in Purchase Invoices</div>
                                </div>
                            </label>

                            <label className="flex flex-col p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-violet-500/50 hover:bg-slate-900 transition-all">
                                <div className="flex items-center gap-3.5 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 rounded-md border-slate-700 text-violet-500 focus:ring-violet-500 bg-slate-800"
                                        checked={formData.isManufactured}
                                        onChange={(e) => setFormData({...formData, isManufactured: e.target.checked})}
                                    />
                                    <div>
                                        <div className="text-base font-bold text-white">Is Manufactured</div>
                                        <div className="text-xs text-slate-400 mt-0.5">Produced internally via Job Work</div>
                                    </div>
                                </div>
                                {formData.isManufactured && (
                                    <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5">
                                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                                            Stage <span className="text-rose-500">*</span>
                                        </label>
                                        <select
                                            className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-violet-500 text-sm font-semibold"
                                            value={formData.stage}
                                            onChange={e => setFormData({ ...formData, stage: e.target.value })}
                                            required={formData.isManufactured}
                                        >
                                            <option value="">Select Stage...</option>
                                            <option value="RAW">RAW (e.g. Yarn)</option>
                                            <option value="GREY">GREY (e.g. Kora Fabric)</option>
                                            <option value="FINISH">FINISH (e.g. Dyed Fabric)</option>
                                        </select>
                                    </div>
                                )}
                            </label>

                            <label className="flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/50 cursor-pointer hover:border-violet-500/50 hover:bg-slate-900 transition-all">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 rounded-md border-slate-700 text-violet-500 focus:ring-violet-500 bg-slate-800"
                                    checked={formData.isService}
                                    onChange={(e) => setFormData({...formData, isService: e.target.checked})}
                                />
                                <div>
                                    <div className="text-base font-bold text-white">Is Service</div>
                                    <div className="text-xs text-slate-400 mt-0.5">Dyeing, Weaving, Freight (No Stock)</div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Variants Section */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <Layers size={20} className="text-violet-500" /> Product Variants
                                </h2>
                                <p className="text-xs text-slate-500 font-medium mt-1">Add variations like colors or sizes for this product.</p>
                            </div>
                            
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner w-full md:w-80">
                                <input
                                    type="text"
                                    className="flex-1 bg-transparent px-3 py-1 outline-none text-sm font-medium"
                                    placeholder="Variant name (e.g. Red, XL)"
                                    value={variantInput}
                                    onChange={e => setVariantInput(e.target.value)}
                                    onKeyDown={handleAddVariant}
                                />
                                <button
                                    type="button"
                                    onClick={handleAddVariant}
                                    disabled={!variantInput.trim()}
                                    className="bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 p-2 rounded-lg hover:bg-violet-200 dark:hover:bg-violet-500/30 transition-colors disabled:opacity-50"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        {formData.variants.length === 0 ? (
                            <div className="text-center p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                <Layers size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                                <p className="text-slate-500 font-bold">No variants added.</p>
                                <p className="text-slate-400 text-sm mt-1">This will be treated as a standard, single-item product.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                <div className="grid grid-cols-12 gap-4 px-4 text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                                    <div className="col-span-5">Variant Name</div>
                                    <div className="col-span-4">SKU Suffix</div>
                                    <div className="col-span-2 text-right">Price Override</div>
                                    <div className="col-span-1 text-center">Act</div>
                                </div>

                                {formData.variants.map((v: Variant, i: number) => (
                                    <div key={i} className="grid grid-cols-12 gap-4 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-all hover:border-violet-200 dark:hover:border-violet-500/30">
                                        <div className="col-span-5">
                                            <input
                                                type="text"
                                                className="w-full bg-transparent border-b border-transparent focus:border-violet-500 focus:outline-none p-1 font-bold text-sm text-slate-800 dark:text-slate-200 transition-colors"
                                                value={v.name}
                                                onChange={e => handleVariantChange(i, 'name', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-4 flex items-center">
                                            <span className="text-xs text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded-l-md border border-r-0 border-slate-300 dark:border-slate-700">
                                                {formData.code || 'SKU'}
                                            </span>
                                            <input
                                                type="text"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-r-md p-1 font-mono text-xs outline-none"
                                                value={v.sku}
                                                onChange={e => handleVariantChange(i, 'sku', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-lg p-1.5 text-right font-medium text-sm outline-none"
                                                value={v.price || ''}
                                                placeholder="Base"
                                                onChange={e => handleVariantChange(i, 'price', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-center">
                                            <button
                                                type="button"
                                                onClick={() => removeVariant(i)}
                                                className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 p-2 rounded-xl transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Opening Stock / Opening Service (Optional) Card */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                                <Layers size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white">
                                    {formData.isService ? "Opening Service Balance" : "Opening Stock"}
                                </h3>
                                <p className="text-xs text-slate-400 font-medium">
                                    {formData.isService 
                                        ? "Record initial unconsumed service quantity, rate, and party / bill info" 
                                        : "Record initial stock balance, origin, and valuation immediately"}
                                </p>
                            </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                {enableOpeningStock ? 'Enabled' : (formData.isService ? 'Add Opening Balance' : 'Add Opening Stock')}
                            </span>
                            <div 
                                onClick={() => setEnableOpeningStock(!enableOpeningStock)}
                                className={cn(
                                    "w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer",
                                    enableOpeningStock ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                                )}
                            >
                                <div className={cn(
                                    "w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
                                    enableOpeningStock ? "translate-x-6" : "translate-x-0"
                                )} />
                            </div>
                        </label>
                    </div>

                    {enableOpeningStock && (
                        <div className="p-6 space-y-5 animate-in fade-in duration-200">
                            {formData.isService ? (
                                /* SERVICE OPENING BALANCE: Multi-Invoices / Multi-Vendors Support */
                                <div className="space-y-4">
                                    <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <Info size={18} className="text-amber-600 shrink-0" />
                                            <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                                                Services (Dyeing, Printing, Weaving, Knitting) are not physical inventory, so no Godown/Warehouse or Stage is required. You can add multiple opening bills/invoices from different vendors or batches below.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleAddServiceInvoice}
                                            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20 active:scale-95 transition-all shrink-0"
                                        >
                                            <Plus size={14} /> Add Another Bill / Invoice
                                        </button>
                                    </div>

                                    {serviceInvoices.map((inv, index) => {
                                        const rowVal = (Number(inv.qty) || 0) * (Number(inv.costRate) || 0);
                                        return (
                                            <div key={inv.id} className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3 relative">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/50 uppercase tracking-wider">
                                                        Bill / Invoice #{index + 1}
                                                    </span>
                                                    {serviceInvoices.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveServiceInvoice(inv.id)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                                            title="Remove invoice"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                                            Opening Date <span className="text-rose-500">*</span>
                                                        </label>
                                                        <input
                                                            type="date"
                                                            className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                                            value={inv.date}
                                                            onChange={e => handleServiceInvoiceChange(inv.id, 'date', e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5 md:col-span-2">
                                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                                            Party / Vendor Info or Bill # <span className="text-slate-400 font-normal lowercase">(e.g. Master Dyeing / Inv # 1042)</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. Master Dyeing / Inv # 1042 / Opening Balance"
                                                            className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                                            value={inv.partyInfo}
                                                            onChange={e => handleServiceInvoiceChange(inv.id, 'partyInfo', e.target.value)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                                            Unconsumed Quantity <span className="text-rose-500">*</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            placeholder="0.00"
                                                            className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-right"
                                                            value={inv.qty}
                                                            onChange={e => handleServiceInvoiceChange(inv.id, 'qty', e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                                            Service Rate (PKR) <span className="text-rose-500">*</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            placeholder="Rate / unit"
                                                            className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-right"
                                                            value={inv.costRate}
                                                            onChange={e => handleServiceInvoiceChange(inv.id, 'costRate', e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                                            Total Value (PKR)
                                                        </label>
                                                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-black text-right text-sm">
                                                            Rs. {rowVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Action Bar & Combined Totals */}
                                    <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 flex flex-wrap items-center justify-between gap-4">
                                        <button
                                            type="button"
                                            onClick={handleAddServiceInvoice}
                                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                                        >
                                            <Plus size={15} /> Add Another Bill / Invoice
                                        </button>

                                        <div className="flex items-center gap-6 text-right">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Invoices</p>
                                                <p className="text-sm font-black text-slate-800 dark:text-slate-200 font-mono">
                                                    {serviceInvoices.length}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Unconsumed Qty</p>
                                                <p className="text-sm font-black text-slate-800 dark:text-slate-200 font-mono">
                                                    {totalServiceQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Combined Opening Value</p>
                                                <p className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                                    Rs. {totalServiceValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* PHYSICAL GOODS OPENING STOCK */
                                <div className="space-y-5">
                                    {/* Warehouse & Date */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                                <Warehouse size={14} className="text-indigo-500" /> Target Warehouse <span className="text-slate-400 font-normal lowercase">(optional)</span>
                                            </label>
                                            <select
                                                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                                value={openingStock.warehouseId}
                                                onChange={e => setOpeningStock({ ...openingStock, warehouseId: e.target.value })}
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
                                                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                                value={openingStock.date}
                                                onChange={e => setOpeningStock({ ...openingStock, date: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Production Stage */}
                                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                            <Layers size={14} className="text-indigo-500" /> Stock Stage <span className="text-rose-500">*</span>
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
                                                    onClick={() => setOpeningStock({ ...openingStock, stage: s.id })}
                                                    className={cn(
                                                        "p-2.5 rounded-xl border text-left transition-all",
                                                        openingStock.stage === s.id
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

                                    {/* Origin: Local vs Import */}
                                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                            <Globe size={14} className="text-indigo-500" /> Stock Origin <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setOpeningStock({ ...openingStock, origin: "LOCAL", isEFS: false })}
                                                className={cn(
                                                    "p-3 rounded-xl border text-left transition-all",
                                                    openingStock.origin === "LOCAL"
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
                                                onClick={() => setOpeningStock({ ...openingStock, origin: "IMPORT" })}
                                                className={cn(
                                                    "p-3 rounded-xl border text-left transition-all",
                                                    openingStock.origin === "IMPORT"
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

                                        {openingStock.origin === "IMPORT" && (
                                            <div className="mt-3 p-3.5 rounded-2xl bg-sky-500/5 border border-sky-500/20 space-y-2 animate-in fade-in duration-200">
                                                <label className="text-xs font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                                                    <ShieldAlert size={14} /> Customs Scheme
                                                </label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <label className={cn(
                                                        "flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs font-bold transition-all",
                                                        openingStock.isEFS
                                                            ? "bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400"
                                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                                    )}>
                                                        <input
                                                            type="radio"
                                                            name="newProdIsEFS"
                                                            checked={openingStock.isEFS === true}
                                                            onChange={() => setOpeningStock({ ...openingStock, isEFS: true })}
                                                            className="text-amber-600 focus:ring-amber-500"
                                                        />
                                                        <div>
                                                            <div>EFS (Duty Exempted)</div>
                                                            <div className="text-[10px] text-amber-500 font-normal">Production consumption only</div>
                                                        </div>
                                                    </label>

                                                    <label className={cn(
                                                        "flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs font-bold transition-all",
                                                        !openingStock.isEFS
                                                            ? "bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-400"
                                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                                    )}>
                                                        <input
                                                            type="radio"
                                                            name="newProdIsEFS"
                                                            checked={openingStock.isEFS === false}
                                                            onChange={() => setOpeningStock({ ...openingStock, isEFS: false })}
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

                                    {/* Physical Quantity, Book Rate, Total */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                                Quantity <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="any"
                                                min="0"
                                                placeholder="0.00"
                                                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold text-right"
                                                value={openingStock.qty}
                                                onChange={e => setOpeningStock({ ...openingStock, qty: e.target.value })}
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
                                                placeholder="Cost / unit"
                                                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold text-right"
                                                value={openingStock.costRate}
                                                onChange={e => setOpeningStock({ ...openingStock, costRate: e.target.value })}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Total Value (PKR)
                                            </label>
                                            <div className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-bold text-right">
                                                Rs. {((Number(openingStock.qty) || 0) * (Number(openingStock.costRate) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* ITP Rate (Import only) */}
                                    {openingStock.origin === "IMPORT" && (
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
                                                    value={openingStock.itpRate}
                                                    onChange={e => setOpeningStock({ ...openingStock, itpRate: e.target.value })}
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                    Total ITP Value (PKR)
                                                </label>
                                                <div className="w-full p-2.5 rounded-xl bg-white/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-300 text-sm font-bold text-right">
                                                    Rs. {((Number(openingStock.qty) || 0) * (Number(openingStock.itpRate) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                            placeholder={openingStock.origin === "IMPORT" ? "e.g. GD-KAPE-HC-12345" : "e.g. LOT-2026-001"}
                                            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                                            value={openingStock.batchNo}
                                            onChange={e => setOpeningStock({ ...openingStock, batchNo: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-end gap-4">
                    <div className="flex gap-3 w-full md:w-auto">
                        <button 
                            onClick={() => router.back()}
                            className="flex-1 md:flex-none px-6 py-4 rounded-2xl font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors uppercase tracking-widest text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={loading || !formData.name?.trim() || !formData.categoryId || !formData.baseUnitId || !formData.hsCode?.trim()}
                            className={cn(
                                "flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-white bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 shadow-xl shadow-violet-500/20 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2",
                                (loading || !formData.name?.trim() || !formData.categoryId || !formData.baseUnitId || !formData.hsCode?.trim()) && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <Save size={18} />
                            {loading ? 'Saving...' : 'Save Product'}
                        </button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
