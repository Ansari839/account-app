"use client";

import React from 'react';
import MainLayout from '@/components/MainLayout';
import Link from 'next/link';

const inventoryModules = [
    {
        title: 'Item Master',
        desc: 'Product catalog, SKU management, and unit definitions.',
        path: '/inventory/products',
        icon: '📦',
        color: 'from-blue-500 to-indigo-600'
    },
    {
        title: 'Storage Locations',
        desc: 'Warehouse management and distribution center settings.',
        path: '/inventory/warehouses',
        icon: '🏢',
        color: 'from-emerald-500 to-teal-600'
    },
    {
        title: 'Categories',
        desc: 'Organize products into hierarchical categories.',
        path: '/inventory/categories',
        icon: '🗂️',
        color: 'from-purple-500 to-pink-600'
    }
];

export default function InventoryIndex() {
    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
                    <p className="text-slate-500 mt-1">Control your stock levels, warehouse locations, and product catalog.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {inventoryModules.map((mod) => (
                        <Link
                            key={mod.title}
                            href={mod.path}
                            className="group p-8 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 relative overflow-hidden"
                        >
                            <div className={`absolute -right-4 -top-4 w-32 h-32 bg-gradient-to-br ${mod.color} opacity-5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700`}></div>

                            <div className="relative z-10">
                                <span className="text-4xl mb-4 block">{mod.icon}</span>
                                <h3 className="text-xl font-bold group-hover:text-indigo-500 transition-colors">{mod.title}</h3>
                                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{mod.desc}</p>

                                <div className="mt-6 flex items-center text-xs font-bold text-indigo-500 uppercase tracking-widest gap-2">
                                    Manage Module <span>→</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </MainLayout>
    );
}
