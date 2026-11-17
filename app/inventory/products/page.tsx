"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import { useRouter } from 'next/navigation';
import OpeningStockModal, { OpeningStockProduct } from '@/components/inventory/OpeningStockModal';
import { Layers, PackagePlus, Eye, Pencil, Trash2, Search, X, RotateCcw, Filter, FolderTree } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProductsPage() {
    const router = useRouter();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [openingModalOpen, setOpeningModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<OpeningStockProduct | null>(null);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [stageFilter, setStageFilter] = useState('ALL');
    const [typeFilter, setTypeFilter] = useState('ALL');

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch('/api/inventory/products');
            const json = await res.json();
            if (json.success) setProducts(json.data);
        } catch (e) { 
            console.error(e); 
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this product?")) return;
        try {
            const res = await authenticatedFetch(`/api/inventory/products/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchProducts();
            } else {
                const json = await res.json();
                alert(json.error || "Failed to delete product. Ensure it has no stock transactions.");
            }
        } catch (e) {
            console.error(e);
            alert("An error occurred while deleting the product.");
        }
    };

    // Extract unique categories
    const uniqueCategories = Array.from(new Set(products.map(p => p.category?.name).filter(Boolean))) as string[];

    // Apply multidimensional filtering
    const filteredProducts = products.filter((p: any) => {
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const matchName = (p.name || '').toLowerCase().includes(q);
            const matchCode = (p.code || '').toLowerCase().includes(q);
            const matchHS = (p.hsCode || '').toLowerCase().includes(q);
            if (!matchName && !matchCode && !matchHS) return false;
        }

        if (categoryFilter !== 'ALL' && p.category?.name !== categoryFilter) {
            return false;
        }

        if (stageFilter !== 'ALL') {
            const isSvc = p.isService || p.stage === 'SERVICE';
            if (stageFilter === 'SERVICE' && !isSvc) return false;
            if (stageFilter !== 'SERVICE' && p.stage !== stageFilter) return false;
        }

        if (typeFilter === 'MANUFACTURED' && !p.isManufactured) return false;
        if (typeFilter === 'PURCHASED' && !p.isPurchased) return false;
        if (typeFilter === 'SERVICES' && !p.isService) return false;

        return true;
    });

    const hasActiveFilters = Boolean(searchQuery || categoryFilter !== 'ALL' || stageFilter !== 'ALL' || typeFilter !== 'ALL');

    const resetFilters = () => {
        setSearchQuery('');
        setCategoryFilter('ALL');
        setStageFilter('ALL');
        setTypeFilter('ALL');
    };

    const columns: Column<any>[] = [
        { header: 'P-Code', accessor: (row) => <span className="font-mono text-xs font-semibold text-slate-500">{row.code}</span> },
        { 
            header: 'Product Name', 
            accessor: (row) => (
                <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{row.name}</span>
                    {row.isService && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                            Service
                        </span>
                    )}
                </div>
            ) 
        },
        { header: 'HS Code', accessor: (row) => <span className="font-mono text-xs font-bold text-slate-400">{row.hsCode || '-'}</span> },
        { header: 'Category', accessor: (row) => <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{row.category?.name || '-'}</span> },
        {
            header: 'Stage',
            accessor: (row) => {
                const isSvc = row.isService || row.stage === 'SERVICE';
                return (
                    <span className={cn(
                        "text-[10px] uppercase font-black px-2 py-0.5 rounded-md tracking-wider border",
                        isSvc
                            ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30"
                            : row.stage === 'RAW'
                                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                                : (row.stage === 'WIP' || row.stage === 'GREY')
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    )}>
                        {isSvc ? 'SERVICE' : (row.stage || 'RAW')}
                    </span>
                );
            }
        },
        { header: 'Base Unit', accessor: (row) => <span className="text-xs uppercase font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500">{row.baseUnit?.name || '-'}</span> },
        { header: 'Variants', accessor: (row) => <span className="font-mono text-xs font-bold">{row.variants?.length || 0}</span> },
        {
            header: 'Actions',
            accessor: (row) => (
                <div className="flex gap-1.5 items-center">
                    <button 
                        className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 dark:hover:bg-indigo-500/15 rounded-xl transition-all border border-transparent hover:border-indigo-500/20 shadow-sm"
                        title="Add Opening Stock"
                        onClick={() => {
                            setSelectedProduct({
                                id: row.id,
                                name: row.name,
                                code: row.code,
                                stage: row.stage,
                                isService: row.isService
                            });
                            setOpeningModalOpen(true);
                        }}
                    >
                        <PackagePlus size={16} />
                    </button>
                    <button 
                        className="p-2 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 dark:hover:bg-sky-500/15 rounded-xl transition-all border border-transparent hover:border-sky-500/20 shadow-sm"
                        title="View Details"
                        onClick={() => router.push(`/inventory/products/${row.id}`)}
                    >
                        <Eye size={16} />
                    </button>
                    <button 
                        className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 dark:hover:bg-amber-500/15 rounded-xl transition-all border border-transparent hover:border-amber-500/20 shadow-sm"
                        title="Edit Product"
                        onClick={() => router.push(`/inventory/products/${row.id}/edit`)}
                    >
                        <Pencil size={16} />
                    </button>
                    <button 
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/15 rounded-xl transition-all border border-transparent hover:border-rose-500/20 shadow-sm"
                        title="Delete Product"
                        onClick={() => handleDelete(row.id)}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="space-y-6 animate-in fade-in duration-500 pb-32">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Products</h1>
                        <p className="text-sm font-medium text-slate-500 mt-1">Manage your product catalog, stage classifications, and opening stock.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                setSelectedProduct(null);
                                setOpeningModalOpen(true);
                            }}
                            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2 text-sm border border-slate-200 dark:border-slate-700 shadow-sm"
                        >
                            <Layers size={16} className="text-indigo-500" /> Opening Stock
                        </button>
                        <button
                            onClick={() => router.push('/inventory/products/new')}
                            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-colors text-sm"
                        >
                            + New Product
                        </button>
                    </div>
                </div>

                {/* Filter Controls Bar */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="relative flex-1 min-w-[260px]">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Filter products by Name, P-Code, or HS Code..."
                                className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={15} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        {/* Category Filter */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                Category
                            </label>
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="w-full py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="ALL">All Categories</option>
                                {uniqueCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {/* Stage Filter */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                Stage
                            </label>
                            <select
                                value={stageFilter}
                                onChange={(e) => setStageFilter(e.target.value)}
                                className="w-full py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="ALL">All Stages</option>
                                <option value="RAW">RAW Material</option>
                                <option value="GREY">GREY / WIP</option>
                                <option value="FINISH">Finished Goods</option>
                                <option value="SERVICE">Service Item</option>
                            </select>
                        </div>

                        {/* Type / Behavior Filter */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                Product Behavior
                            </label>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="w-full py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="ALL">All Behaviors</option>
                                <option value="MANUFACTURED">Manufactured Products</option>
                                <option value="PURCHASED">Purchased Products</option>
                                <option value="SERVICES">Services Only</option>
                            </select>
                        </div>

                        {/* Reset Filters */}
                        <div className="flex items-end">
                            <button
                                onClick={resetFilters}
                                disabled={!hasActiveFilters}
                                className={cn(
                                    "w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border",
                                    hasActiveFilters
                                        ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20 hover:bg-rose-100"
                                        : "opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40 text-slate-400 border-slate-200 dark:border-slate-700/40"
                                )}
                            >
                                <RotateCcw size={12} /> Clear Filters
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6">
                    <DataTable
                        data={filteredProducts}
                        columns={columns}
                        isLoading={loading}
                    />
                </div>
            </div>

            <OpeningStockModal
                isOpen={openingModalOpen}
                onClose={() => setOpeningModalOpen(false)}
                product={selectedProduct}
                onSuccess={fetchProducts}
            />
        </MainLayout>
    );
}
