"use client";

import React from 'react';
import Link from 'next/link';
import { Building2, Users, CircleDollarSign, Sparkles, Scale, TrendingDown, Landmark } from 'lucide-react';
import StatCard from './StatCard';

interface Stats {
    totalCompanies: number;
    totalUsers: number;
    globalMonthlyRevenue: number;
    newCompaniesThisMonth: number;
}

export default function SuperAdminDashboard({ stats, loading }: { stats: Stats | null, loading: boolean }) {

    const statCards = [
        { label: 'Total Companies', value: stats ? stats.totalCompanies.toString() : '0', icon: Building2, color: 'indigo' },
        { label: 'Total Users', value: stats ? stats.totalUsers.toString() : '0', icon: Users, color: 'blue' },
        { label: 'Global Monthly Revenue', value: stats ? `$${stats.globalMonthlyRevenue.toLocaleString()}` : '$0', icon: CircleDollarSign, color: 'emerald' },
        { label: 'New This Month', value: stats ? stats.newCompaniesThisMonth.toString() : '0', icon: Sparkles, color: 'purple' }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                        Platform Overview
                    </h1>
                    <p className="text-slate-500 mt-1">Global system statistics and management.</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/admin/companies" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">Manage Companies</Link>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, i) => (
                    <StatCard key={i} {...stat} loading={loading} />
                ))}
            </div>

            {/* Consolidated Reports Section */}
            <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Consolidated Intelligence</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Link href="/finance/reports/consolidated/trial-balance" className="p-8 min-h-[160px] bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 hover:border-indigo-500/50 rounded-3xl group hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
                        <div className="mb-6 text-indigo-600 dark:text-indigo-400 p-4 bg-indigo-500/10 inline-block rounded-2xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                            <Scale className="w-8 h-8" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Consolidated Trial Balance</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Aggregated view across all companies.</p>
                    </Link>
                    <Link href="/finance/reports/consolidated/profit-loss" className="p-8 min-h-[160px] bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 hover:border-emerald-500/50 rounded-3xl group hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300">
                        <div className="mb-6 text-emerald-600 dark:text-emerald-400 p-4 bg-emerald-500/10 inline-block rounded-2xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                            <TrendingDown className="w-8 h-8" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Consolidated P&L</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Income & Expense summary for the group.</p>
                    </Link>
                    <Link href="/finance/reports/consolidated/balance-sheet" className="p-8 min-h-[160px] bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 hover:border-blue-500/50 rounded-3xl group hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300">
                        <div className="mb-6 text-blue-600 dark:text-blue-400 p-4 bg-blue-500/10 inline-block rounded-2xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                            <Landmark className="w-8 h-8" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Consolidated Balance Sheet</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Assets and Liabilities overview.</p>
                    </Link>
                </div>
            </div>
        </div>
    );
}
