"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { Column } from '@/components/DataTable';
import { useParams } from 'next/navigation';
import { authenticatedFetch } from '@/lib/api-client';
import Link from 'next/link';

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
        {
            header: 'No',
            accessor: (v) => (
                <Link href={`/finance/vouchers/${type || 'journal'}/${v.id}`} className="text-indigo-600 hover:underline font-bold font-mono">
                    {v.number}
                </Link>
            )
        },
        { header: 'Date', accessor: (v) => new Date(v.date).toLocaleDateString() },
        { header: 'Narration', accessor: (v) => v.narration || 'N/A' },
        { header: 'Reference', accessor: (v) => v.reference || '-' },
        {
            header: 'Actions',
            accessor: (v) => (
                <div className="flex items-center gap-2">
                    <Link href={`/finance/vouchers/${type || 'journal'}/${v.id}/edit`}>
                        <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Edit">
                            <span className="text-sm font-bold">✎</span>
                        </button>
                    </Link>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            if (confirm('Delete this voucher?')) {
                                authenticatedFetch(`/api/finance/vouchers/${v.id}`, { method: 'DELETE' })
                                    .then(res => res.json())
                                    .then(json => {
                                        if (json.success) {
                                            setVouchers(prev => prev.filter(x => x.id !== v.id));
                                        } else {
                                            alert(json.error);
                                        }
                                    });
                            }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        title="Delete"
                    >
                        <span className="text-lg leading-none">×</span>
                    </button>

                    <Link href={`/finance/vouchers/${type || 'journal'}/${v.id}`}>
                        <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="View">
                            <span className="text-sm font-bold">👁</span>
                        </button>
                    </Link>
                </div>
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
                    <Link href={`/finance/vouchers/${type || 'journal'}/new`}>
                        <button className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">
                            + New {voucherType}
                        </button>
                    </Link>
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
