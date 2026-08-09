"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
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
    Info
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
        variants: [] as Variant[],
        // Notice: Accounting fields are omitted from UI, backend will handle or we'll set it at Category level later
    });

    const [variantInput, setVariantInput] = useState('');

    // Dropdown Data
    const [categories, setCategories] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);

    useEffect(() => {
        fetchDropdowns();
    }, []);

    const fetchDropdowns = async () => {
        try {
            const [catRes, unitRes] = await Promise.all([
                authenticatedFetch('/api/inventory/categories'),
                authenticatedFetch('/api/admin/units')
            ]);

            if (catRes.ok) {
                const catJson = await catRes.json();
                if (catJson.success) setCategories(catJson.data);
            }
            if (unitRes.ok) {
                const unitJson = await unitRes.json();
                if (unitJson.success) setUnits(unitJson.data);
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
        
        if (!formData.name || !formData.categoryId || !formData.baseUnitId) {
            showNotification('error', 'Please fill in all required fields (Name, Category, Unit).');
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
                showNotification('success', 'Product created successfully!');
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
            <div className="max-w-5xl mx-auto space-y-6 pb-32 animate-in fade-in duration-500">
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
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl shadow-violet-500/10 relative overflow-hidden border border-slate-800">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                        <div className="col-span-12 md:col-span-5 space-y-4">
                            <div>
                                <h1 className="text-4xl font-black text-white tracking-tight">New Product</h1>
                                <p className="text-slate-400 font-medium mt-1">Add an item to your inventory catalog</p>
                            </div>
                            <div className="inline-flex items-center gap-2 bg-violet-500/10 text-violet-400 border border-violet-500/20 px-3 py-1.5 rounded-lg text-xs font-bold">
                                <Info size={14} /> Accounting mapping has been simplified
                            </div>
                        </div>
                        
                        <div className="col-span-12 md:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Barcode size={14} /> Product Code (SKU)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Auto-generated if empty"
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-600 font-mono text-sm"
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <PackageSearch size={14} /> Product Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Premium T-Shirt"
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-violet-500"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Tags size={14} /> Category <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-violet-500"
                                    value={formData.categoryId}
                                    onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                                >
                                    <option value="">Select Category...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Scale size={14} /> Base Unit <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-violet-500"
                                    value={formData.baseUnitId}
                                    onChange={e => setFormData({ ...formData, baseUnitId: e.target.value })}
                                >
                                    <option value="">Select Unit...</option>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                                </select>
                            </div>
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
            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-end gap-4">
                    <div className="flex gap-3 w-full md:w-auto">
                        <button 
                            onClick={() => router.back()}
                            className="flex-1 md:flex-none px-6 py-4 rounded-2xl font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors uppercase tracking-widest text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={loading || !formData.name || !formData.categoryId || !formData.baseUnitId}
                            className={cn(
                                "flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-white bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 shadow-xl shadow-violet-500/20 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2",
                                (loading || !formData.name || !formData.categoryId || !formData.baseUnitId) && "opacity-70 cursor-not-allowed"
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
