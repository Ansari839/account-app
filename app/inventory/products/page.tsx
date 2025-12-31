"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { Column } from '@/components/DataTable';
import { authenticatedFetch } from '@/lib/api-client';

interface Product {
    id: string;
    code: string;
    name: string;
    category?: { name: string };
    baseUnit?: { name: string };
    taxCode?: { name: string };
    openingStock: string | number;
}

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        authenticatedFetch('/api/finance/products')
            .then(res => res.json())
            .then(json => {
                if (!json.success || !Array.isArray(json.data)) {
                    console.error('Failed to load products:', json.error);
                    return;
                }
                setProducts(json.data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Fetch error:', err);
                setIsLoading(false);
            });
    }, []);

    const columns: Column<Product>[] = [
        { header: 'P-Code', accessor: 'code' },
        { header: 'Product Name', accessor: 'name' },
        {
            header: 'Category',
            accessor: (item: Product) => item.category?.name || 'Uncategorized'
        },
        {
            header: 'Unit',
            accessor: (item: Product) => item.baseUnit?.name || 'N/A'
        },
        {
            header: 'OS Qty',
            accessor: 'openingStock'
        },
        {
            header: 'Tax',
            accessor: (item: Product) => item.taxCode?.name || 'Exempt'
        },
    ];

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                            Item Master
                        </h1>
                        <p className="text-slate-500 mt-1">Manage your professional catalog of products and services.</p>
                    </div>
                    <button className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">
                        + New Product
                    </button>
                </div>

                <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-3xl overflow-hidden shadow-2xl">
                    <DataTable
                        columns={columns}
                        data={products}
                        isLoading={isLoading}
                        searchPlaceholder="Search SKU or Name..."
                    />
                </div>
            </div>
        </MainLayout>
    );
}
