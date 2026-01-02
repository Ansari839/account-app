"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
    { id: 'journal', label: 'Journal', icon: '📝' },
    { id: 'payment', label: 'Payment', icon: '💸' },
    { id: 'receipt', label: 'Receipt', icon: '💰' },
    { id: 'contra', label: 'Contra', icon: '🔄' },
];

export default function VoucherTabs() {
    const pathname = usePathname();

    return (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-slate-200 dark:border-slate-800">
            {TABS.map(tab => {
                const path = `/finance/vouchers/${tab.id}`;
                const isActive = pathname === path;

                return (
                    <Link
                        key={tab.id}
                        href={path}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl font-bold text-sm transition-all relative top-[1px] ${isActive
                            ? 'bg-white dark:bg-slate-900 border-x border-t border-slate-200 dark:border-slate-800 text-indigo-600'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}
