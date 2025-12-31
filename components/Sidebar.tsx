"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
    { name: 'Dashboard', icon: '📊', path: '/finance/dashboard' },
    { name: 'Chart of Accounts', icon: '🗂️', path: '/finance/coa' },
    { name: 'Vouchers', icon: '📝', path: '/finance/vouchers', sub: ['Journal', 'Payment', 'Receipt'] },
    { name: 'Sales', icon: '📈', path: '/sales/invoices', sub: ['Order', 'Invoice', 'Return'] },
    { name: 'Purchase', icon: '🛒', path: '/purchase/invoices', sub: ['Order', 'Invoice', 'Return'] },
    { name: 'Inventory', icon: '📦', path: '/inventory', sub: ['Products', 'Warehouses'] },
    { name: 'Reports', icon: '📜', path: '/finance/reports', sub: ['P&L', 'Balance Sheet', 'Ledger', 'Aging'] },
    { name: 'Settings', icon: '⚙️', path: '/admin/settings' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <aside className={`h-screen bg-[#0f172a] text-slate-300 transition-all duration-300 ease-in-out border-r border-slate-800/50 flex flex-col ${isCollapsed ? 'w-20' : 'w-64'} sticky top-0`}>
            {/* Logo Section */}
            <div className="p-6 flex items-center justify-between">
                {!isCollapsed && (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
                            A
                        </div>
                        <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                            Antigravity
                        </span>
                    </div>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1.5 rounded-lg hover:bg-slate-800/50 text-slate-400"
                >
                    {isCollapsed ? '➡️' : '⬅️'}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-2 overflow-y-auto mt-4 scrollbar-hide">
                {menuItems.map((item) => {
                    const isActive = pathname.startsWith(item.path);
                    return (
                        <div key={item.name} className="space-y-1">
                            <Link
                                href={item.path}
                                className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                                    : 'hover:bg-slate-800/50 hover:text-white'
                                    }`}
                            >
                                <span className="text-xl">{item.icon}</span>
                                {!isCollapsed && (
                                    <span className="font-medium flex-1">{item.name}</span>
                                )}
                                {!isCollapsed && item.sub && (
                                    <span className={`text-[10px] transition-transform duration-200 ${isActive ? 'rotate-180 opacity-100' : 'opacity-30'}`}>
                                        ▼
                                    </span>
                                )}
                            </Link>

                            {/* Sub-menu rendering */}
                            {!isCollapsed && item.sub && isActive && (
                                <div className="ml-12 border-l border-slate-800 space-y-1 py-1 animate-in slide-in-from-left-2 duration-300">
                                    {item.sub.map((sub) => {
                                        const subPath = `${item.path}/${sub.toLowerCase()}`;
                                        const isSubActive = pathname === subPath;
                                        return (
                                            <Link
                                                key={sub}
                                                href={subPath}
                                                className={`block px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${isSubActive
                                                    ? 'text-white'
                                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}`}
                                            >
                                                {sub}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* User Block */}
            <div className="p-4 border-t border-slate-800/50">
                <div className={`flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 cursor-pointer transition-colors ${isCollapsed ? 'justify-center' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold border border-slate-600">
                        AA
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-semibold truncate text-white">Abdullah Ansari</p>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Administrator</p>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
