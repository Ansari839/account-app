"use client";

import React from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable from '@/components/DataTable';
import { useParams } from 'next/navigation';

export default function GenericPurchasePage() {
    const { type } = useParams();
    const moduleName = (type as string)?.toUpperCase() || 'PURCHASE';

    const columns = [
        { header: 'Number', accessor: (v: any) => v.no },
        { header: 'Supplier', accessor: (v: any) => v.supplier },
        { header: 'Date', accessor: (v: any) => v.date },
        { header: 'Total', accessor: (v: any) => v.total }
    ];

    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Purchase {moduleName}</h1>
                        <p className="text-slate-500 mt-1">Manage your supplier {moduleName.toLowerCase()} documents.</p>
                    </div>
                    <button className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">
                        + Create {moduleName}
                    </button>
                </div>

                <DataTable
                    data={[]}
                    columns={columns}
                    searchPlaceholder={`Search ${moduleName.toLowerCase()}s...`}
                />
            </div>
        </MainLayout>
    );
}
