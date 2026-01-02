"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { Column } from '@/components/DataTable';
import { useParams, usePathname } from 'next/navigation';
import { authenticatedFetch } from '@/lib/api-client';
import Link from 'next/link';
import VoucherTabs from '@/components/VoucherTabs';

export default function GenericVoucherPage() {
    const { type } = useParams();
    const voucherType = (type as string)?.toUpperCase() || 'VOUCHER';

    const [vouchers, setVouchers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState<{ symbol: string }>({ symbol: '$' });

    useEffect(() => {
        // Fetch base currency
        authenticatedFetch('/api/finance/currency')
            .then(res => res.json())
            .then(json => {
                if (json.success) {
                    const base = json.data.find((c: any) => c.isBase);
                    if (base) setCurrency({ symbol: base.symbol });
                }
            })
            .catch(err => console.error('Failed to fetch currency:', err));
    }, []);

    useEffect(() => {
        // Mapping types to API endpoints (handling Journal for now as only one active)
        const url = `/api/finance/vouchers/journal?type=${type}`;

        authenticatedFetch(url)
            .then(res => res.json())
            .then(json => {
                if (json.success) {
                    setVouchers(json.data.map((v: any) => ({
                        ...v,
                        total: v.lines.reduce((sum: number, l: any) => sum + (Number(l.debit) || 0), 0)
                    })));
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
            header: 'Voucher #',
            accessor: (v) => (
                <Link href={`/finance/vouchers/${type || 'journal'}/${v.id}`} className="text-indigo-600 hover:underline font-bold font-mono">
                    {v.number}
                </Link>
            )
        },
        { header: 'Date', accessor: (v) => new Date(v.date).toLocaleDateString() },
        {
            header: 'Type',
            accessor: (v) => v.type,
            className: 'text-xs font-bold opacity-60'
        },
        {
            header: 'Amount',
            accessor: (v) => (
                <span className="font-mono font-bold">
                    {currency.symbol}
                    {Number(v.total || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })}
                </span>
            ),
            className: 'text-right'
        },
        {
            header: 'Status',
            accessor: () => (
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black">POSTED</span>
            )
        },
        { header: 'Narration', accessor: (v) => v.narration || '-' },
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
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Voucher Registry</h1>
                        <p className="text-slate-500 mt-1 font-medium">Manage all accounting entries and financial transactions.</p>
                    </div>
                    <Link href={`/finance/vouchers/${type || 'journal'}/new`}>
                        <button className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">
                            + New Voucher
                        </button>
                    </Link>
                </div>

                <div className="space-y-0">
                    <VoucherTabs />

                    <div className="bg-white dark:bg-slate-900 border-x border-b border-slate-200 dark:border-slate-800 rounded-b-2xl shadow-sm overflow-hidden">
                        <DataTable
                            data={vouchers}
                            columns={columns}
                            isLoading={loading}
                            searchPlaceholder={`Search ${voucherType.toLowerCase()}s...`}
                        />
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
