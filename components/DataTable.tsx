"use client";

import React, { useState } from 'react';

export interface Column<T> {
    header: string;
    accessor: keyof T | ((item: T) => React.ReactNode);
    className?: string;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    searchPlaceholder?: string;
    onRowClick?: (item: T) => void;
    actions?: (item: T) => React.ReactNode;
    isLoading?: boolean;
}

export default function DataTable<T extends { id: string | number }>({
    data,
    columns,
    searchPlaceholder = "Search records...",
    onRowClick,
    actions,
    isLoading = false
}: DataTableProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredData = data.filter(item =>
        JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Search & Actions Bar */}
            <div className="flex items-center justify-between gap-4">
                <div className="relative group flex-1 max-w-sm">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">🔍</span>
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
                                {columns.map((col, i) => (
                                    <th key={i} className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                                        {col.header}
                                    </th>
                                ))}
                                {actions && <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {columns.map((_, j) => (
                                            <td key={j} className="px-6 py-4">
                                                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4"></div>
                                            </td>
                                        ))}
                                        {actions && <td className="px-6 py-4"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/2 ml-auto"></div></td>}
                                    </tr>
                                ))
                            ) : filteredData.length > 0 ? filteredData.map((item, i) => (
                                <tr
                                    key={item.id}
                                    onClick={() => onRowClick?.(item)}
                                    className={`group transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/40 ${onRowClick ? 'cursor-pointer' : ''}`}
                                >
                                    {columns.map((col, j) => (
                                        <td key={j} className={`px-6 py-4 text-sm font-medium ${col.className || ''}`}>
                                            {typeof col.accessor === 'function' ? col.accessor(item) : (item[col.accessor] as React.ReactNode)}
                                        </td>
                                    ))}
                                    {actions && (
                                        <td className="px-6 py-4 text-right">
                                            {actions(item)}
                                        </td>
                                    )}
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-3xl">🏜️</span>
                                            <p className="text-sm">No records found matching your criteria</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
