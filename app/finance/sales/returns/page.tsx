"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import DataTable, { Column } from "@/components/DataTable";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

export default function SalesReturnsPage() {
    const router = useRouter();
    const [returns, setReturns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchReturns();
    }, []);

    const fetchReturns = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch("/api/finance/sales/returns");
            const json = await res.json();
            if (json.success) setReturns(json.data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const columns: Column<any>[] = [
        { header: "Return #", accessor: "returnNo" },
        { header: "Date", accessor: (row) => format(new Date(row.date), "dd/MM/yyyy") },
        { header: "Customer", accessor: (row) => row.customer?.name },
        { header: "Ref Invoice", accessor: (row) => row.invoice?.invoiceNo || "-" },
        { header: "Amount", accessor: (row) => Number(row.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        {
            header: "Actions",
            accessor: (row) => (
                <div className="flex gap-2">
                    <button className="p-1 text-slate-400 hover:text-indigo-600" onClick={() => router.push(`/finance/sales/returns/${row.id}`)}>👁</button>
                </div>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Sales Returns</h2>
                    <p className="text-slate-500">Manage customer returns and reversals.</p>
                </div>
                <button
                    onClick={() => router.push("/finance/sales/returns/new")}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg"
                >
                    + New Return
                </button>
            </div>

            <DataTable data={returns} columns={columns} isLoading={loading} />
        </MainLayout>
    );
}
