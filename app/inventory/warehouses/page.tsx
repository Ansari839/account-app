"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { Column } from '@/components/DataTable';
import { authenticatedFetch } from '@/lib/api-client';

interface Warehouse {
    id: string;
    code: string;
    name: string;
    address?: string;
    isDefault: boolean;
}

export default function WarehousesPage() {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        authenticatedFetch('/api/finance/warehouses')
            .then(res => res.json())
            .then(json => {
                if (!json.success || !Array.isArray(json.data)) {
                    console.error('Failed to load warehouses:', json.error);
                    return;
                }
                setWarehouses(json.data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Fetch error:', err);
                setIsLoading(false);
            });
    }, []);

    const columns: Column<Warehouse>[] = [
        { header: 'Code', accessor: 'code' },
        { header: 'Warehouse Name', accessor: 'name' },
        { header: 'Location / Address', accessor: 'address' },
        {
            header: 'Status',
            accessor: (item: Warehouse) => (
                <div className="flex items-center gap-2">
                    {item.isDefault ? (
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-full">DEFAULT</span>
                    ) : (
                        <span className="px-2 py-0.5 bg-slate-500/10 text-slate-500 text-[10px] font-bold rounded-full">ACTIVE</span>
                    )}
                </div>
            )
        },
    ];

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                            Storage Locations
                        </h1>
                        <p className="text-slate-500 mt-1">Manage physical warehouses and distribution centers.</p>
                    </div>
                    <button className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">
                        + New Warehouse
                    </button>
                </div>

                <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-3xl overflow-hidden shadow-2xl">
                    <DataTable
                        columns={columns}
                        data={warehouses}
                        isLoading={isLoading}
                        searchPlaceholder="Search Code or Name..."
                    />
                </div>
            </div>
        </MainLayout>
    );
}
