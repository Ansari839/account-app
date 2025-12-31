"use client";

import React from 'react';
import MainLayout from '@/components/MainLayout';

export default function DashboardPage() {
    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                            Financial Overview
                        </h1>
                        <p className="text-slate-500 mt-1">Welcome back. Here's what's happening with your accounts today.</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Export PDF</button>
                        <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">New Voucher</button>
                    </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Revenue', value: '$128,430', change: '+12.5%', color: 'indigo' },
                        { label: 'Receivables', value: '$45,210', change: '-2.4%', color: 'rose' },
                        { label: 'Inventory Value', value: '$89,000', change: '+5.1%', color: 'emerald' },
                        { label: 'Net Profit', value: '$34,920', change: '+8.2%', color: 'purple' }
                    ].map((stat, i) => (
                        <div key={i} className="group p-6 bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-24 h-24 bg-${stat.color}-500/5 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500`}></div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                            <div className="mt-4 flex items-end justify-between">
                                <h2 className="text-2xl font-bold">{stat.value}</h2>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${stat.change.startsWith('+') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                    {stat.change}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Placeholder Charts/Tables */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-8 h-[400px] relative">
                        <h3 className="text-lg font-bold mb-6">Revenue Trend</h3>
                        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                            <span className="text-6xl font-black">CHART AREA</span>
                        </div>
                        <div className="flex h-full items-end gap-2 pb-8">
                            {[40, 70, 45, 90, 65, 80, 50, 85, 95, 60, 75, 100].map((h, i) => (
                                <div key={i} className="flex-1 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all hover:scale-110 cursor-pointer" style={{ height: `${h}%` }}></div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-8">
                        <h3 className="text-lg font-bold mb-6">Recent Vouchers</h3>
                        <div className="space-y-4">
                            {[
                                { id: 'JV-2025-001', date: '2025-01-31', amount: '$5,000', type: 'Journal' },
                                { id: 'PV-2025-042', date: '2025-01-30', amount: '$1,200', type: 'Payment' },
                                { id: 'RV-2025-015', date: '2025-01-29', amount: '$8,500', type: 'Receipt' },
                                { id: 'SINV-2025-09', date: '2025-01-28', amount: '$12,000', type: 'Sales' }
                            ].map((v, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-800 cursor-pointer">
                                    <div>
                                        <p className="text-sm font-bold">{v.id}</p>
                                        <p className="text-[10px] text-slate-500 font-medium">{v.date} • {v.type}</p>
                                    </div>
                                    <p className="text-sm font-black">{v.amount}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
