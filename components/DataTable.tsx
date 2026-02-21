"use client";

import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    pagination?: {
        currentPage: number;
        totalPages: number;
        onPageChange: (page: number) => void;
    };
}

export default function DataTable<T extends { id: string | number }>({
    data,
    columns,
    searchPlaceholder = "Search records...",
    onRowClick,
    actions,
    isLoading = false,
    pagination
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
                    <Search
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors"
                    />
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/50"
                    />
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/30 border-b border-border">
                                {columns.map((col, i) => (
                                    <th key={i} className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        {col.header}
                                    </th>
                                ))}
                                {actions && <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {columns.map((_, j) => (
                                            <td key={j} className="px-6 py-4">
                                                <div className="h-4 bg-muted rounded w-3/4"></div>
                                            </td>
                                        ))}
                                        {actions && <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-1/2 ml-auto"></div></td>}
                                    </tr>
                                ))
                            ) : filteredData.length > 0 ? filteredData.map((item, i) => (
                                <tr
                                    key={item.id}
                                    onClick={() => onRowClick?.(item)}
                                    className={cn(
                                        "group transition-all duration-200 hover:bg-muted/20",
                                        onRowClick && "cursor-pointer"
                                    )}
                                >
                                    {columns.map((col, j) => (
                                        <td key={j} className={cn(
                                            "px-6 py-4 text-sm font-medium text-foreground/80 group-hover:text-foreground",
                                            col.className
                                        )}>
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
                                    <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-16 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-3">
                                            <Inbox size={40} className="text-muted-foreground/30" />
                                            <p className="text-sm font-medium">No records found matching your criteria</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-4">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Page <span className="text-foreground">{pagination.currentPage}</span> of <span className="text-foreground">{pagination.totalPages}</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
                            disabled={pagination.currentPage <= 1}
                            className="p-2 border border-border rounded-lg disabled:opacity-30 hover:bg-muted transition-colors"
                            aria-label="Previous page"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
                            disabled={pagination.currentPage >= pagination.totalPages}
                            className="p-2 border border-border rounded-lg disabled:opacity-30 hover:bg-muted transition-colors"
                            aria-label="Next page"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
