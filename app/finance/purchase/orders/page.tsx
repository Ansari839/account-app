"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import Combobox from '@/components/Combobox';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function PurchaseOrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch('/api/finance/purchase/orders');
            const json = await res.json();
            if (json.success) setOrders(json.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this PO?')) return;
        const res = await authenticatedFetch(`/api/finance/purchase/orders/${id}`, { method: 'DELETE' });
        if (res.ok) fetchOrders();
        else {
            const json = await res.json();
            alert(json.error || "Failed to delete");
        }
    };

    const columns: Column<any>[] = [
        { header: 'PO #', accessor: 'poNo' },
        { header: 'Date', accessor: (row) => format(new Date(row.date), 'dd/MM/yyyy') },
        { header: 'Supplier', accessor: (row) => row.supplier?.name },
        { header: 'Amount', accessor: (row) => Number(row.totalAmount).toLocaleString() },
        {
            header: 'Status',
            accessor: (row) => (
                <span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'CLOSED' ? 'bg-green-100 text-green-700' :
                    row.status === 'OPEN' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                    }`}>
                    {row.status}
                </span>
            )
        },
        {
            header: 'Progress',
            accessor: (row) => {
                const totalQty = row.items.reduce((sum: number, it: any) => sum + Number(it.qty), 0);
                const recQty = row.items.reduce((sum: number, it: any) => sum + Number(it.receivedQty || 0), 0);
                const invQty = row.items.reduce((sum: number, it: any) => sum + Number(it.invoicedQty || 0), 0);

                const recPerc = totalQty > 0 ? Math.round((recQty / totalQty) * 100) : 0;
                const invPerc = totalQty > 0 ? Math.round((invQty / totalQty) * 100) : 0;

                return (
                    <div className="flex flex-col gap-1.5 w-24">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex justify-between text-[9px] uppercase font-bold text-slate-400">
                                <span>Rec</span>
                                <span>{recPerc}%</span>
                            </div>
                            <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${recPerc}%` }}></div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <div className="flex justify-between text-[9px] uppercase font-bold text-slate-400">
                                <span>Inv</span>
                                <span>{invPerc}%</span>
                            </div>
                            <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${invPerc}%` }}></div>
                            </div>
                        </div>
                    </div>
                );
            }
        },
        {
            header: 'Actions',
            accessor: (row) => (
                <div className="flex gap-2">
                    <button onClick={() => router.push(`/finance/purchase/orders/${row.id}`)} className="text-indigo-600 hover:text-indigo-800 p-1" title="View Detail">
                        👁
                    </button>
                    <button onClick={() => router.push(`/finance/purchase/orders/${row.id}/edit`)} className="text-amber-600 hover:text-amber-800 p-1" title="Edit">
                        ✎
                    </button>
                    <button onClick={() => handleDelete(row.id)} className="text-rose-600 hover:text-rose-800 p-1" title="Delete">
                        ✕
                    </button>
                </div>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Purchase Orders</h1>
                    <p className="text-slate-500">Create and manage orders to suppliers.</p>
                </div>
                <button
                    onClick={() => router.push('/finance/purchase/orders/new')}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold"
                >
                    + New Order
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <DataTable
                    data={orders}
                    columns={columns}
                    isLoading={loading}
                />
            </div>

            {/* The modal has been removed and replaced by a dedicated 'New Purchase Order' page */}
        </MainLayout>
    );
}
