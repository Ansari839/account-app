"use client";

import React from 'react';
import Link from 'next/link';

interface Stats {
    lowStockItems: number;
    pendingDelivery: number;
    pendingGRN: number;
}

export default function WarehouseDashboard({ stats, loading }: { stats: Stats | null, loading: boolean }) {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Warehouse Operations</h1>
                    <p className="text-slate-400 mt-1">Stock and Fulfillment.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase">Pending Deliveries (SO)</p>
                    <h2 className="text-3xl font-black text-blue-400 mt-2">
                        {loading ? "..." : stats?.pendingDelivery || 0}
                    </h2>
                </div>
                <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase">Pending Inbound (PO)</p>
                    <h2 className="text-3xl font-black text-amber-500 mt-2">
                        {loading ? "..." : stats?.pendingGRN || 0}
                    </h2>
                </div>
                <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase">Low Stock Alerts</p>
                    <h2 className="text-3xl font-black text-rose-500 mt-2">
                        {loading ? "..." : stats?.lowStockItems || 0}
                    </h2>
                </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-8">
                <h3 className="text-lg font-bold text-white mb-6">Inventory Actions</h3>
                <div className="flex gap-4">
                    <Link href="/inventory" className="p-4 bg-slate-700/50 rounded-xl hover:bg-slate-700 text-center transition-colors min-w-[120px]">
                        <span className="text-2xl block mb-2">📦</span>
                        <span className="text-sm font-bold text-white">Stock List</span>
                    </Link>
                    <Link href="/finance/purchase/grn" className="p-4 bg-slate-700/50 rounded-xl hover:bg-slate-700 text-center transition-colors min-w-[120px]">
                        <span className="text-2xl block mb-2">📥</span>
                        <span className="text-sm font-bold text-white">Inbound GRN</span>
                    </Link>
                    <Link href="/finance/sales/delivery-notes" className="p-4 bg-slate-700/50 rounded-xl hover:bg-slate-700 text-center transition-colors min-w-[120px]">
                        <span className="text-2xl block mb-2">📤</span>
                        <span className="text-sm font-bold text-white">Outbound DO</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
