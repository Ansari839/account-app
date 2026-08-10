"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import { useRouter } from 'next/navigation';

export default function ProductsPage() {
    const router = useRouter();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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
                <div className="flex gap-2">
                    <button 
                        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors border border-transparent hover:border-violet-100"
                        title="View / Edit"
                        onClick={() => router.push(`/inventory/products/${row.id}`)}
                    >
                        👁
                    </button>
                    <button 
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-100"
                        title="Edit"
                        onClick={() => router.push(`/inventory/products/${row.id}/edit`)}
                    >
                        📝
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
                    <p className="text-slate-500">Manage your product catalog and variants.</p>
                </div>

                <button
                    onClick={() => router.push('/inventory/products/new')}
                    className="bg-violet-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-violet-200 dark:shadow-violet-900/20 hover:bg-violet-700 transition-colors"
                >
                    + New Product
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <DataTable
                    data={products}
                    columns={columns}
                    isLoading={loading}
                />
            </div>
        </MainLayout>
    );
}
