"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import { useRouter } from 'next/navigation';

export default function WarehousesPage() {
    const router = useRouter();
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWarehouses();
    }, []);

    const fetchWarehouses = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch('/api/inventory/warehouses');
            const json = await res.json();
            if (json.success) setWarehouses(json.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        const res = await authenticatedFetch(`/api/inventory/warehouses/${id}`, { method: 'DELETE' });
        if (res.ok) fetchWarehouses();
        else alert("Failed to delete. Ensure no stock transactions exist.");
    };

    const columns: Column<any>[] = [
        { header: 'Code', accessor: 'code' },
        { header: 'Name', accessor: 'name' },
        { header: 'Address', accessor: (row) => row.address || '-' },
        { 
            header: 'Default', 
            accessor: (row) => row.isDefault ? (
                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase">Default</span>
            ) : '-' 
        },
        {
            header: 'Actions',
            accessor: (row) => (
                <div className="flex gap-2">
                    <button 
                        onClick={() => router.push(`/inventory/warehouses/${row.id}/edit`)} 
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
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Warehouses</h1>
                    <p className="text-slate-500">Set up and manage storage locations.</p>
                </div>

                <button
                    onClick={() => router.push('/inventory/warehouses/new')}
                    className="bg-amber-500 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-amber-200 dark:shadow-amber-900/20 hover:bg-amber-600 transition-colors"
                >
                    + New Warehouse
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <DataTable
                    data={warehouses}
                    columns={columns}
                    isLoading={loading}
                />
            </div>
        </MainLayout>
    );
}
