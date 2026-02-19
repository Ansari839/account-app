"use client";

import React from 'react';
import Link from 'next/link';

interface Stats {
    monthlySales: number;
    invoiceCount: number;
    pendingOrders: number;
}

export default function SalesDashboard({ stats, loading }: { stats: Stats | null, loading: boolean }) {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Sales Overview</h1>
                    <p className="text-slate-400 mt-1">Your sales performance this month.</p>
                </div>
                <Link href="/finance/sales/orders/new" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">
                    New Order
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase">My Sales (Month)</p>
                    <h2 className="text-3xl font-black text-white mt-2">
                        {loading ? "..." : `$${(stats?.monthlySales || 0).toLocaleString()}`}
                    </h2>
                </div>
                <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase">Invoices Created</p>
                    <h2 className="text-3xl font-black text-white mt-2">
                        {loading ? "..." : stats?.invoiceCount || 0}
                    </h2>
                </div>
                <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase">Pending Orders</p>
                    <h2 className="text-3xl font-black text-amber-500 mt-2">
                        {loading ? "..." : stats?.pendingOrders || 0}
                    </h2>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Items or Shortcuts */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-8">
                    <h3 className="text-lg font-bold text-white mb-6">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Link href="/finance/sales/orders" className="p-4 bg-slate-700/50 rounded-xl hover:bg-slate-700 text-center transition-colors">
                            <span className="text-2xl block mb-2">📋</span>
                            <span className="text-sm font-bold text-white">View Orders</span>
                        </Link>
                        <Link href="/finance/sales/invoices" className="p-4 bg-slate-700/50 rounded-xl hover:bg-slate-700 text-center transition-colors">
                            <span className="text-2xl block mb-2">🧾</span>
                            <span className="text-sm font-bold text-white">View Invoices</span>
                        </Link>
                        <Link href="/finance/sales/customers" className="p-4 bg-slate-700/50 rounded-xl hover:bg-slate-700 text-center transition-colors">
                            <span className="text-2xl block mb-2">👥</span>
                            <span className="text-sm font-bold text-white">Customers</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
