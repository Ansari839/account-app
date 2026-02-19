"use client";

import React from 'react';
import Link from 'next/link';

interface Stats {
    totalCompanies: number;
    totalUsers: number;
    globalMonthlyRevenue: number;
    newCompaniesThisMonth: number;
}

export default function SuperAdminDashboard({ stats, loading }: { stats: Stats | null, loading: boolean }) {

    const statCards = [
        { label: 'Total Companies', value: stats ? stats.totalCompanies.toString() : '0', icon: '🏢', color: 'indigo' },
        { label: 'Total Users', value: stats ? stats.totalUsers.toString() : '0', icon: '👥', color: 'blue' },
        { label: 'Global Monthly Revenue', value: stats ? `$${stats.globalMonthlyRevenue.toLocaleString()}` : '$0', icon: '💰', color: 'emerald' },
        { label: 'New This Month', value: stats ? stats.newCompaniesThisMonth.toString() : '0', icon: '✨', color: 'purple' }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Platform Overview
                    </h1>
                    <p className="text-slate-400 mt-1">Global system statistics and management.</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/admin/companies" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">Manage Companies</Link>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, i) => (
                    <div key={i} className="group p-6 bg-slate-800/50 border border-slate-700 rounded-2xl cursor-default hover:bg-slate-800 transition-all">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{stat.label}</p>
                                {loading ? (
                                    <div className="h-8 w-16 bg-slate-700 animate-pulse rounded"></div>
                                ) : (
                                    <h2 className="text-3xl font-black text-white">{stat.value}</h2>
                                )}
                            </div>
                            <div className={`p-3 rounded-xl bg-${stat.color}-500/10 text-${stat.color}-500 text-2xl`}>
                                {stat.icon}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Consolidated Reports Section */}
            <div>
                <h2 className="text-xl font-bold text-white mb-4">Consolidated Intelligence</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Link href="/finance/reports/consolidated/trial-balance" className="p-6 bg-slate-800/30 border border-slate-700 hover:border-indigo-500/50 rounded-2xl group transition-all">
                        <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">⚖️</div>
                        <h3 className="text-lg font-bold text-white mb-2">Consolidated Trial Balance</h3>
                        <p className="text-sm text-slate-400">Aggregated view across all companies.</p>
                    </Link>
                    <Link href="/finance/reports/consolidated/profit-loss" className="p-6 bg-slate-800/30 border border-slate-700 hover:border-emerald-500/50 rounded-2xl group transition-all">
                        <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">📉</div>
                        <h3 className="text-lg font-bold text-white mb-2">Consolidated P&L</h3>
                        <p className="text-sm text-slate-400">Income & Expense summary for the group.</p>
                    </Link>
                    <Link href="/finance/reports/consolidated/balance-sheet" className="p-6 bg-slate-800/30 border border-slate-700 hover:border-blue-500/50 rounded-2xl group transition-all">
                        <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">🏛️</div>
                        <h3 className="text-lg font-bold text-white mb-2">Consolidated Balance Sheet</h3>
                        <p className="text-sm text-slate-400">Assets and Liabilities overview.</p>
                    </Link>
                </div>
            </div>
        </div>
    );
}
