"use client";

import React from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable from '@/components/DataTable';

export default function PurchaseInvoicesPage() {
    const columns = [
        { header: 'Invoice #', accessor: (i: any) => i.no },
        { header: 'Supplier', accessor: (i: any) => i.supplier },
        { header: 'Date', accessor: (i: any) => i.date },
        { header: 'Total', accessor: (i: any) => i.total },
        { header: 'Status', accessor: () => <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-full text-[10px] font-bold">OPEN</span> }
    ];

    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Purchase Invoices</h1>
                        <p className="text-slate-500 mt-1">Review and manage supplier invoices.</p>
                    </div>
                    <button className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">
                        + New Invoice
                    </button>
                </div>

                <DataTable
                    data={[]}
                    columns={columns}
                    searchPlaceholder="Search invoices..."
                />
            </div>
        </MainLayout>
    );
}
