"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable from '@/components/DataTable';

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
        fetch('/api/finance/coa')
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

    const columns = [
        {
            header: 'Code',
            accessor: (acc: Account) => (
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs">{acc.code}</span>
            )
        },
        {
            header: 'Account Name',
            accessor: (acc: Account) => (
                <div className="flex items-center gap-2" style={{ paddingLeft: `${acc.level * 24}px` }}>
                    {!acc.isPosting && <span className="text-slate-400">📁</span>}
                    <span className={acc.isPosting ? 'font-bold' : 'text-slate-500'}>{acc.name}</span>
                </div>
            )
        },
        {
            header: 'Type',
            accessor: (acc: Account) => acc.type,
            className: 'text-xs uppercase tracking-wider opacity-60'
        },
        {
            header: 'Mode',
            accessor: (acc: Account) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${acc.isPosting ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                    {acc.isPosting ? 'POSTING' : 'SUMMARY'}
                </span>
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

                {isLoading ? (
                    <div className="h-64 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <DataTable
                        data={accounts}
                        columns={columns}
                        searchPlaceholder="Search accounts by code or name..."
                    />
                )}
            </div>
        </MainLayout>
    );
}
