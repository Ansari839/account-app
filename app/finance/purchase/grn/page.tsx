"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import Combobox from '@/components/Combobox';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function GRNPage() {
    const router = useRouter();
    const [grns, setGrns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGRNs();
    }, []);

    const fetchGRNs = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch('/api/finance/purchase/grn');
            const json = await res.json();
            if (json.success) setGrns(json.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this GRN? This will revert stock and PO fulfillment status.")) return;

        try {
            const res = await authenticatedFetch(`/api/finance/purchase/grn/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchGRNs();
            } else {
                const json = await res.json();
                alert(json.error || "Failed to delete GRN");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const columns: Column<any>[] = [
        { header: 'GRN #', accessor: 'grnNo' },
        { header: 'Date', accessor: (row) => format(new Date(row.date), 'dd/MM/yyyy') },
        { header: 'PO #', accessor: (row) => row.po?.poNo || '-' },
        { header: 'Supplier', accessor: (row) => row.supplier?.name },
        { header: 'Warehouse', accessor: (row) => row.warehouse?.name },
        {
            header: 'Status',
            accessor: (row) => row.invoices?.length > 0
                ? <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">BILLED</span>
                : <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-xs font-bold">UNBILLED</span>
        },
        {
            header: 'Items Rec.',
            accessor: (row) => row.items?.length || 0
        },
        {
            header: 'Actions',
            accessor: (row) => (
                <div className="flex gap-2">
                    <button
                        onClick={() => router.push(`/finance/purchase/grn/${row.id}`)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                        title="View/Print"
                    >
                        👁
                    </button>
                    <button
                        onClick={() => router.push(`/finance/purchase/grn/${row.id}/edit`)}
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
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                        Goods Received Notes
                    </h2>
                    <p className="text-slate-500">Track inventory received against Purchase Orders.</p>
                </div>
                <button
                    onClick={() => router.push('/finance/purchase/grn/new')}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                    <span className="text-xl">+</span> New GRN
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <DataTable
                    data={grns}
                    columns={columns}
                    isLoading={loading}
                />
            </div>

            {/* Modals removed, use dedicated page /new or /edit */}
        </MainLayout>
    );
}
