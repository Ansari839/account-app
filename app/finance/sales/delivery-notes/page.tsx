"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import DataTable, { Column } from "@/components/DataTable";
import Combobox from "@/components/Combobox";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

export default function DeliveryNotesPage() {
    const router = useRouter();
    const [dns, setDns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDNS();
    }, []);

    const fetchDNS = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch("/api/finance/sales/delivery-notes");
            const json = await res.json();
            if (json.success) setDns(json.data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this delivery note? Stock will be reverted.")) return;

        try {
            const res = await authenticatedFetch(`/api/finance/sales/delivery-notes/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchDNS();
            } else {
                const json = await res.json();
                alert(json.error || "Failed to delete delivery note");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const columns: Column<any>[] = [
        { header: "DN #", accessor: "doNo" },
        { header: "Date", accessor: (row) => format(new Date(row.date), "dd/MM/yyyy") },
        { header: "Customer", accessor: (row) => row.customer?.name },
        { header: "Ref Order", accessor: (row) => row.order?.orderNo || "-" },
        { header: "Warehouse", accessor: (row) => row.warehouse?.name },
        {
            header: "Status",
            accessor: (row) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.invoices?.length > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                    {row.invoices?.length > 0 ? 'INVOICED' : 'PENDING'}
                </span>
            )
        },
        {
            header: "Actions",
            accessor: (row) => (
                <div className="flex gap-2">
                    <button
                        onClick={() => router.push(`/finance/sales/delivery-notes/${row.id}`)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                        title="View"
                    >
                        👁
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
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Delivery Notes</h2>
                    <p className="text-slate-500">Manage goods dispatch and stock delivery.</p>
                </div>
                <button
                    onClick={() => router.push('/finance/sales/delivery-notes/new')}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg"
                >
                    + New Delivery Note
                </button>
            </div>

            <DataTable data={dns} columns={columns} isLoading={loading} />

            {/* Modals removed, use dedicated page /new */}
        </MainLayout>
    );
}
