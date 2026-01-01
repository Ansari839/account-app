"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable from '@/components/DataTable';
import { authenticatedFetch } from '@/lib/api-client';
import Link from 'next/link';

interface Voucher {
    id: string;
    number: string;
    date: string;
    type: string;
    reference?: string;
    narration?: string;
    total: number;
}

export default function VouchersPage() {
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Note: We need a generic voucher list API, using Journal as a fallback for now
        authenticatedFetch('/api/finance/vouchers/journal')
            .then(res => res.json())
            .then(json => {
                if (!json.success || !Array.isArray(json.data)) {
                    console.error('Failed to load vouchers:', json.error);
                    return;
                }
                setVouchers(json.data.map((v: any) => ({
                    ...v,
                    total: v.lines.reduce((sum: number, l: any) => sum + (l.debit || 0), 0)
                })));
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Fetch error:', err);
                setIsLoading(false);
            });
    }, []);

    const columns = [
        {
            header: 'Voucher #',
            accessor: (v: Voucher) => (
                <span className="font-black text-indigo-500">{v.number}</span>
            )
        },
        {
            header: 'Date',
            accessor: (v: Voucher) => new Date(v.date).toLocaleDateString()
        },
        {
            header: 'Type',
            accessor: (v: Voucher) => v.type,
            className: 'text-xs font-bold opacity-60'
        },
        {
            header: 'Amount',
            accessor: (v: Voucher) => (
                <span className="font-mono font-bold">${v.total.toLocaleString()}</span>
            ),
            className: 'text-right'
        },
        {
            header: 'Status',
            accessor: () => (
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black">POSTED</span>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Journal Vouchers</h1>
                        <p className="text-slate-500 mt-1">Review and manage all accounting entries and vouchers.</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold rounded-xl shadow-sm hover:bg-slate-50 transition-all">
                            Export
                        </button>
                        <Link href="/finance/vouchers/journal/new">
                            <button className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">
                                + New Voucher
                            </button>
                        </Link>
                    </div>
                </div>

                {isLoading ? (
                    <div className="h-64 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <DataTable
                        data={vouchers}
                        columns={columns}
                        searchPlaceholder="Search by number, ref or narration..."
                    />
                )}
            </div>
        </MainLayout>
    );
}
