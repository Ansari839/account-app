"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import { useRouter } from 'next/navigation';

export default function CategoriesPage() {
    const router = useRouter();
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch('/api/inventory/categories');
            const json = await res.json();
            if (json.success) setCategories(json.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        const res = await authenticatedFetch(`/api/inventory/categories/${id}`, { method: 'DELETE' });
        if (res.ok) fetchCategories();
        else alert("Failed to delete. Ensure no products exist in this category.");
    };

    const columns: Column<any>[] = [
        { header: 'Name', accessor: 'name' },
        { header: 'Parent Category', accessor: (row: any) => row.parent?.name || '-' },
        { header: 'Products', accessor: (row: any) => row._count?.products || 0 },
        {
            header: 'Actions',
            accessor: (row: any) => (
                <div className="flex gap-2">
                    <button 
                        onClick={() => router.push(`/inventory/categories/${row.id}/edit`)} 
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-100"
                        title="Edit"
                    >
                        📝
                    </button>
                    <button 
                        onClick={() => handleDelete(row.id)} 
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        title="Delete"
                    >
                        🗑
                    </button>
                </div>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Categories</h1>
                    <p className="text-slate-500">Organize your products effectively.</p>
                </div>

                <button
                    onClick={() => router.push('/inventory/categories/new')}
                    className="bg-pink-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-pink-200 dark:shadow-pink-900/20 hover:bg-pink-700 transition-colors"
                >
                    + New Category
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <DataTable
                    data={categories}
                    columns={columns}
                    isLoading={loading}
                />
            </div>
        </MainLayout>
    );
}
