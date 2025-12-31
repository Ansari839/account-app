"use client";

import React from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable from '@/components/DataTable';
import { useParams } from 'next/navigation';

export default function GenericVoucherPage() {
    const { type } = useParams();
    const voucherType = (type as string)?.toUpperCase() || 'VOUCHER';

    const columns = [
        { header: 'No', accessor: (v: any) => v.number },
        { header: 'Date', accessor: (v: any) => v.date },
        { header: 'Narration', accessor: (v: any) => v.narration },
        { header: 'Total', accessor: (v: any) => v.total }
    ];

    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{voucherType} Registry</h1>
                        <p className="text-slate-500 mt-1">Browse and manage all {voucherType.toLowerCase()} records.</p>
                    </div>
                    <button className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">
                        + New {voucherType}
                    </button>
                </div>

                <DataTable
                    data={[]}
                    columns={columns}
                    searchPlaceholder={`Search ${voucherType.toLowerCase()}s...`}
                />
            </div>
        </MainLayout>
    );
}
