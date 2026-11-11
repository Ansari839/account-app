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
        {
            header: "Type",
            accessor: (row) => {
                if (!row.isImport) {
                    return (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            LOCAL
                        </span>
                    );
                }

                const hasEFS = row.items?.some((i: any) => i.isEFS);
                const hasNonEFS = row.items?.some((i: any) => !i.isEFS);

                return (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                            IMPORT
                        </span>
                        {hasEFS && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                EFS
                            </span>
                        )}
                        {hasNonEFS && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                NON-EFS
                            </span>
                        )}
                    </div>
                );
            }
        },
        { 
            header: "Supplier", 
            accessor: (row) => row.supplier?.name || row.Supplier?.name || row.beneficiaryName || "-" 
        },
        {
            header: "Amount",
            accessor: (row) => Number(row.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        },
        {
            header: "Ref",
            accessor: (row) =>
                row.gdNumber
                    ? `GD: ${row.gdNumber}`
                    : row.blNumber
                        ? `BL: ${row.blNumber}`
                        : row.po
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
                <div className="flex gap-3">
                    <button
                        onClick={() => router.push('/finance/purchase/invoices/import')}
                        className="bg-fuchsia-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-fuchsia-500/20 hover:bg-fuchsia-700 transition-all flex items-center gap-2"
                    >
                        <span className="text-xl">+</span> Add Import Invoice
                    </button>
                    <button
                        onClick={() => router.push('/finance/purchase/invoices/new')}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2"
                    >
                        <span className="text-xl">+</span> Add Invoice
                    </button>
                </div>
            </div>

            <DataTable data={invoices} columns={columns} isLoading={loading} />

            {/* Modals removed, use dedicated page /new or /edit */}
        </MainLayout>
    );
}
