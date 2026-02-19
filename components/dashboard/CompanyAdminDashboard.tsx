"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Stats {
    monthlySales: number;
    totalReceivables: number;
    totalStockItems: number;
    netProfit: number;
}

export default function CompanyAdminDashboard({ stats, loading }: { stats: Stats | null, loading: boolean }) {
    const router = useRouter();

    const statCards = [
        { label: 'Monthly Sales', value: stats ? `$${stats.monthlySales.toLocaleString()}` : '$0', change: '+12.5%', color: 'indigo' },
        { label: 'Receivables', value: stats ? `$${stats.totalReceivables.toLocaleString()}` : '$0', change: '-2.4%', color: 'rose' },
        { label: 'Inventory Items', value: stats ? stats.totalStockItems.toString() : '0', change: '+5.1%', color: 'emerald' },
        { label: 'Net Profit (Est)', value: stats ? `$${(stats.monthlySales * 0.2).toLocaleString()}` : '$0', change: '+8.2%', color: 'purple' }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                        Financial Overview
                    </h1>
                    <p className="text-slate-500 mt-1">Company performance metrics.</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Export Report</button>
                    <button onClick={() => router.push('/finance/vouchers/journal/new')} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">New Voucher</button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, i) => (
                    <div key={i} className="group p-6 bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-${stat.color}-500/5 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500`}></div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                        <div className="mt-4 flex items-end justify-between">
                            {loading ? (
                                <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg"></div>
                            ) : (
                                <h2 className="text-2xl font-bold">{stat.value}</h2>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${stat.change.startsWith('+') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {stat.change}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-8 h-[400px] relative">
                    <h3 className="text-lg font-bold mb-6">Revenue Trend</h3>
                    <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                        <span className="text-6xl font-black">CHART AREA</span>
                    </div>
                    {/* Placeholder Chart */}
                    <div className="flex h-full items-end gap-2 pb-8">
                        {[40, 70, 45, 90, 65, 80, 50, 85, 95, 60, 75, 100].map((h, i) => (
                            <div key={i} className="flex-1 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all hover:scale-110 cursor-pointer" style={{ height: `${h}%` }}></div>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-8">
                    <h3 className="text-lg font-bold mb-6">Quick Actions</h3>
                    <div className="space-y-4">
                        <Link href="/finance/reports" className="block p-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-indigo-500/10 hover:text-indigo-500 transition-colors">
                            <p className="font-bold">View Reports</p>
                            <p className="text-xs opacity-60">P&L, Balance Sheet, Ledger</p>
                        </Link>
                        <Link href="/finance/sales/orders/new" className="block p-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors">
                            <p className="font-bold">Create Sales Order</p>
                            <p className="text-xs opacity-60">Process new customer order</p>
                        </Link>
                        <Link href="/finance/purchase/orders/new" className="block p-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-rose-500/10 hover:text-rose-500 transition-colors">
                            <p className="font-bold">Create Purchase Order</p>
                            <p className="text-xs opacity-60">Order stock from suppliers</p>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
