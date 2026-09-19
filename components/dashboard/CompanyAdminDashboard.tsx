"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Plus, FileText, ShoppingCart, PackageOpen, LineChart, Users, ClipboardList, Wallet } from 'lucide-react';
import StatCard from './StatCard';
import PaymentLogs from './PaymentLogs';

interface Stats {
    monthlySales: number;
    totalPurchases: number;
    totalReceivables: number;
    totalPayables: number;
    totalStockItems: number;
    netProfit: number;
    currency?: string;
    chartData?: { name: string, revenue: number }[];
    activeFY?: string;
}

export default function CompanyAdminDashboard({ stats, loading }: { stats: Stats | null, loading: boolean }) {
    const router = useRouter();

    const currencySymbol = stats?.currency || '$';

    const statCards = [
        { label: 'Total FY Sales', value: stats ? `${currencySymbol}${stats.monthlySales.toLocaleString()}` : `${currencySymbol}0`, icon: LineChart, change: '+12.5%', color: 'indigo' },
        { label: 'Total FY Purchases', value: stats ? `${currencySymbol}${stats.totalPurchases.toLocaleString()}` : `${currencySymbol}0`, icon: PackageOpen, change: '+8.3%', color: 'sky' },
        { label: 'Receivables', value: stats ? `${currencySymbol}${stats.totalReceivables.toLocaleString()}` : `${currencySymbol}0`, icon: Users, change: '-2.4%', color: 'rose' },
        { label: 'Payables', value: stats ? `${currencySymbol}${stats.totalPayables.toLocaleString()}` : `${currencySymbol}0`, icon: Wallet, change: '+4.1%', color: 'amber' }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                        Financial Overview
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Company performance metrics. {stats?.activeFY ? <span className="font-semibold text-indigo-600 dark:text-indigo-400 ml-2">Active: {stats.activeFY}</span> : ''}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <Download className="w-4 h-4" /> Export Report
                    </button>
                    <button onClick={() => router.push('/finance/vouchers/journal/new')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">
                        <Plus className="w-4 h-4" strokeWidth={3} /> New Voucher
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, i) => (
                    <StatCard key={i} {...stat} loading={loading} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <PaymentLogs currencySymbol={currencySymbol} />
                </div>

                <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-8">
                    <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Quick Actions</h3>
                    <div className="space-y-4">
                        <Link href="/finance/reports" className="group flex items-center gap-4 p-4 rounded-2xl bg-white/60 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all">
                            <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
                                <FileText className="w-6 h-6" strokeWidth={2} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white">View Reports</p>
                                <p className="text-xs text-slate-500">P&L, Balance Sheet, Ledger</p>
                            </div>
                        </Link>
                        <Link href="/finance/sales/orders/new" className="group flex items-center gap-4 p-4 rounded-2xl bg-white/60 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all">
                            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
                                <ShoppingCart className="w-6 h-6" strokeWidth={2} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white">Create Sales Order</p>
                                <p className="text-xs text-slate-500">Process new customer order</p>
                            </div>
                        </Link>
                        <Link href="/finance/purchase/orders/new" className="group flex items-center gap-4 p-4 rounded-2xl bg-white/60 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 hover:bg-rose-500/10 hover:border-rose-500/30 hover:shadow-lg hover:shadow-rose-500/5 transition-all">
                            <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl group-hover:scale-110 transition-transform">
                                <PackageOpen className="w-6 h-6" strokeWidth={2} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white">Create Purchase Order</p>
                                <p className="text-xs text-slate-500">Order stock from suppliers</p>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
