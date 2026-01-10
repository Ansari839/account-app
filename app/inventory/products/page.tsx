"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import { useRouter } from 'next/navigation';

interface ProductVariant {
    id: string;
    name: string;
    sku?: string;
    price?: number;
}

interface Account {
    id: string;
    code: string;
    name: string;
    type: string;
    isPosting: boolean;
}

interface Product {
    id: string;
    code: string;
    name: string;
    categoryId?: string;
    category?: { name: string };
    baseUnitId: string;
    baseUnit?: { name: string };
    variants?: ProductVariant[];
    openingStock?: number;
    inventoryAccountId?: string;
    cogsAccountId?: string;
    salesAccountId?: string;
    purchaseAccountId?: string;
}

export default function ProductsPage() {
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState<any>({
        code: '', name: '', categoryId: '', baseUnitId: '', variants: [],
        inventoryAccountId: '', cogsAccountId: '', salesAccountId: '', purchaseAccountId: ''
    });

    // Dropdown Data
    const [categories, setCategories] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);

    useEffect(() => {
        fetchProducts();
        fetchDropdowns();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch('/api/inventory/products');
            const json = await res.json();
            if (json.success) setProducts(json.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const fetchDropdowns = async () => {
        try {
            const [catRes, unitRes, accRes] = await Promise.all([
                authenticatedFetch('/api/inventory/categories'),
                authenticatedFetch('/api/admin/units'),
                authenticatedFetch('/api/accounts')
            ]);

            if (catRes.ok) {
                const catJson = await catRes.json();
                if (catJson.success) setCategories(catJson.data);
            }
            if (unitRes.ok) {
                const unitJson = await unitRes.json();
                if (unitJson.success) setUnits(unitJson.data);
            }
            if (accRes.ok) {
                const accJson = await accRes.json();
                // Check if wrapper exists or direct array
                // The API seems to return { accounts: [...] }
                const accData = accJson.accounts || accJson.data || [];
                setAccounts(accData);
            }
        } catch (error) {
            console.error("Error fetching dropdowns:", error);
        }
    };

    const handleVariantChange = (idx: number, field: string, value: string | number) => {
        const newVariants = [...(formData.variants || [])];
        newVariants[idx] = { ...newVariants[idx], [field]: value };
        setFormData({ ...formData, variants: newVariants });
    };

    const addVariant = () => {
        setFormData({ ...formData, variants: [...(formData.variants || []), { name: '', sku: '', price: 0 }] });
    };

    const removeVariant = (idx: number) => {
        const newVariants = [...(formData.variants || [])];
        newVariants.splice(idx, 1);
        setFormData({ ...formData, variants: newVariants });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const url = editingId
            ? `/api/inventory/products/${editingId}`
            : '/api/inventory/products';
        const method = editingId ? 'PUT' : 'POST';

        const payload = {
            ...formData,
            categoryId: formData.categoryId || null,
            baseUnitId: formData.baseUnitId || null,
            inventoryAccountId: formData.inventoryAccountId || null,
            cogsAccountId: formData.cogsAccountId || null,
            salesAccountId: formData.salesAccountId || null,
            purchaseAccountId: formData.purchaseAccountId || null,
            variants: formData.variants?.map((v: any) => ({
                ...v,
                price: Number(v.price) || 0
            }))
        };

        try {
            const res = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();

            if (res.ok && json.success) {
                setIsModalOpen(false);
                setEditingId(null);
                fetchProducts();
            } else {
                alert(json.error || "Failed to save product");
            }
        } catch (err) {
            console.error(err);
            alert("An error occurred while saving the product");
        }
    };

    const openEdit = (prod: Product) => {
        setEditingId(prod.id);
        setFormData({
            code: prod.code,
            name: prod.name,
            categoryId: prod.categoryId || '',
            baseUnitId: prod.baseUnitId || '',
            variants: prod.variants || [],
            inventoryAccountId: prod.inventoryAccountId || '',
            cogsAccountId: prod.cogsAccountId || '',
            salesAccountId: prod.salesAccountId || '',
            purchaseAccountId: prod.purchaseAccountId || ''
        });
        setIsModalOpen(true);
    };

    const columns: Column<Product>[] = [
        { header: 'P-Code', accessor: 'code' },
        { header: 'Product Name', accessor: 'name' },
        { header: 'Category', accessor: (row) => row.category?.name || '-' },
        { header: 'Base Unit', accessor: (row) => row.baseUnit?.name || '-' },
        { header: 'Variants', accessor: (row) => row.variants?.length || 0 },
        {
            header: 'Actions',
            accessor: (row) => (
                <div className="flex gap-2">
                    <button onClick={() => openEdit(row)} className="text-blue-500 hover:underline">Edit</button>
                    {/* Add Delete if needed */}
                </div>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Products</h1>
                    <p className="text-slate-500">Manage your product catalog and variants.</p>
                </div>

                <button
                    onClick={() => {
                        setEditingId(null);

                        // Default Accounting Config
                        const salesAcc = accounts.find(a => (a.name === 'Sales' || a.name === 'Sales Account') && a.type === 'INCOME' && a.isPosting);
                        const inventoryAcc = accounts.find(a => (a.name === 'Inventory' || a.name === 'Inventory Asset') && a.type === 'ASSET' && a.isPosting);
                        const cogsAcc = accounts.find(a => (a.name === 'Cost of Goods Sold' || a.name === 'COGS') && a.type === 'EXPENSE' && a.isPosting);
                        const purchaseAcc = accounts.find(a => (a.name === 'Purchases' || a.name === 'Purchase Account') && a.type === 'EXPENSE' && a.isPosting);

                        // Fallback logic if exact names not found
                        const defaultSales = salesAcc || accounts.find(a => a.type === 'INCOME' && a.isPosting);
                        const defaultInventory = inventoryAcc || accounts.find(a => a.type === 'ASSET' && a.name.includes('Inventory') && a.isPosting);
                        const defaultCogs = cogsAcc || accounts.find(a => a.type === 'EXPENSE' && (a.name.includes('Cost of') || a.name.includes('COGS')) && a.isPosting);
                        const defaultPurchase = purchaseAcc || defaultCogs || accounts.find(a => a.type === 'EXPENSE' && a.isPosting);

                        setFormData({
                            code: '', name: '', categoryId: '', baseUnitId: '', variants: [],
                            inventoryAccountId: defaultInventory?.id || '',
                            cogsAccountId: defaultCogs?.id || '',
                            salesAccountId: defaultSales?.id || '',
                            purchaseAccountId: defaultPurchase?.id || ''
                        });
                        setIsModalOpen(true);
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold"
                >
                    + New Product
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <DataTable
                    data={products}
                    columns={columns}
                    isLoading={loading}
                />
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] overflow-y-auto p-4">
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl w-[600px] max-h-[90vh] overflow-y-auto shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">{editingId ? 'Edit Product' : 'New Product'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1">Product Code (SKU)</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border rounded-lg dark:bg-slate-800 bg-slate-100 text-slate-500 cursor-not-allowed"
                                        value={formData.code || 'Auto-generated'}
                                        disabled={true}
                                        placeholder="Auto-generated"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Leave empty for auto-generation</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1">Product Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-2 border rounded-lg dark:bg-slate-800"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1">Category</label>
                                    <select
                                        className="w-full p-2 border rounded-lg dark:bg-slate-800"
                                        value={formData.categoryId}
                                        onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1">Base Unit</label>
                                    <select
                                        className="w-full p-2 border rounded-lg dark:bg-slate-800"
                                        required
                                        value={formData.baseUnitId}
                                        onChange={e => setFormData({ ...formData, baseUnitId: e.target.value })}
                                    >
                                        <option value="">Select Unit</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* ACCOUNTING SECTION */}
                            <div className="border-t pt-4 mt-4">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
                                    Accounting Configuration
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold mb-1 text-slate-500">Inventory Account (Asset)</label>
                                        <select
                                            className="w-full p-2 border rounded-lg dark:bg-slate-800 text-sm"
                                            value={formData.inventoryAccountId || ''}
                                            onChange={e => setFormData({ ...formData, inventoryAccountId: e.target.value })}
                                        >
                                            <option value="">None (Non-inventory)</option>
                                            {accounts.filter(a => a.type === 'ASSET' && a.isPosting).map(a => (
                                                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold mb-1 text-slate-500">Purchase Account (Expense)</label>
                                        <select
                                            className="w-full p-2 border rounded-lg dark:bg-slate-800 text-sm"
                                            value={formData.purchaseAccountId || ''}
                                            onChange={e => setFormData({ ...formData, purchaseAccountId: e.target.value })}
                                        >
                                            <option value="">Select Purchase Account</option>
                                            {accounts.filter(a => (a.type === 'EXPENSE' || a.type === 'ASSET') && a.isPosting).map(a => (
                                                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold mb-1 text-slate-500">Sales Account (Income)</label>
                                        <select
                                            className="w-full p-2 border rounded-lg dark:bg-slate-800 text-sm"
                                            value={formData.salesAccountId || ''}
                                            onChange={e => setFormData({ ...formData, salesAccountId: e.target.value })}
                                        >
                                            <option value="">Select Sales Account</option>
                                            {accounts.filter(a => a.type === 'INCOME' && a.isPosting).map(a => (
                                                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold mb-1 text-slate-500">COGS Account (Expense)</label>
                                        <select
                                            className="w-full p-2 border rounded-lg dark:bg-slate-800 text-sm"
                                            value={formData.cogsAccountId || ''}
                                            onChange={e => setFormData({ ...formData, cogsAccountId: e.target.value })}
                                        >
                                            <option value="">Select COGS Account</option>
                                            {accounts.filter(a => a.type === 'EXPENSE' && a.isPosting).map(a => (
                                                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>


                            {/* VARIANTS SECTION */}
                            <div className="border-t pt-6">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
                                    Product Variants
                                </h3>

                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        className="flex-1 p-2 border rounded-lg dark:bg-slate-800"
                                        placeholder="Type variant name (e.g. Red, XL) and press Enter"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const val = e.currentTarget.value.trim();
                                                if (val) {
                                                    const baseSku = formData.code || 'SKU';
                                                    const skuSuffix = `-${val.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
                                                    const newVariant = {
                                                        name: val,
                                                        sku: skuSuffix,
                                                        price: 0
                                                    };
                                                    setFormData({
                                                        ...formData,
                                                        variants: [...(formData.variants || []), newVariant]
                                                    });
                                                    e.currentTarget.value = '';
                                                }
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="bg-slate-100 dark:bg-slate-800 px-4 rounded-lg font-bold text-slate-600 dark:text-slate-300"
                                        onClick={() => {
                                            const input = document.querySelector('input[placeholder^="Type variant"]') as HTMLInputElement;
                                            if (input && input.value.trim()) {
                                                const val = input.value.trim();
                                                const skuSuffix = `-${val.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
                                                const newVariant = {
                                                    name: val,
                                                    sku: skuSuffix,
                                                    price: 0
                                                };
                                                setFormData({
                                                    ...formData,
                                                    variants: [...(formData.variants || []), newVariant]
                                                });
                                                input.value = '';
                                            }
                                        }}
                                    >
                                        Add
                                    </button>
                                </div>

                                {formData.variants?.length === 0 ? (
                                    <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                                        <p className="text-slate-500 text-sm">No variants added. This will be a standard product.</p>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                                                <tr>
                                                    <th className="p-3">Variant Name</th>
                                                    <th className="p-3">SKU Suffix</th>
                                                    <th className="p-3">Price Override</th>
                                                    <th className="p-3 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                {formData.variants?.map((v: any, i: number) => (
                                                    <tr key={i}>
                                                        <td className="p-2">
                                                            <input
                                                                type="text"
                                                                className="w-full bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none p-1"
                                                                value={v.name}
                                                                onChange={e => handleVariantChange(i, 'name', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="flex items-center text-slate-400">
                                                                <span className="text-xs mr-1">{formData.code || '...'}</span>
                                                                <input
                                                                    type="text"
                                                                    className="flex-1 bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none p-1 font-mono text-xs"
                                                                    value={v.sku}
                                                                    onChange={e => handleVariantChange(i, 'sku', e.target.value)}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="p-2">
                                                            <input
                                                                type="number"
                                                                className="w-24 bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none p-1"
                                                                value={v.price || ''}
                                                                placeholder="Base"
                                                                onChange={e => handleVariantChange(i, 'price', parseFloat(e.target.value) || 0)}
                                                            />
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeVariant(i)}
                                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                                            >
                                                                ✕
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:shadow-indigo-500/30">Save Product</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
