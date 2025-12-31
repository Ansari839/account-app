"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable, { Column } from '@/components/DataTable';
import { authenticatedFetch } from '@/lib/api-client';

interface Account {
    id: string;
    code: string;
    name: string;
    type: string;
    isPosting: boolean;
    level: number;
}

export default function COAPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        authenticatedFetch('/api/finance/coa')
            .then(res => res.json())
            .then(json => {
                if (!json.success || !Array.isArray(json.data)) {
                    console.error('Failed to load COA:', json.error);
                    return;
                }
                // Flatten the hierarchy for the table view
                const flatten = (items: any[]): Account[] => {
                    return items.flatMap(item => [
                        { id: item.id, code: item.code, name: item.name, type: item.type, isPosting: item.isPosting, level: item.level },
                        ...(item.children ? flatten(item.children) : [])
                    ]);
                };
                setAccounts(flatten(json.data));
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Fetch error:', err);
                setIsLoading(false);
            });
    }, []);

    const getAccountColor = (type: string) => {
        switch (type) {
            case 'ASSET': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
            case 'LIABILITY': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
            case 'EQUITY': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
            case 'INCOME': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
            case 'EXPENSE': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
            default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
        }
    };

    const columns: Column<Account>[] = [
        {
            header: 'Code',
            accessor: (acc: Account) => (
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold tracking-tighter text-slate-400 opacity-60">#</span>
                    <span className="font-mono text-xs font-semibold">{acc.code}</span>
                </div>
            )
        },
        {
            header: 'Account Name',
            accessor: (acc: Account) => (
                <div className="flex items-center relative py-1 md:py-2" style={{ paddingLeft: `${acc.level * 24}px` }}>
                    {/* Visual markers for nesting levels */}
                    {Array.from({ length: acc.level }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute top-0 bottom-0 border-l border-slate-200 dark:border-slate-800/40 h-full"
                            style={{ left: `${(i * 24) + 11}px` }}
                        />
                    ))}

                    <div className={`flex items-center gap-3 ${acc.level === 0 ? 'text-slate-900 dark:text-white font-black uppercase tracking-wide' : ''}`}>
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-colors ${acc.isPosting ? 'bg-slate-100 dark:bg-slate-800' : 'bg-indigo-600 text-white'}`}>
                            {acc.isPosting ? '⚖️' : '📁'}
                        </div>
                        <span className={`${acc.isPosting ? 'text-sm font-medium' : 'text-sm font-bold'}`}>
                            {acc.name}
                        </span>
                    </div>
                </div>
            )
        },
        {
            header: 'Nature',
            accessor: (acc: Account) => (
                <div className={`px-2.5 py-1 rounded-full border text-[9px] font-black tracking-widest ${getAccountColor(acc.type)}`}>
                    {acc.type}
                </div>
            )
        },
        {
            header: 'Classification',
            accessor: (acc: Account) => (
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${acc.isPosting ? 'bg-emerald-500' : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]'}`}></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {acc.isPosting ? 'Posting' : 'Group'} Account
                    </span>
                </div>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
                        <p className="text-slate-500 mt-1">Manage your financial hierarchy and account definitions.</p>
                    </div>
                    <button className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">
                        + New Account
                    </button>
                </div>

                <DataTable
                    data={accounts}
                    columns={columns}
                    isLoading={isLoading}
                    searchPlaceholder="Search accounts by code or name..."
                />
            </div>
        </MainLayout>
    );
}
