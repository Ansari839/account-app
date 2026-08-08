"use client";

import React from 'react';
import Link from 'next/link';
import { ShoppingCart, FileText, Truck, Plus, ShoppingBag, Clock } from 'lucide-react';
import StatCard from './StatCard';

interface Stats {
    monthlyPurchases: number;
    pendingPO: number;
}

export default function PurchaseDashboard({ stats, loading }: { stats: Stats | null, loading: boolean }) {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                        Purchase Overview
                    </h1>
                    <p className="text-slate-500 mt-1">Procurement status.</p>
                </div>
                <Link href="/finance/purchase/orders/new" className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-500/20 hover:scale-105 transition-all">
                    <Plus className="w-4 h-4" strokeWidth={3} /> New Purchase Order
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard 
                    label="Purchases (Month)" 
                    value={`$${(stats?.monthlyPurchases || 0).toLocaleString()}`} 
                    icon={ShoppingBag} 
                    color="rose" 
                    loading={loading} 
                />
                <StatCard 
                    label="Pending POs" 
                    value={stats?.pendingPO || 0} 
                    icon={Clock} 
                    color="amber" 
                    loading={loading} 
                />
            </div>

            <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <Link href="/finance/purchase/orders" className="group flex flex-col items-center justify-center p-8 bg-white/60 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-3xl hover:bg-rose-500/10 hover:border-rose-500/30 hover:shadow-2xl hover:shadow-rose-500/10 hover:-translate-y-2 transition-all duration-300">
                        <div className="p-5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                            <ShoppingCart className="w-8 h-8" strokeWidth={2} />
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">Orders</span>
                    </Link>
                    <Link href="/finance/purchase/invoices" className="group flex flex-col items-center justify-center p-8 bg-white/60 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-3xl hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-2 transition-all duration-300">
                        <div className="p-5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                            <FileText className="w-8 h-8" strokeWidth={2} />
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">Invoices</span>
                    </Link>
                    <Link href="/finance/purchase/suppliers" className="group flex flex-col items-center justify-center p-8 bg-white/60 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-3xl hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-2 transition-all duration-300">
                        <div className="p-5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                            <Truck className="w-8 h-8" strokeWidth={2} />
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">Suppliers</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
