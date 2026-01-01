"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { Column } from '@/components/DataTable';
import { useParams } from 'next/navigation';
import { authenticatedFetch } from '@/lib/api-client';

export default function GenericVoucherPage() {
    const { type } = useParams();
    const voucherType = (type as string)?.toUpperCase() || 'VOUCHER';

    const [vouchers, setVouchers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Mapping types to API endpoints (handling Journal for now as only one active)
        const endpointMap: Record<string, string> = {
            'journal': '/api/finance/vouchers/journal',
            'payment': '/api/finance/vouchers/journal', // Placeholder
            'receipt': '/api/finance/vouchers/journal', // Placeholder
        };

        const url = endpointMap[(type as string)?.toLowerCase()] || '/api/finance/vouchers/journal';

        authenticatedFetch(url)
            .then(res => res.json())
            .then(json => {
                if (json.success) {
                    setVouchers(json.data);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch vouchers:', err);
                setLoading(false);
            });
    }, [type]);

    const columns: Column<any>[] = [
        { header: 'No', accessor: (v) => v.number },
        { header: 'Date', accessor: (v) => new Date(v.date).toLocaleDateString() },
        { header: 'Narration', accessor: (v) => v.narration || 'N/A' },
        { header: 'Reference', accessor: (v) => v.reference || '-' },
        {
            header: 'Status',
            accessor: (v) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${v.status ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {v.status ? 'CONFIRMED' : 'DRAFT'}
                </span>
            )
        }
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
                    data={vouchers}
                    columns={columns}
                    isLoading={loading}
                    searchPlaceholder={`Search ${voucherType.toLowerCase()}s...`}
                />
            </div>
        </MainLayout>
    );
}
