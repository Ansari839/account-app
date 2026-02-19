"use client";

import React from 'react';
import Link from 'next/link';

interface Stats {
    monthlyPurchases: number;
    pendingPO: number;
}

export default function PurchaseDashboard({ stats, loading }: { stats: Stats | null, loading: boolean }) {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Purchase Overview</h1>
                    <p className="text-slate-400 mt-1">Procurement status.</p>
                </div>
                <Link href="/finance/purchase/orders/new" className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-500/20 hover:scale-105 transition-all">
                    New Purchase Order
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase">Purchases (Month)</p>
                    <h2 className="text-3xl font-black text-white mt-2">
                        {loading ? "..." : `$${(stats?.monthlyPurchases || 0).toLocaleString()}`}
                    </h2>
                </div>
                <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase">Pending POs</p>
                    <h2 className="text-3xl font-black text-amber-500 mt-2">
                        {loading ? "..." : stats?.pendingPO || 0}
                    </h2>
                </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-8">
                <h3 className="text-lg font-bold text-white mb-6">Quick Actions</h3>
                <div className="flex gap-4">
                    <Link href="/finance/purchase/orders" className="p-4 bg-slate-700/50 rounded-xl hover:bg-slate-700 text-center transition-colors min-w-[120px]">
                        <span className="text-2xl block mb-2">🛒</span>
                        <span className="text-sm font-bold text-white">Orders</span>
                    </Link>
                    <Link href="/finance/purchase/invoices" className="p-4 bg-slate-700/50 rounded-xl hover:bg-slate-700 text-center transition-colors min-w-[120px]">
                        <span className="text-2xl block mb-2">📄</span>
                        <span className="text-sm font-bold text-white">Invoices</span>
                    </Link>
                    <Link href="/finance/purchase/suppliers" className="p-4 bg-slate-700/50 rounded-xl hover:bg-slate-700 text-center transition-colors min-w-[120px]">
                        <span className="text-2xl block mb-2">🚚</span>
                        <span className="text-sm font-bold text-white">Suppliers</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
