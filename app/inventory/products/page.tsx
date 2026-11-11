"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import { useRouter } from 'next/navigation';
import OpeningStockModal, { OpeningStockProduct } from '@/components/inventory/OpeningStockModal';
import { Layers, PackagePlus, Eye, Pencil, Trash2 } from 'lucide-react';

export default function ProductsPage() {
    const router = useRouter();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [openingModalOpen, setOpeningModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<OpeningStockProduct | null>(null);

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

    const columns: Column<any>[] = [
        { header: 'P-Code', accessor: 'code' },
        { header: 'Product Name', accessor: 'name' },
        { header: 'HS Code', accessor: (row) => row.hsCode || '-' },
        { header: 'Category', accessor: (row) => row.category?.name || '-' },
        { header: 'Base Unit', accessor: (row) => row.baseUnit?.name || '-' },
        { header: 'Variants', accessor: (row) => row.variants?.length || 0 },
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
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Products</h1>
                    <p className="text-slate-500">Manage your product catalog, variants, and opening stock.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setSelectedProduct(null);
                            setOpeningModalOpen(true);
                        }}
                        className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 text-sm border border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                        <Layers size={16} className="text-indigo-500" /> Opening Stock
                    </button>
                    <button
                        onClick={() => router.push('/inventory/products/new')}
                        className="bg-violet-600 text-white px-5 py-2 rounded-xl font-bold shadow-lg shadow-violet-200 dark:shadow-violet-900/20 hover:bg-violet-700 transition-colors text-sm"
                    >
                        + New Product
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <DataTable
                    data={products}
                    columns={columns}
                    isLoading={loading}
                />
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
