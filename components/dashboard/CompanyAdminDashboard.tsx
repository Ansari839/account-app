"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Plus, FileText, ShoppingCart, PackageOpen, LineChart, Users, ClipboardList, Wallet } from 'lucide-react';
import StatCard from './StatCard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Stats {
    monthlySales: number;
    totalReceivables: number;
    totalStockItems: number;
    netProfit: number;
}

const chartData = [
  { name: 'Jan', revenue: 4200 },
  { name: 'Feb', revenue: 3800 },
  { name: 'Mar', revenue: 5100 },
  { name: 'Apr', revenue: 4900 },
  { name: 'May', revenue: 6200 },
  { name: 'Jun', revenue: 5800 },
  { name: 'Jul', revenue: 7500 },
  { name: 'Aug', revenue: 8400 },
  { name: 'Sep', revenue: 7900 },
  { name: 'Oct', revenue: 9200 },
  { name: 'Nov', revenue: 10500 },
  { name: 'Dec', revenue: 12000 },
];

export default function CompanyAdminDashboard({ stats, loading }: { stats: Stats | null, loading: boolean }) {
    const router = useRouter();

    const statCards = [
        { label: 'Monthly Sales', value: stats ? `$${stats.monthlySales.toLocaleString()}` : '$0', icon: LineChart, change: '+12.5%', color: 'indigo' },
        { label: 'Receivables', value: stats ? `$${stats.totalReceivables.toLocaleString()}` : '$0', icon: Users, change: '-2.4%', color: 'rose' },
        { label: 'Inventory Items', value: stats ? stats.totalStockItems.toString() : '0', icon: ClipboardList, change: '+5.1%', color: 'emerald' },
        { label: 'Net Profit (Est)', value: stats ? `$${(stats.monthlySales * 0.2).toLocaleString()}` : '$0', icon: Wallet, change: '+8.2%', color: 'purple' }
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
                <div className="lg:col-span-2 bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-8 h-[400px] relative">
                    <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">Revenue Trend</h3>
                    <div className="h-[280px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.6}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.15} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `$${val/1000}k`} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
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
