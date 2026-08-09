"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import Link from 'next/link';
import { 
    BarChart3, 
    PieChart, 
    TrendingUp, 
    ArrowRight, 
    Activity, 
    Box, 
    Layers, 
    Calculator,
    Globe2,
    Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';

const reportGroups = [
    {
        title: 'Financial Statements',
        icon: <PieChart size={24} className="text-indigo-400" />,
        color: 'indigo',
        reports: [
            { name: 'Profit & Loss', path: '/finance/reports/profit-loss', desc: 'Income and expense statement' },
            { name: 'Balance Sheet', path: '/finance/reports/balance-sheet', desc: 'Assets, liabilities and equity' },
            { name: 'Cash Flow', path: '/finance/reports/cash-flow', desc: 'Direct cash movement' },
            { name: 'Trial Balance', path: '/finance/reports/trial-balance', desc: 'Account balance verification' },
            { name: 'Trading Account', path: '/finance/reports/trading', desc: 'Gross profit calculation' },
        ]
    },
    {
        title: 'Sub-Ledgers & Aging',
        icon: <Activity size={24} className="text-sky-400" />,
        color: 'sky',
        reports: [
            { name: 'General Ledger', path: '/finance/reports/ledger', desc: 'Detailed account transactions' },
            { name: 'AR Aging', path: '/finance/reports/aging?type=AR', desc: 'Customer outstanding analysis' },
            { name: 'AP Aging', path: '/finance/reports/aging?type=AP', desc: 'Supplier outstanding analysis' },
        ]
    },
    {
        title: 'Inventory & Tax',
        icon: <Box size={24} className="text-emerald-400" />,
        color: 'emerald',
        reports: [
            { name: 'Stock Summary', path: '/finance/reports/stock-summary', desc: 'Warehouse stock levels' },
            { name: 'Stock Item Wise', path: '/finance/reports/stock-item-wise', desc: 'Consolidated item stock' },
            { name: 'Stock Ledger', path: '/finance/reports/stock-ledger', desc: 'Item-wise movement audit' },
            { name: 'Tax Summary', path: '/finance/reports/tax-summary', desc: 'Collected vs paid tax' },
        ]
    }
];

export default function ReportsHub() {
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                setIsSuperAdmin(!!user.isSuperAdmin);
            } catch (e) {
                console.error("Failed to parse user", e);
            }
        }
    }, []);

    const consolidatedGroup = {
        title: 'Consolidated Intelligence',
        icon: <Globe2 size={24} className="text-violet-400" />,
        color: 'violet',
        reports: [
            { name: 'Combined Trial Balance', path: '/finance/reports/consolidated/trial-balance', desc: 'Multi-company TB aggregation' },
            { name: 'Combined Profit & Loss', path: '/finance/reports/consolidated/profit-loss', desc: 'Group Level Performance' },
            { name: 'Combined Balance Sheet', path: '/finance/reports/consolidated/balance-sheet', desc: 'Group Level Financial Position' },
        ]
    };

    const groupsToDisplay = isSuperAdmin ? [...reportGroups, consolidatedGroup] : reportGroups;

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-8 pb-32 animate-in fade-in duration-700">
                
                {/* Premium Dark Header Card */}
                <div className="bg-slate-950 rounded-[2rem] p-10 shadow-2xl shadow-indigo-500/10 relative overflow-hidden border border-slate-800">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-sky-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest">
                                <BarChart3 size={16} /> Financial Intelligence
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
                                Reports & <br className="hidden md:block"/> Analytics Hub
                            </h1>
                            <p className="text-slate-400 font-medium text-lg max-w-xl">
                                Access real-time financial statements, inventory movements, and tax insights across your organization.
                            </p>
                        </div>
                        
                        <div className="hidden md:flex items-center justify-center bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-inner shadow-slate-950">
                            <TrendingUp size={80} className="text-slate-700" strokeWidth={1} />
                        </div>
                    </div>
                </div>

                {/* Report Grids */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {groupsToDisplay.map((group, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                            {/* Group Header */}
                            <div className={cn(
                                "p-6 border-b",
                                group.color === 'indigo' ? "bg-indigo-50/50 dark:bg-indigo-500/5 border-indigo-100 dark:border-indigo-500/10" :
                                group.color === 'sky' ? "bg-sky-50/50 dark:bg-sky-500/5 border-sky-100 dark:border-sky-500/10" :
                                group.color === 'emerald' ? "bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/10" :
                                "bg-violet-50/50 dark:bg-violet-500/5 border-violet-100 dark:border-violet-500/10"
                            )}>
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner",
                                        group.color === 'indigo' ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600" :
                                        group.color === 'sky' ? "bg-sky-100 dark:bg-sky-900/50 text-sky-600" :
                                        group.color === 'emerald' ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600" :
                                        "bg-violet-100 dark:bg-violet-900/50 text-violet-600"
                                    )}>
                                        {group.icon}
                                    </div>
                                    <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">{group.title}</h3>
                                </div>
                            </div>

                            {/* Reports List */}
                            <div className="p-4 flex-1 flex flex-col gap-2">
                                {group.reports.map((report, j) => (
                                    <Link
                                        key={j}
                                        href={report.path}
                                        className="group p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all flex flex-col gap-1"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={cn(
                                                "font-bold transition-colors text-sm",
                                                group.color === 'indigo' ? "text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" :
                                                group.color === 'sky' ? "text-slate-700 dark:text-slate-300 group-hover:text-sky-600 dark:group-hover:text-sky-400" :
                                                group.color === 'emerald' ? "text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" :
                                                "text-slate-700 dark:text-slate-300 group-hover:text-violet-600 dark:group-hover:text-violet-400"
                                            )}>
                                                {report.name}
                                            </span>
                                            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 text-slate-400" />
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium">{report.desc}</p>
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
