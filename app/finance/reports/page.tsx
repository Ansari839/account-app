"use client";

import React from 'react';
import MainLayout from '@/components/MainLayout';
import Link from 'next/link';

const reportGroups = [
    {
        title: 'Financial Statements',
        icon: '📊',
        reports: [
            { name: 'Profit & Loss', path: '/finance/reports/profit-loss', desc: 'Income and expense statement' },
            { name: 'Balance Sheet', path: '/finance/reports/balance-sheet', desc: 'Assets, liabilities and equity' },
            { name: 'Cash Flow', path: '/finance/reports/cash-flow', desc: 'Direct cash movement' },
            { name: 'Trial Balance', path: '/finance/reports/trial-balance', desc: 'Account balance verification' },
        ]
    },
    {
        title: 'Sub-Ledgers & Aging',
        icon: '⏳',
        reports: [
            { name: 'General Ledger', path: '/finance/reports/ledger', desc: 'Detailed account transactions' },
            { name: 'AR Aging', path: '/finance/reports/aging?type=AR', desc: 'Customer outstanding analysis' },
            { name: 'AP Aging', path: '/finance/reports/aging?type=AP', desc: 'Supplier outstanding analysis' },
        ]
    },
    {
        title: 'Inventory & Tax',
        icon: '📦',
        reports: [
            { name: 'Stock Summary', path: '/finance/reports/stock-summary', desc: 'Warehouse stock levels' },
            { name: 'Stock Item Wise', path: '/finance/reports/stock-item-wise', desc: 'Consolidated item stock' },
            { name: 'Stock Ledger', path: '/finance/reports/stock-ledger', desc: 'Item-wise movement audit' },
            { name: 'Tax Summary', path: '/finance/reports/tax-summary', desc: 'Collected vs paid tax' },
        ]
    }
];

export default function ReportsHub() {
    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Report Intelligence</h1>
                    <p className="text-slate-500 mt-1">Access real-time financial, inventory and tax insights.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {reportGroups.map((group, i) => (
                        <div key={i} className="bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-8 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="text-2xl">{group.icon}</span>
                                <h3 className="text-lg font-black uppercase tracking-widest text-slate-400">{group.title}</h3>
                            </div>
                            <div className="space-y-3">
                                {group.reports.map((report, j) => (
                                    <Link
                                        key={j}
                                        href={report.path}
                                        className="block group p-4 rounded-2xl hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-500 transition-colors">{report.name}</span>
                                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                                        </div>
                                        <p className="text-xs text-slate-500">{report.desc}</p>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </MainLayout>
    );
}
