"use client";

import React from 'react';
import Link from 'next/link';
import { PackageSearch, Inbox, Send, AlertTriangle, Clock } from 'lucide-react';
import StatCard from './StatCard';

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
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                        Warehouse Operations
                    </h1>
                    <p className="text-slate-500 mt-1">Stock and Fulfillment.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    label="Pending Deliveries (SO)" 
                    value={stats?.pendingDelivery || 0} 
                    icon={Send} 
                    color="blue" 
                    loading={loading} 
                />
                <StatCard 
                    label="Pending Inbound (PO)" 
                    value={stats?.pendingGRN || 0} 
                    icon={Clock} 
                    color="amber" 
                    loading={loading} 
                />
                <StatCard 
                    label="Low Stock Alerts" 
                    value={stats?.lowStockItems || 0} 
                    icon={AlertTriangle} 
                    color="rose" 
                    loading={loading} 
                />
            </div>

            <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Inventory Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <Link href="/inventory" className="group flex flex-col items-center justify-center p-8 bg-white/60 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-3xl hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-2 transition-all duration-300">
                        <div className="p-5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                            <PackageSearch className="w-8 h-8" strokeWidth={2} />
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">Stock List</span>
                    </Link>
                    <Link href="/finance/purchase/grn" className="group flex flex-col items-center justify-center p-8 bg-white/60 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-3xl hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-2 transition-all duration-300">
                        <div className="p-5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                            <Inbox className="w-8 h-8" strokeWidth={2} />
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">Inbound GRN</span>
                    </Link>
                    <Link href="/finance/sales/delivery-notes" className="group flex flex-col items-center justify-center p-8 bg-white/60 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-3xl hover:bg-blue-500/10 hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-2 transition-all duration-300">
                        <div className="p-5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                            <Send className="w-8 h-8" strokeWidth={2} />
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">Outbound DO</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
