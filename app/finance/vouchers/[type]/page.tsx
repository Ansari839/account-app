"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { Column } from '@/components/DataTable';
import { useParams } from 'next/navigation';
import { authenticatedFetch } from '@/lib/api-client';
import Link from 'next/link';
import VoucherTabs from '@/components/VoucherTabs';
import { FileText, Plus, Edit3, Trash2, Eye } from 'lucide-react';

export default function GenericVoucherPage() {
    const { type } = useParams();
    const voucherType = (type as string)?.toUpperCase() || 'JOURNAL';

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
        // Mapping types to API endpoints
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
                <Link href={`/finance/vouchers/${type || 'journal'}/${v.id}`} className="text-indigo-600 hover:text-indigo-500 font-bold font-mono transition-colors">
                    {v.number}
                </Link>
            )
        },
        { header: 'Date', accessor: (v) => new Date(v.date).toLocaleDateString(), className: 'font-medium text-slate-600 dark:text-slate-300' },
        {
            header: 'Type',
            accessor: (v) => v.type,
            className: 'text-[10px] font-black uppercase tracking-widest text-slate-500'
        },
        {
            header: 'Amount',
            accessor: (v) => (
                <span className="font-mono font-bold text-slate-900 dark:text-white">
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
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider">
                    POSTED
                </span>
            )
        },
        { header: 'Narration', accessor: (v) => v.narration || '-', className: 'text-slate-500 dark:text-slate-400 max-w-[200px] truncate' },
        {
            header: 'Actions',
            accessor: (v) => (
                <div className="flex items-center gap-1">
                    <Link href={`/finance/vouchers/${type || 'journal'}/${v.id}`}>
                        <button className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all" title="View">
                            <Eye size={16} strokeWidth={2.5} />
                        </button>
                    </Link>
                    <Link href={`/finance/vouchers/${type || 'journal'}/${v.id}/edit`}>
                        <button className="p-2 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all" title="Edit">
                            <Edit3 size={16} strokeWidth={2.5} />
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
                        className="p-2 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                        title="Delete"
                    >
                        <Trash2 size={16} strokeWidth={2.5} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                            Voucher Registry
                        </h1>
                        <p className="text-slate-500 mt-1 text-[10px] uppercase font-bold tracking-widest">
                            Manage all accounting entries and financial transactions.
                        </p>
                    </div>
                    <Link href={`/finance/vouchers/${type || 'journal'}/new`}>
                        <button className="px-5 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 hover:scale-105 transition-all active:scale-95 flex items-center gap-2 text-sm">
                            <Plus size={18} strokeWidth={3} />
                            New Voucher
                        </button>
                    </Link>
                </div>

                <div className="space-y-4">
                    <VoucherTabs />

                    <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm p-2 overflow-hidden">
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
