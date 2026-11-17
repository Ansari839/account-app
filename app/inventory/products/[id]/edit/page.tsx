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
    Info,
    Warehouse,
    Calendar,
    Globe,
    ShieldAlert,
    CheckCircle2
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

interface Variant {
    id?: string;
    name: string;
    sku: string;
    price: number;
}

export interface PhysicalStockEntry {
    id: string; // If starts with "new-", it's newly added in edit; otherwise DB UUID
    isExistingDb?: boolean;
    warehouseId: string;
    stage: 'RAW' | 'GREY' | 'FINISH';
    origin: 'LOCAL' | 'IMPORT';
    isEFS: boolean;
    qty: string;
    costRate: string;
    itpRate: string;
    batchNo: string;
    date: string;
}

export interface ServiceInvoiceEntry {
    id: string;
    isExistingDb?: boolean;
    date: string;
    partyInfo: string;
    qty: string;
    costRate: string;
}

export default function EditProductPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { showNotification } = useNotifications();
    const [loading, setLoading] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(true);
    const { id } = React.use(params as unknown as Promise<any>);

    // Form State
    const [formData, setFormData] = useState<any>({
        code: '', 
        name: '', 
        categoryId: '', 
        baseUnitId: '', 
        hsCode: '',
        canBeSold: true,
        canBePurchased: true,
        isManufactured: false,
        stage: '', // RAW, GREY, FINISH
        isService: false,
        variants: [] as Variant[],
    });

    const [variantInput, setVariantInput] = useState('');

    // Dropdown Data
    const [categories, setCategories] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);

    // Opening Stock State
    const [hasOpeningStock, setHasOpeningStock] = useState(false);
    const [physicalStockEntries, setPhysicalStockEntries] = useState<PhysicalStockEntry[]>([]);
    const [serviceInvoices, setServiceInvoices] = useState<ServiceInvoiceEntry[]>([]);
    const [deletedOpeningIds, setDeletedOpeningIds] = useState<string[]>([]);

    // Helper to add physical stock lot
    const handleAddPhysicalStockEntry = () => {
        setPhysicalStockEntries(prev => [
            ...prev,
            {
                id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                isExistingDb: false,
                warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
                stage: (formData.stage as any) || 'RAW',
                origin: 'LOCAL',
                isEFS: false,
                qty: '',
                costRate: '',
                itpRate: '',
                batchNo: '',
                date: new Date().toISOString().split('T')[0]
            }
        ]);
        setHasOpeningStock(true);
    };

    const handleRemovePhysicalStockEntry = (entryId: string) => {
        const entry = physicalStockEntries.find(e => e.id === entryId);
        if (entry && entry.isExistingDb) {
            setDeletedOpeningIds(prev => [...prev, entry.id]);
        }
        setPhysicalStockEntries(prev => prev.filter(e => e.id !== entryId));
    };

    const handlePhysicalStockEntryChange = (entryId: string, field: keyof PhysicalStockEntry, value: any) => {
        setPhysicalStockEntries(prev => prev.map(e => {
            if (e.id !== entryId) return e;
            const updated = { ...e, [field]: value };
            if (field === 'origin' && value === 'LOCAL') {
                updated.isEFS = false;
                updated.itpRate = '';
            }
            return updated;
        }));
    };

    // Helper to add service invoice
    const handleAddServiceInvoice = () => {
        setServiceInvoices(prev => [
            ...prev,
            { 
                id: `new-${Date.now()}`, 
                isExistingDb: false,
                date: new Date().toISOString().split('T')[0], 
                partyInfo: '', 
                qty: '', 
                costRate: '' 
            }
        ]);
        setHasOpeningStock(true);
    };

    const handleRemoveServiceInvoice = (invId: string) => {
        const inv = serviceInvoices.find(s => s.id === invId);
        if (inv && inv.isExistingDb) {
            setDeletedOpeningIds(prev => [...prev, inv.id]);
        }
        setServiceInvoices(prev => prev.filter(s => s.id !== invId));
    };

    const handleServiceInvoiceChange = (invId: string, field: string, value: string) => {
        setServiceInvoices(prev => prev.map(inv => inv.id === invId ? { ...inv, [field]: value } : inv));
    };

    const totalPhysicalQty = physicalStockEntries.reduce((acc, entry) => acc + (Number(entry.qty) || 0), 0);
    const totalPhysicalValue = physicalStockEntries.reduce((acc, entry) => acc + ((Number(entry.qty) || 0) * (Number(entry.costRate) || 0)), 0);

    const totalServiceQty = serviceInvoices.reduce((acc, inv) => acc + (Number(inv.qty) || 0), 0);
    const totalServiceValue = serviceInvoices.reduce((acc, inv) => acc + ((Number(inv.qty) || 0) * (Number(inv.costRate) || 0)), 0);

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const [catRes, unitRes, whRes, prodRes, openRes] = await Promise.all([
                authenticatedFetch('/api/inventory/categories'),
                authenticatedFetch('/api/admin/units'),
                authenticatedFetch('/api/inventory/warehouses'),
                authenticatedFetch(`/api/inventory/products/${id}`),
                authenticatedFetch(`/api/inventory/opening?productId=${id}`)
            ]);

            let loadedWarehouses: any[] = [];
            if (whRes.ok) {
                const whJson = await whRes.json();
                if (whJson.success) {
                    loadedWarehouses = whJson.data || [];
                    setWarehouses(loadedWarehouses);
                }
            }
            if (catRes.ok) {
                const catJson = await catRes.json();
                if (catJson.success) setCategories(catJson.data || []);
            }
            if (unitRes.ok) {
                const unitJson = await unitRes.json();
                if (unitJson.success) setUnits(unitJson.data || []);
            }

            let isServiceProduct = false;
            let currentStage = '';

            if (prodRes.ok) {
                const prodJson = await prodRes.json();
                if (prodJson.success) {
                    const p = prodJson.data;
                    isServiceProduct = Boolean(p.isService);
                    currentStage = p.stage || '';
                    setFormData({
                        code: p.code || '', 
                        name: p.name || '', 
                        categoryId: p.categoryId || '', 
                        baseUnitId: p.baseUnitId || '', 
                        hsCode: p.hsCode || '',
                        canBeSold: p.canBeSold,
                        canBePurchased: p.canBePurchased,
                        isManufactured: Boolean(p.isManufactured),
                        stage: p.stage || '',
                        isService: isServiceProduct,
                        variants: p.variants || [],
                    });
                }
            }

            // Load existing opening stock records for this product
            if (openRes.ok) {
                const openJson = await openRes.json();
                if (openJson.success && Array.isArray(openJson.data) && openJson.data.length > 0) {
                    setHasOpeningStock(true);
                    if (isServiceProduct) {
                        const existingSvcs: ServiceInvoiceEntry[] = openJson.data.map((item: any) => ({
                            id: item.id,
                            isExistingDb: true,
                            date: item.date || new Date().toISOString().split('T')[0],
                            partyInfo: item.rawBatchNo || item.batchNo || '',
                            qty: String(item.qty || ''),
                            costRate: String(item.costRate || '')
                        }));
                        setServiceInvoices(existingSvcs);
                    } else {
                        const existingLots: PhysicalStockEntry[] = openJson.data.map((item: any) => ({
                            id: item.id,
                            isExistingDb: true,
                            warehouseId: item.warehouseId || (loadedWarehouses[0]?.id || ''),
                            stage: item.stage || (currentStage as any) || 'RAW',
                            origin: item.origin || 'LOCAL',
                            isEFS: Boolean(item.isEFS),
                            qty: String(item.qty || ''),
                            costRate: String(item.costRate || ''),
                            itpRate: item.itpRate ? String(item.itpRate) : '',
                            batchNo: item.rawBatchNo || item.batchNo || '',
                            date: item.date || new Date().toISOString().split('T')[0]
                        }));
                        setPhysicalStockEntries(existingLots);
                    }
                } else {
                    // No existing opening stock
                    setHasOpeningStock(false);
                    setPhysicalStockEntries([]);
                    setServiceInvoices([]);
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            showNotification('error', "Failed to load product details.");
        } finally {
            setIsPageLoading(false);
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

        if (formData.isManufactured && !formData.stage) {
            showNotification('error', 'Please select a Manufacturing Stage (RAW, GREY, or FINISH).');
            return;
        }

        setLoading(true);

        const payload = {
            ...formData,
            categoryId: formData.categoryId || null,
            baseUnitId: formData.baseUnitId || null,
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
                id: v.id,
                name: v.name,
                sku: v.sku,
                price: Number(v.price) || 0
            }))
        };

        try {
            // 1. Update Product Details
            const res = await authenticatedFetch(`/api/inventory/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                showNotification('error', json.error || "Failed to update product");
                setLoading(false);
                return;
            }

            // 2. Handle Deleted Opening Stock Entries
            for (const delId of deletedOpeningIds) {
                try {
                    await authenticatedFetch(`/api/inventory/opening?id=${delId}`, {
                        method: 'DELETE'
                    });
                } catch (delErr) {
                    console.error("Failed to delete opening stock lot:", delErr);
                }
            }

            // 3. Handle Physical Stock Entries (Create new or Update existing)
            if (!formData.isService && hasOpeningStock) {
                for (const entry of physicalStockEntries) {
                    const qtyNum = Number(entry.qty);
                    if (qtyNum > 0) {
                        if (entry.isExistingDb) {
                            // Update existing opening entry
                            await authenticatedFetch('/api/inventory/opening', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    id: entry.id,
                                    warehouseId: entry.warehouseId || null,
                                    stage: entry.stage || formData.stage || 'RAW',
                                    origin: entry.origin,
                                    isEFS: entry.origin === 'IMPORT' ? Boolean(entry.isEFS) : false,
                                    qty: qtyNum,
                                    costRate: Number(entry.costRate) || 0,
                                    itpRate: entry.origin === 'IMPORT' ? (Number(entry.itpRate) || null) : null,
                                    batchNo: entry.batchNo || null,
                                    date: entry.date
                                })
                            });
                        } else {
                            // Create new opening entry
                            await authenticatedFetch('/api/inventory/opening', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    productId: id,
                                    warehouseId: entry.warehouseId || null,
                                    stage: entry.stage || formData.stage || 'RAW',
                                    origin: entry.origin,
                                    isEFS: entry.origin === 'IMPORT' ? Boolean(entry.isEFS) : false,
                                    qty: qtyNum,
                                    costRate: Number(entry.costRate) || 0,
                                    itpRate: entry.origin === 'IMPORT' ? (Number(entry.itpRate) || null) : null,
                                    batchNo: entry.batchNo || null,
                                    date: entry.date
                                })
                            });
                        }
                    }
                }
            }

            // 4. Handle Service Invoices if isService
            if (formData.isService && hasOpeningStock) {
                for (const inv of serviceInvoices) {
                    const qtyNum = Number(inv.qty);
                    if (qtyNum > 0) {
                        if (inv.isExistingDb) {
                            await authenticatedFetch('/api/inventory/opening', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    id: inv.id,
                                    warehouseId: null,
                                    stage: 'RAW',
                                    origin: 'LOCAL',
                                    isEFS: false,
                                    qty: qtyNum,
                                    costRate: Number(inv.costRate) || 0,
                                    batchNo: inv.partyInfo || null,
                                    date: inv.date
                                })
                            });
                        } else {
                            await authenticatedFetch('/api/inventory/opening', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    productId: id,
                                    warehouseId: null,
                                    stage: 'RAW',
                                    origin: 'LOCAL',
                                    isEFS: false,
                                    qty: qtyNum,
                                    costRate: Number(inv.costRate) || 0,
                                    batchNo: inv.partyInfo || null,
                                    date: inv.date
                                })
                            });
                        }
                    }
                }
            }

            showNotification('success', 'Product and Opening Stock updated successfully!');
            router.push('/inventory/products');
        } catch (err: any) {
            console.error("Save product error:", err);
            showNotification('error', "An error occurred while saving the product");
        } finally {
            setLoading(false);
        }
    };

    if (isPageLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-[50vh] text-slate-400 font-bold">
                    Loading product details...
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-5xl mx-auto space-y-6 pb-32 animate-in fade-in duration-500">
                {/* Header Action Bar */}
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={18} />
                        <span className="font-semibold text-sm">Back to Products</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            {formData.code || 'NO-SKU'}
                        </span>
                        {formData.stage && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Stage: {formData.stage}
                            </span>
                        )}
                    </div>
                </div>

                {/* Form Container */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-xl">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-white">Edit Product</h2>
                        <p className="text-slate-400 text-sm mt-1">Update item properties, manufacturing stages, and opening stock lots.</p>
                    </div>

                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <PackageSearch size={16} /> Basic Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    Item Code / SKU <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-violet-500 font-mono text-sm"
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    Product Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. 75/36 DTY Polyester Yarn"
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    Category <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                                    value={formData.categoryId}
                                    onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                                >
                                    <option value="">Select Category...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    Base Unit of Measure <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                                    value={formData.baseUnitId}
                                    onChange={e => setFormData({ ...formData, baseUnitId: e.target.value })}
                                >
                                    <option value="">Select Unit...</option>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    <Barcode size={14} /> HS Code <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. 5402.3300"
                                    className="w-full p-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-600 font-mono text-sm"
                                    value={formData.hsCode || ''}
                                    onChange={e => setFormData({ ...formData, hsCode: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Product Behavior & Manufacturing Stages */}
                    <div className="border-t border-slate-800 pt-6 space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Product Behavior & Production Stage</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/50 cursor-pointer hover:border-violet-500/50 transition-colors">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 rounded border-slate-700 text-violet-500 focus:ring-violet-500 bg-slate-800"
                                    checked={formData.canBeSold}
                                    onChange={(e) => setFormData({...formData, canBeSold: e.target.checked})}
                                />
                                <div>
                                    <div className="text-sm font-bold text-white">Can be Sold</div>
                                    <div className="text-xs text-slate-500">Sales Invoices</div>
                                </div>
                            </label>
                            
                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/50 cursor-pointer hover:border-violet-500/50 transition-colors">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 rounded border-slate-700 text-violet-500 focus:ring-violet-500 bg-slate-800"
                                    checked={formData.canBePurchased}
                                    onChange={(e) => setFormData({...formData, canBePurchased: e.target.checked})}
                                />
                                <div>
                                    <div className="text-sm font-bold text-white">Can be Purchased</div>
                                    <div className="text-xs text-slate-500">Purchase Invoices</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/50 cursor-pointer hover:border-violet-500/50 transition-colors">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 rounded border-slate-700 text-violet-500 focus:ring-violet-500 bg-slate-800"
                                    checked={formData.isManufactured}
                                    onChange={(e) => setFormData({...formData, isManufactured: e.target.checked})}
                                />
                                <div>
                                    <div className="text-sm font-bold text-white">Is Manufactured</div>
                                    <div className="text-xs text-slate-500">Produced internally via Job Work</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/50 cursor-pointer hover:border-violet-500/50 transition-colors">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 rounded border-slate-700 text-violet-500 focus:ring-violet-500 bg-slate-800"
                                    checked={formData.isService}
                                    onChange={(e) => setFormData({...formData, isService: e.target.checked})}
                                />
                                <div>
                                    <div className="text-sm font-bold text-white">Is Service</div>
                                    <div className="text-xs text-slate-500">Dyeing, Weaving, Printing</div>
                                </div>
                            </label>
                        </div>

                        {/* Manufacturing Stage Dropdown (Fully Editable) */}
                        {formData.isManufactured && (
                            <div className="p-4 rounded-2xl bg-violet-950/20 border border-violet-500/30 space-y-2 animate-in fade-in duration-300">
                                <label className="block text-xs font-bold text-violet-300 uppercase tracking-wider flex items-center gap-2">
                                    <Layers size={14} className="text-violet-400" /> Manufacturing Stage <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    className="w-full p-3 rounded-xl bg-slate-950 border border-violet-500/40 text-white outline-none focus:ring-2 focus:ring-violet-500 text-sm font-bold uppercase tracking-wide"
                                    value={formData.stage || ''}
                                    onChange={e => setFormData({ ...formData, stage: e.target.value })}
                                    required={formData.isManufactured}
                                >
                                    <option value="">Select Production Stage...</option>
                                    <option value="RAW">RAW (e.g. Raw Yarn / Staple / Filament)</option>
                                    <option value="GREY">GREY (e.g. Loom Fabric / Kora Thaan)</option>
                                    <option value="FINISH">FINISH (e.g. Processed / Dyed / Printed Fabric / Garment)</option>
                                </select>
                                <p className="text-[11px] text-violet-300/80">
                                    Defines at which manufacturing workflow stage this product is created or consumed.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* OPENING STOCK SECTION (MULTI-LOT & MULTI-ORIGIN) */}
                    <div className="border-t border-slate-800 pt-6 space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <Scale size={18} className="text-indigo-400" />
                                    <span>Opening Stock & Lot Inventory</span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Manage opening stock lots by origin (Local vs Import EFS / Commercial), GD numbers, and cost rates.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    if (!hasOpeningStock) {
                                        setHasOpeningStock(true);
                                        if (formData.isService) {
                                            handleAddServiceInvoice();
                                        } else {
                                            handleAddPhysicalStockEntry();
                                        }
                                    } else {
                                        if (formData.isService) {
                                            handleAddServiceInvoice();
                                        } else {
                                            handleAddPhysicalStockEntry();
                                        }
                                    }
                                }}
                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
                            >
                                <Plus size={15} />
                                <span>+ Add Opening Stock Lot</span>
                            </button>
                        </div>

                        {hasOpeningStock && (
                            <div className="space-y-6 pt-2">
                                {formData.isService ? (
                                    /* SERVICE OPENING INVOICES */
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-800/40 text-xs text-indigo-300">
                                            Enter historical vendor conversion/process service invoices (e.g. Dyeing, Printing, Weaving) available for production offset.
                                        </div>

                                        <div className="space-y-3">
                                            {serviceInvoices.map((inv, idx) => (
                                                <div key={inv.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                                                    <div className="sm:col-span-3 space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Opening Date</label>
                                                        <input 
                                                            type="date"
                                                            value={inv.date}
                                                            onChange={e => handleServiceInvoiceChange(inv.id, 'date', e.target.value)}
                                                            className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-3 space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Vendor / Bill Details</label>
                                                        <input 
                                                            type="text"
                                                            placeholder="Vendor Name / Bill Ref"
                                                            value={inv.partyInfo}
                                                            onChange={e => handleServiceInvoiceChange(inv.id, 'partyInfo', e.target.value)}
                                                            className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-2 space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Quantity ({units.find(u => u.id === formData.baseUnitId)?.code || 'Unit'})</label>
                                                        <input 
                                                            type="number"
                                                            placeholder="0.00"
                                                            value={inv.qty}
                                                            onChange={e => handleServiceInvoiceChange(inv.id, 'qty', e.target.value)}
                                                            className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs text-right font-mono"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-2 space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Rate (PKR)</label>
                                                        <input 
                                                            type="number"
                                                            placeholder="0.00"
                                                            value={inv.costRate}
                                                            onChange={e => handleServiceInvoiceChange(inv.id, 'costRate', e.target.value)}
                                                            className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs text-right font-mono"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2 pt-4 sm:pt-0">
                                                        <div className="text-right">
                                                            <div className="text-[10px] text-slate-400">Total Value</div>
                                                            <div className="font-mono text-xs font-bold text-indigo-400">
                                                                Rs. {((Number(inv.qty) || 0) * (Number(inv.costRate) || 0)).toLocaleString()}
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveServiceInvoice(inv.id)}
                                                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex justify-between items-center p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                                            <span className="text-slate-400 font-bold uppercase">Combined Service Opening Value:</span>
                                            <span className="text-base font-black font-mono text-indigo-400">
                                                Rs. {totalServiceValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    /* PHYSICAL GOODS MULTI-LOT OPENING STOCK */
                                    <div className="space-y-6">
                                        <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-800/40 flex items-start gap-3">
                                            <Info size={18} className="text-indigo-400 mt-0.5 shrink-0" />
                                            <div className="text-xs text-indigo-200/90 leading-relaxed">
                                                <span className="font-bold">Multi-Origin Opening Stock:</span> Aap is item ke neechay Local, Import (EFS), aur Import (Non-EFS / Commercial) ke alag alag lots maintain kar saktay hain. Stock aur Production mein yeh apne apne rates aur origin tags ke sath show honge.
                                            </div>
                                        </div>

                                        {physicalStockEntries.length === 0 ? (
                                            <div className="text-center p-8 border-2 border-dashed border-slate-800 rounded-2xl space-y-2">
                                                <p className="text-sm font-bold text-slate-400">No opening stock lots added yet.</p>
                                                <button
                                                    type="button"
                                                    onClick={handleAddPhysicalStockEntry}
                                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all"
                                                >
                                                    <Plus size={15} /> Add Opening Stock Lot
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-5">
                                                {physicalStockEntries.map((entry, index) => {
                                                    const entryQty = Number(entry.qty) || 0;
                                                    const entryRate = Number(entry.costRate) || 0;
                                                    const entryValue = entryQty * entryRate;
                                                    const entryItp = Number(entry.itpRate) || 0;

                                                    return (
                                                        <div 
                                                            key={entry.id} 
                                                            className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-sm space-y-4 relative"
                                                        >
                                                            {/* Lot Header */}
                                                            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-slate-800 text-white">
                                                                        Lot #{index + 1}
                                                                    </span>

                                                                    {entry.origin === 'LOCAL' ? (
                                                                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                                            Local Stock
                                                                        </span>
                                                                    ) : entry.isEFS ? (
                                                                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wide bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                                                            Import (EFS Duty-Free)
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wide bg-sky-500/15 text-sky-400 border border-sky-500/30">
                                                                            Import (Non-EFS / Commercial)
                                                                        </span>
                                                                    )}

                                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                                                                        Stage: {entry.stage}
                                                                    </span>
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemovePhysicalStockEntry(entry.id)}
                                                                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                                                                    title="Remove this stock lot"
                                                                >
                                                                    <Trash2 size={15} />
                                                                    <span>Remove Lot</span>
                                                                </button>
                                                            </div>

                                                            {/* Origin Selector: Local vs Import */}
                                                            <div className="space-y-2">
                                                                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                                                    <Globe size={14} className="text-indigo-400" /> Stock Origin <span className="text-rose-500">*</span>
                                                                </label>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handlePhysicalStockEntryChange(entry.id, 'origin', 'LOCAL')}
                                                                        className={cn(
                                                                            "p-3 rounded-xl border text-left transition-all",
                                                                            entry.origin === "LOCAL"
                                                                                ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold shadow-sm"
                                                                                : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                                                                        )}
                                                                    >
                                                                        <div className="text-xs font-black uppercase flex items-center gap-1.5">
                                                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Local Stock
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400 mt-0.5">Purchased locally in Pakistan</div>
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handlePhysicalStockEntryChange(entry.id, 'origin', 'IMPORT')}
                                                                        className={cn(
                                                                            "p-3 rounded-xl border text-left transition-all",
                                                                            entry.origin === "IMPORT"
                                                                                ? "bg-sky-500/10 border-sky-500 text-sky-400 font-bold shadow-sm"
                                                                                : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                                                                        )}
                                                                    >
                                                                        <div className="text-xs font-black uppercase flex items-center gap-1.5">
                                                                            <span className="w-2 h-2 rounded-full bg-sky-500"></span> Import Stock
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400 mt-0.5">Imported under GD / Customs Scheme</div>
                                                                    </button>
                                                                </div>

                                                                {entry.origin === "IMPORT" && (
                                                                    <div className="mt-3 p-3.5 rounded-2xl bg-sky-950/20 border border-sky-500/30 space-y-2 animate-in fade-in duration-200">
                                                                        <label className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                                                                            <ShieldAlert size={14} /> Customs Scheme
                                                                        </label>
                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            <label className={cn(
                                                                                "flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs font-bold transition-all",
                                                                                entry.isEFS
                                                                                    ? "bg-amber-500/15 border-amber-500 text-amber-400 shadow-sm"
                                                                                    : "bg-slate-950 border-slate-800 text-slate-400"
                                                                            )}>
                                                                                <input
                                                                                    type="radio"
                                                                                    name={`isEFS_${entry.id}`}
                                                                                    checked={entry.isEFS === true}
                                                                                    onChange={() => handlePhysicalStockEntryChange(entry.id, 'isEFS', true)}
                                                                                    className="text-amber-500 focus:ring-amber-500"
                                                                                />
                                                                                <div>
                                                                                    <div>EFS (Duty Exempted)</div>
                                                                                    <div className="text-[10px] text-amber-400/80 font-normal">Export production only</div>
                                                                                </div>
                                                                            </label>

                                                                            <label className={cn(
                                                                                "flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs font-bold transition-all",
                                                                                !entry.isEFS
                                                                                    ? "bg-sky-500/15 border-sky-500 text-sky-400 shadow-sm"
                                                                                    : "bg-slate-950 border-slate-800 text-slate-400"
                                                                            )}>
                                                                                <input
                                                                                    type="radio"
                                                                                    name={`isEFS_${entry.id}`}
                                                                                    checked={entry.isEFS === false}
                                                                                    onChange={() => handlePhysicalStockEntryChange(entry.id, 'isEFS', false)}
                                                                                    className="text-sky-500 focus:ring-sky-500"
                                                                                />
                                                                                <div>
                                                                                    <div>Non-EFS (Commercial)</div>
                                                                                    <div className="text-[10px] text-slate-400 font-normal">Saleable locally or export</div>
                                                                                </div>
                                                                            </label>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Warehouse, Date, and Stage */}
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                                                                <div className="space-y-1.5">
                                                                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                                                        <Warehouse size={13} className="text-indigo-400" /> Warehouse
                                                                    </label>
                                                                    <select
                                                                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                                                        value={entry.warehouseId}
                                                                        onChange={e => handlePhysicalStockEntryChange(entry.id, 'warehouseId', e.target.value)}
                                                                    >
                                                                        <option value="">Default Warehouse (Auto)</option>
                                                                        {warehouses.map(w => (
                                                                            <option key={w.id} value={w.id}>{w.name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>

                                                                <div className="space-y-1.5">
                                                                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                                                        <Calendar size={13} className="text-indigo-400" /> Opening Date <span className="text-rose-500">*</span>
                                                                    </label>
                                                                    <input
                                                                        type="date"
                                                                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                                                        value={entry.date}
                                                                        onChange={e => handlePhysicalStockEntryChange(entry.id, 'date', e.target.value)}
                                                                    />
                                                                </div>

                                                                <div className="space-y-1.5">
                                                                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                                                        <Layers size={13} className="text-indigo-400" /> Stock Stage
                                                                    </label>
                                                                    <select
                                                                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold uppercase"
                                                                        value={entry.stage}
                                                                        onChange={e => handlePhysicalStockEntryChange(entry.id, 'stage', e.target.value)}
                                                                    >
                                                                        <option value="RAW">RAW (Yarn / Raw Material)</option>
                                                                        <option value="GREY">GREY (Loom / Kora Fabric)</option>
                                                                        <option value="FINISH">FINISH (Processed / Dyed Fabric)</option>
                                                                    </select>
                                                                </div>
                                                            </div>

                                                            {/* Quantity, Cost Rate, Total Value */}
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                                                                <div className="space-y-1.5">
                                                                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                                                        Quantity <span className="text-rose-500">*</span>
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        step="any"
                                                                        min="0"
                                                                        placeholder="0.00"
                                                                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold text-right font-mono"
                                                                        value={entry.qty}
                                                                        onChange={e => handlePhysicalStockEntryChange(entry.id, 'qty', e.target.value)}
                                                                    />
                                                                </div>

                                                                <div className="space-y-1.5">
                                                                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                                                        Book Rate (PKR) <span className="text-rose-500">*</span>
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        step="any"
                                                                        min="0"
                                                                        placeholder="Cost / unit"
                                                                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold text-right font-mono"
                                                                        value={entry.costRate}
                                                                        onChange={e => handlePhysicalStockEntryChange(entry.id, 'costRate', e.target.value)}
                                                                    />
                                                                </div>

                                                                <div className="space-y-1.5">
                                                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                                        Total Value (PKR)
                                                                    </label>
                                                                    <div className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-indigo-400 text-sm font-black font-mono text-right">
                                                                        Rs. {entryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* ITP Rate (Import only) */}
                                                            {entry.origin === "IMPORT" && (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-sky-950/20 border border-sky-500/20 animate-in fade-in duration-200">
                                                                    <div className="space-y-1.5">
                                                                        <label className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                                                                            Customs ITP Rate (PKR)
                                                                        </label>
                                                                        <input
                                                                            type="number"
                                                                            step="any"
                                                                            min="0"
                                                                            placeholder="Assessed + Duties / Qty"
                                                                            className="w-full p-2.5 rounded-xl bg-slate-950 border border-sky-500/40 text-white outline-none focus:ring-2 focus:ring-sky-500 text-sm font-mono text-right"
                                                                            value={entry.itpRate}
                                                                            onChange={e => handlePhysicalStockEntryChange(entry.id, 'itpRate', e.target.value)}
                                                                        />
                                                                    </div>

                                                                    <div className="space-y-1.5">
                                                                        <label className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                                                                            Total ITP Value (PKR)
                                                                        </label>
                                                                        <div className="w-full p-2.5 rounded-xl bg-slate-950 border border-sky-500/20 text-sky-400 text-sm font-bold font-mono text-right">
                                                                            Rs. {(entryQty * entryItp).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Lot / Batch / GD Number */}
                                                            <div className="space-y-1.5 pt-2 border-t border-slate-800">
                                                                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                                                    Lot # / Batch # / GD Number
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    placeholder={entry.origin === "IMPORT" ? (entry.isEFS ? "e.g. GD-KAPE-HC-12345 / EFS" : "e.g. GD-KAPE-HC-67890 / Commercial") : "e.g. LOT-2026-001"}
                                                                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                                                                    value={entry.batchNo}
                                                                    onChange={e => handlePhysicalStockEntryChange(entry.id, 'batchNo', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Action & Combined Totals */}
                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
                                            <button
                                                type="button"
                                                onClick={handleAddPhysicalStockEntry}
                                                className="w-full sm:w-auto px-5 py-3 rounded-xl border border-dashed border-indigo-500/60 hover:border-indigo-400 bg-indigo-950/20 hover:bg-indigo-950/40 text-indigo-400 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                                            >
                                                <Plus size={16} />
                                                <span>+ Add Another Opening Stock Lot / Origin</span>
                                            </button>

                                            <div className="flex items-center gap-6 text-right">
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Lots</p>
                                                    <p className="text-sm font-bold text-slate-200 font-mono">
                                                        {physicalStockEntries.length} {physicalStockEntries.length === 1 ? 'Lot' : 'Lots'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Combined Opening Qty</p>
                                                    <p className="text-sm font-bold text-slate-200 font-mono">
                                                        {totalPhysicalQty.toLocaleString()} {units.find(u => u.id === formData.baseUnitId)?.code || 'Units'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Combined Opening Value</p>
                                                    <p className="text-base font-black text-indigo-400 font-mono">
                                                        Rs. {totalPhysicalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Product Variants (Optional) */}
                    <div className="border-t border-slate-800 pt-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <Tags size={16} /> Product Variants
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">Add color, size, denier, or cut variations if applicable.</p>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Variant name (e.g. 75/72 Black)"
                                    className="p-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-violet-500 text-xs w-48"
                                    value={variantInput}
                                    onChange={e => setVariantInput(e.target.value)}
                                    onKeyDown={handleAddVariant}
                                />
                                <button
                                    type="button"
                                    onClick={handleAddVariant}
                                    className="p-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-1"
                                >
                                    <Plus size={14} /> Add
                                </button>
                            </div>
                        </div>

                        {formData.variants.length > 0 && (
                            <div className="space-y-2">
                                {formData.variants.map((v: Variant, i: number) => (
                                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                                        <span className="font-bold text-white w-1/3 truncate">{v.name}</span>
                                        <span className="font-mono text-slate-400 w-1/3 truncate">{formData.code}{v.sku}</span>
                                        <div className="flex items-center gap-2 w-1/3 justify-end">
                                            <input
                                                type="number"
                                                placeholder="Price"
                                                className="w-24 p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-right font-mono text-white text-xs"
                                                value={v.price || ''}
                                                onChange={e => handleVariantChange(i, 'price', parseFloat(e.target.value) || 0)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeVariant(i)}
                                                className="text-slate-500 hover:text-rose-400 p-1"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sticky Action Footer */}
                <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 z-40 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 shadow-2xl">
                    <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-end gap-4">
                        <div className="flex gap-3 w-full md:w-auto">
                            <button 
                                type="button"
                                onClick={() => router.back()}
                                className="flex-1 md:flex-none px-6 py-3.5 rounded-2xl font-bold text-slate-300 hover:bg-slate-800 transition-colors uppercase tracking-wider text-xs"
                            >
                                Cancel
                            </button>
                            <button 
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading || !formData.name?.trim() || !formData.categoryId || !formData.baseUnitId || !formData.hsCode?.trim()}
                                className={cn(
                                    "flex-1 md:flex-none px-8 py-3.5 rounded-2xl font-black text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-xl shadow-indigo-500/25 transition-all uppercase tracking-wider text-xs flex items-center justify-center gap-2",
                                    (loading || !formData.name?.trim() || !formData.categoryId || !formData.baseUnitId || !formData.hsCode?.trim()) && "opacity-70 cursor-not-allowed"
                                )}
                            >
                                <Save size={16} />
                                {loading ? 'Saving Changes...' : 'Update Product & Stock'}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </MainLayout>
    );
}