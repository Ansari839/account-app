"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import DataTable, { Column } from "@/components/DataTable";
import Combobox from "@/components/Combobox";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

export default function SalesOrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch("/api/finance/sales/orders");
            const json = await res.json();
            if (json.success) setOrders(json.data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this sales order?")) return;

        try {
            const res = await authenticatedFetch(`/api/finance/sales/orders/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchOrders();
            } else {
                const json = await res.json();
                alert(json.error || "Failed to delete order");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const columns: Column<any>[] = [
        { header: "Order #", accessor: "orderNo" },
        { header: "Date", accessor: (row) => format(new Date(row.date), "dd/MM/yyyy") },
        { header: "Customer", accessor: (row) => row.customer?.name },
        { header: "Amount", accessor: (row) => Number(row.totalAmount || 0).toFixed(2) },
        {
            header: "Status",
            accessor: (row) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.status === 'CLOSED' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {row.status || 'OPEN'}
                </span>
            )
        },
        {
            header: 'Progress',
            accessor: (row) => {
                const totalQty = row.items.reduce((sum: number, it: any) => sum + Number(it.qty), 0);
                const fulQty = row.items.reduce((sum: number, it: any) => sum + Number(it.fulfilledQty || 0), 0);
                const invQty = row.items.reduce((sum: number, it: any) => sum + Number(it.invoicedQty || 0), 0);

                const fulPerc = totalQty > 0 ? Math.round((fulQty / totalQty) * 100) : 0;
                const invPerc = totalQty > 0 ? Math.round((invQty / totalQty) * 100) : 0;

                return (
                    <div className="flex flex-col gap-1.5 w-24">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex justify-between text-[9px] uppercase font-bold text-slate-400">
                                <span>Del</span>
                                <span>{fulPerc}%</span>
                            </div>
                            <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${fulPerc}%` }}></div>
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
            header: "Actions",
            accessor: (row) => (
                <div className="flex gap-2">
                    <button
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                        title="View"
                    >
                        👁
                    </button>
                    <button
                        onClick={() => router.push(`/finance/sales/orders/${row.id}/edit`)}
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
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Sales Orders</h2>
                    <p className="text-slate-500">Track and manage customer orders.</p>
                </div>
                <button
                    onClick={() => router.push('/finance/sales/orders/new')}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg"
                >
                    + New Order
                </button>
            </div>

            <DataTable data={orders} columns={columns} isLoading={loading} />

            {/* Modals removed, use dedicated page /new or /edit */}
        </MainLayout>
    );
}
