"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable from '@/components/DataTable';
import { authenticatedFetch } from '@/lib/api-client';

export default function PurchaseInvoicesPage() {
    const [invoices, setInvoices] = useState([]);
    useEffect(() => {
        authenticatedFetch('/api/finance/purchase/invoices')
            .then(res => res.json())
            .then(json => {
                if (!json.success) {
                    console.error('Failed to load invoices:', json.error);
                    return;
                }
                setInvoices(json.data);
            })
            .catch(console.error);
    }, []);

    const columns = [
        {
            header: 'Invoice #',
            accessor: (i: any) => <span className="font-bold text-indigo-600">{i.invoiceNo}</span>
        },
        {
            header: 'Supplier',
            accessor: (i: any) => i.supplier?.name || 'Unknown'
        },
        {
            header: 'Date',
            accessor: (i: any) => new Date(i.date).toLocaleDateString()
        },
        {
            header: 'Total',
            accessor: (i: any) => <span className="font-mono font-bold">${parseFloat(i.totalAmount).toLocaleString()}</span>,
            className: 'text-right'
        },
        {
            header: 'Status',
            accessor: () => <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-bold">POSTED</span>
        }
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
                    data={invoices}
                    columns={columns}
                    searchPlaceholder="Search invoices..."
                />
            </div>
        </MainLayout>
    );
}
