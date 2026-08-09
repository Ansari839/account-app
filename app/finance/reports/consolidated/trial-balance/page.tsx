"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';
import { Globe2, ArrowLeft, RefreshCw, Printer, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface ConsolidatedTBLine {
    code: string;
    name: string;
    type: string;
    companies: Record<string, number>;
    totalDebit: number;
    totalCredit: number;
}

interface Company {
    id: string;
    name: string;
}

export default function ConsolidatedTrialBalancePage() {
    const { showNotification } = useNotifications();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<{ companies: Company[], report: ConsolidatedTBLine[] } | null>(null);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await authenticatedFetch(`/api/finance/reports/consolidated/trial-balance?endDate=${endDate}`);
            const json = await res.json();

            if (json.success) {
                setData(json.data);
            } else {
                showNotification('error', json.error || 'Failed to fetch report');
            }
        } catch (error) {
            console.error(error);
            showNotification('error', 'Failed to fetch report');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [endDate]);

    const formatCurrency = (amount: number) => {
        if (Math.abs(amount) < 0.01) return '-';
        return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    };

    return (
        <MainLayout>
            <div className="max-w-[90rem] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32">
                
                {/* SCREEN ONLY HEADER */}
                <div className="print:hidden bg-slate-950 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden border border-slate-800 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-widest mb-3">
                            <button onClick={() => router.push('/finance/reports')} className="hover:text-sky-300 transition-colors flex items-center gap-1">
                                <ArrowLeft size={14}/> Reports Hub
                            </button>
                            <span className="opacity-50">/</span>
                            <span className="text-white">Consolidated</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
                            <Globe2 className="text-sky-500 hidden md:block" size={40} />
                            Group Trial Balance
                        </h1>
                        <p className="text-slate-400 font-medium mt-1">Multi-company financial aggregation and balance check.</p>
                    </div>

                    <div className="relative z-10 flex flex-wrap gap-3">
                        <button
                            onClick={fetchData}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-sm font-bold text-white hover:bg-slate-700 transition-all shadow-sm"
                        >
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh Data
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black rounded-xl shadow-lg shadow-sky-500/20 hover:scale-105 transition-transform"
                        >
                            <Printer size={16} /> Print / PDF
                        </button>
                    </div>
                </div>

                {/* Date Selection - SCREEN ONLY */}
                <div className="print:hidden p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row gap-4 md:items-end shadow-sm">
                    <div className="flex-1 max-w-md">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Calendar size={14}/> As of Date
                        </p>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-sky-500 font-bold text-slate-700 dark:text-slate-300"
                        />
                    </div>
                    <button 
                        onClick={fetchData} 
                        className="px-8 py-3 bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 font-black rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors border border-sky-200 dark:border-sky-800 whitespace-nowrap h-[46px]"
                    >
                        Apply Filters
                    </button>
                </div>

                {/* REPORT CONTENT */}
                <div className="min-h-[400px]">
                    <div className="print:fixed print:inset-0 print:bg-white print:z-[9999] print:p-8 print:overflow-auto">
                        
                        {/* PRINT ONLY HEADER */}
                        <div className="hidden print:block mb-10 text-center border-b-4 border-double border-slate-800 pb-6">
                            <h1 className="text-4xl font-black uppercase tracking-widest text-slate-900 mb-2">Group Consolidation</h1>
                            <h2 className="text-2xl font-bold uppercase text-slate-600 mb-4">Consolidated Trial Balance</h2>
                            <div className="flex justify-center items-center gap-4 text-sm font-medium text-slate-500">
                                <span className="bg-slate-100 px-4 py-1 rounded-full border border-slate-300">As of: {new Date(endDate).toLocaleDateString()}</span>
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-32 flex flex-col items-center justify-center print:hidden">
                                <div className="relative w-16 h-16 mb-6">
                                    <div className="absolute inset-0 border-4 border-sky-200 dark:border-sky-900 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                                <p className="text-slate-500 font-black uppercase tracking-widest text-sm animate-pulse">Aggregating Trial Balance...</p>
                            </div>
                        ) : data ? (
                            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden print:border-2 print:border-black print:rounded-none print:shadow-none">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-black text-xs print:bg-slate-200 print:text-black">
                                            <tr>
                                                <th className="px-6 py-4 min-w-[100px]">Code</th>
                                                <th className="px-6 py-4 min-w-[250px] border-l border-slate-200 dark:border-slate-700/50 print:border-black">Account Name</th>
                                                <th className="px-6 py-4 border-l border-slate-200 dark:border-slate-700/50 print:border-black">Type</th>
                                                {data.companies.map(c => (
                                                    <th key={c.id} className="px-6 py-4 text-right min-w-[150px] border-l border-slate-200 dark:border-slate-700/50 print:border-black text-sky-600 dark:text-sky-400">{c.name}</th>
                                                ))}
                                                <th className="px-6 py-4 text-right font-black text-slate-800 dark:text-white border-l border-slate-200 dark:border-slate-700 bg-slate-200/50 dark:bg-slate-800 print:border-black print:bg-slate-300">Group Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 print:divide-black">
                                            {data.report.map((line) => {
                                                const netTotal = line.totalDebit - line.totalCredit;
                                                return (
                                                    <tr key={line.code} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                                        <td className="px-6 py-3 font-mono text-slate-400 dark:text-slate-500">{line.code}</td>
                                                        <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-300 border-l border-slate-100 dark:border-slate-700/50 print:border-black">{line.name}</td>
                                                        <td className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 border-l border-slate-100 dark:border-slate-700/50 print:border-black">{line.type}</td>
                                                        {data.companies.map(c => (
                                                            <td key={c.id} className="px-6 py-3 text-right font-mono font-medium text-slate-600 dark:text-slate-400 border-l border-slate-100 dark:border-slate-700/50 print:border-black print:text-black">
                                                                {formatCurrency(line.companies[c.id] || 0)}
                                                            </td>
                                                        ))}
                                                        <td className="px-6 py-3 text-right font-mono font-bold text-slate-800 dark:text-white border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 print:border-black print:text-black">
                                                            {formatCurrency(netTotal)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {/* Grand Totals Row */}
                                            <tr className="bg-slate-100 dark:bg-slate-800 font-black text-slate-800 dark:text-white border-t-2 border-slate-300 dark:border-slate-600 print:border-black print:bg-slate-200">
                                                <td colSpan={3} className="px-6 py-4 text-right uppercase tracking-widest text-xs">Total Net Balance</td>
                                                {data.companies.map(c => {
                                                    const total = data.report.reduce((sum, line) => sum + (line.companies[c.id] || 0), 0);
                                                    return (
                                                        <td key={c.id} className={cn(
                                                            "px-6 py-4 text-right font-mono border-l border-slate-200 dark:border-slate-600 print:border-black",
                                                            Math.abs(total) < 0.01 ? "text-emerald-500" : "text-rose-500"
                                                        )}>
                                                            {formatCurrency(total)}
                                                        </td>
                                                    );
                                                })}
                                                <td className={cn(
                                                    "px-6 py-4 text-right font-mono text-lg border-l border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-900 print:border-black print:bg-slate-300",
                                                    Math.abs(data.report.reduce((sum, line) => sum + (line.totalDebit - line.totalCredit), 0)) < 0.01 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                                )}>
                                                    {formatCurrency(data.report.reduce((sum, line) => sum + (line.totalDebit - line.totalCredit), 0))}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700 print:hidden">
                                <Globe2 size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                                <p className="text-slate-500 font-bold text-lg">Select date to view consolidated trial balance.</p>
                            </div>
                        )}

                        {/* PRINT FOOTER */}
                        <div className="hidden print:flex justify-between mt-16 text-xs font-bold text-slate-400 py-4 border-t-2 border-slate-200">
                            <p>Generated on {new Date().toLocaleString()} by Premium Accounting System</p>
                            <p>Page 1 of 1</p>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
