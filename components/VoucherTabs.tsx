"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, CreditCard, Wallet, RefreshCcw } from 'lucide-react';

const TABS = [
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'payment', label: 'Payment', icon: CreditCard },
    { id: 'receipt', label: 'Receipt', icon: Wallet },
    { id: 'contra', label: 'Contra', icon: RefreshCcw },
];

export default function VoucherTabs() {
    const pathname = usePathname();

    return (
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
            {TABS.map(tab => {
                const path = `/finance/vouchers/${tab.id}`;
                const isActive = pathname === path || (pathname === '/finance/vouchers' && tab.id === 'journal');
                const Icon = tab.icon;

                return (
                    <Link
                        key={tab.id}
                        href={path}
                        className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-sm ${
                            isActive
                                ? 'bg-indigo-600 text-white shadow-indigo-500/30'
                                : 'bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                    >
                        <Icon size={18} className={isActive ? 'text-indigo-200' : 'text-slate-400'} />
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}
