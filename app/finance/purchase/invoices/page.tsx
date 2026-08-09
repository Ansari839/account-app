"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import DataTable, { Column } from "@/components/DataTable";
import Combobox from "@/components/Combobox";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

export default function PurchaseInvoicesPage() {
    const router = useRouter();

    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch("/api/finance/purchase/invoices");
            const json = await res.json();
            if (json.success) setInvoices(json.data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this invoice? Linked journal entries and quantities will be reverted.")) return;

        try {
            const res = await authenticatedFetch(`/api/finance/purchase/invoices/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchInvoices();
            } else {
                const json = await res.json();
                alert(json.error || "Failed to delete invoice");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const columns: Column<any>[] = [
        { header: "Inv #", accessor: "invoiceNo" },
        {
            header: "Date",
            accessor: (row) => format(new Date(row.date), "dd/MM/yyyy"),
        },
        { header: "Supplier", accessor: (row) => row.supplier?.name },
        {
            header: "Amount",
            accessor: (row) => Number(row.totalAmount || 0).toFixed(2),
        },
        {
            header: "Ref",
            accessor: (row) =>
                row.po
                    ? `PO: ${row.po.poNo}`
                    : row.grn
                        ? `GRN: ${row.grn.grnNo}`
                        : "-",
        },
        {
            header: "Actions",
            accessor: (row) => (
                <div className="flex gap-2">
                    <button
                        onClick={() => router.push(`/finance/purchase/invoices/${row.id}`)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                        title="View/Print"
                    >
                        👁
                    </button>
                    <button
                        onClick={() => router.push(`/finance/purchase/invoices/${row.id}/edit`)}
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
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                        Purchase Invoices
                    </h2>
                    <p className="text-slate-500">
                        Manage bills to be paid to suppliers.
                    </p>
                </div>
                <button
                    onClick={() => router.push('/finance/purchase/invoices/new')}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                    <span className="text-xl">+</span> Add Invoice
                </button>
            </div>

            <DataTable data={invoices} columns={columns} isLoading={loading} />

            {/* Modals removed, use dedicated page /new or /edit */}
        </MainLayout>
    );
}
