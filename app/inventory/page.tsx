"use client";

import React from 'react';
import MainLayout from '@/components/MainLayout';
import Link from 'next/link';
import { Package, Warehouse, Tags, ArrowRight } from 'lucide-react';

const inventoryModules = [
    {
        title: 'Item Master',
        desc: 'Product catalog, SKU management, and unit definitions.',
        path: '/inventory/products',
        icon: Package,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'group-hover:border-blue-500/50'
    },
    {
        title: 'Storage Locations',
        desc: 'Warehouse management and distribution center settings.',
        path: '/inventory/warehouses',
        icon: Warehouse,
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        border: 'group-hover:border-emerald-500/50'
    },
    {
        title: 'Categories',
        desc: 'Organize products into hierarchical categories.',
        path: '/inventory/categories',
        icon: Tags,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        border: 'group-hover:border-purple-500/50'
    }
];

export default function InventoryIndex() {
    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Inventory Management
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base max-w-2xl">
                        Control your stock levels, warehouse locations, and product catalog efficiently.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                    {inventoryModules.map((mod) => {
                        const Icon = mod.icon;
                        return (
                            <Link
                                key={mod.title}
                                href={mod.path}
                                className={`group flex flex-col p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 ${mod.border}`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-colors ${mod.bg} ${mod.color}`}>
                                    <Icon size={24} strokeWidth={2} />
                                </div>
                                
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        {mod.title}
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                        {mod.desc}
                                    </p>
                                </div>

                                <div className="mt-6 flex items-center text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    <span>Manage Module</span>
                                    <ArrowRight size={16} className="ml-2 transform group-hover:translate-x-1 transition-transform" />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </MainLayout>
    );
}
