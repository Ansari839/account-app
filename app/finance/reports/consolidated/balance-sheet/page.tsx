"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';
import { Globe2, ArrowLeft, RefreshCw, Printer, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface ConsolidatedLine {
    code: string;
    name: string;
    type: string;
    level: number;
    companies: Record<string, number>;
    total: number;
}

interface Company {
    id: string;
    name: string;
}

interface ReportData {
    companies: Company[];
    assets: ConsolidatedLine[];
    liabilities: ConsolidatedLine[];
    equity: ConsolidatedLine[];
}

export default function ConsolidatedBalanceSheetPage() {
    const { showNotification } = useNotifications();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ReportData | null>(null);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await authenticatedFetch(`/api/finance/reports/consolidated/balance-sheet?endDate=${endDate}`);
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
    }, []);

    const formatCurrency = (amount: number) => {
        if (Math.abs(amount) < 0.01) return '-';
        return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    };

    const renderSection = (title: string, lines: ConsolidatedLine[], companies: Company[]) => {
        const totalForSection = (compId?: string) => {
            return lines.reduce((sum, line) => sum + (compId ? (line.companies[compId] || 0) : line.total), 0);
        }

        return (
            <div className="mb-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden print:border-2 print:border-black print:rounded-none print:shadow-none">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 print:border-black print:bg-slate-100">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-widest">{title}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-black text-xs print:bg-slate-200 print:text-black">
                            <tr>
                                <th className="px-6 py-4 min-w-[300px]">Account</th>
                                <th className="px-6 py-4 w-24 border-l border-slate-200 dark:border-slate-700/50 print:border-black">Code</th>
                                {companies.map(c => (
                                    <th key={c.id} className="px-6 py-4 text-right min-w-[150px] border-l border-slate-200 dark:border-slate-700/50 print:border-black text-teal-600 dark:text-teal-400">{c.name}</th>
                                ))}
                                <th className="px-6 py-4 text-right font-black text-slate-800 dark:text-white border-l border-slate-200 dark:border-slate-700 bg-slate-200/50 dark:bg-slate-800 print:border-black print:bg-slate-300">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 print:divide-black">
                            {lines.map((line) => (
                                <tr key={line.code} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-300">
                                        <div style={{ paddingLeft: `${line.level * 20}px` }}>
                                            {line.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 font-mono text-slate-400 dark:text-slate-500 text-xs border-l border-slate-100 dark:border-slate-700/50 print:border-black">{line.code}</td>
                                    {companies.map(c => (
                                        <td key={c.id} className="px-6 py-3 text-right font-mono font-medium text-slate-600 dark:text-slate-400 border-l border-slate-100 dark:border-slate-700/50 print:border-black print:text-black">
                                            {formatCurrency(line.companies[c.id] || 0)}
                                        </td>
                                    ))}
                                    <td className="px-6 py-3 text-right font-mono font-bold text-slate-800 dark:text-white border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 print:border-black print:text-black">
                                        {formatCurrency(line.total)}
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-slate-100 dark:bg-slate-800 font-black text-slate-800 dark:text-white border-t-2 border-slate-300 dark:border-slate-600 print:border-black print:bg-slate-200">
                                <td colSpan={2} className="px-6 py-4 text-right uppercase tracking-widest text-xs">Total {title}</td>
                                {companies.map(c => (
                                    <td key={c.id} className="px-6 py-4 text-right font-mono text-teal-600 dark:text-teal-400 border-l border-slate-200 dark:border-slate-600 print:border-black print:text-black">
                                        {formatCurrency(totalForSection(c.id))}
                                    </td>
                                ))}
                                <td className="px-6 py-4 text-right font-mono text-lg border-l border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-900 print:border-black print:text-black print:bg-slate-300">
                                    {formatCurrency(totalForSection())}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const getTotal = (section: ConsolidatedLine[], compId?: string) => {
        return section.reduce((sum, line) => sum + (compId ? (line.companies[compId] || 0) : line.total), 0);
    }

    return (
        <MainLayout>
            <div className="max-w-[90rem] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32">
                
                {/* SCREEN ONLY HEADER */}
                <div className="print:hidden bg-slate-950 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden border border-slate-800 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-xs font-bold text-teal-400 uppercase tracking-widest mb-3">
                            <button onClick={() => router.push('/finance/reports')} className="hover:text-teal-300 transition-colors flex items-center gap-1">
                                <ArrowLeft size={14}/> Reports Hub
                            </button>
                            <span className="opacity-50">/</span>
                            <span className="text-white">Consolidated</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
                            <Globe2 className="text-teal-500 hidden md:block" size={40} />
                            Group Balance Sheet
                        </h1>
                        <p className="text-slate-400 font-medium mt-1">Multi-company financial position consolidation.</p>
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
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black rounded-xl shadow-lg shadow-teal-500/20 hover:scale-105 transition-transform"
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
                            className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-teal-500 font-bold text-slate-700 dark:text-slate-300"
                        />
                    </div>
                    <button 
                        onClick={fetchData} 
                        className="px-8 py-3 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-black rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors border border-teal-200 dark:border-teal-800 whitespace-nowrap h-[46px]"
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
                            <h2 className="text-2xl font-bold uppercase text-slate-600 mb-4">Consolidated Balance Sheet</h2>
                            <div className="flex justify-center items-center gap-4 text-sm font-medium text-slate-500">
                                <span className="bg-slate-100 px-4 py-1 rounded-full border border-slate-300">As of: {new Date(endDate).toLocaleDateString()}</span>
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-32 flex flex-col items-center justify-center print:hidden">
                                <div className="relative w-16 h-16 mb-6">
                                    <div className="absolute inset-0 border-4 border-teal-200 dark:border-teal-900 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                                <p className="text-slate-500 font-black uppercase tracking-widest text-sm animate-pulse">Consolidating Financials...</p>
                            </div>
                        ) : data ? (
                            <div className="space-y-12">
                                {renderSection('Assets', data.assets, data.companies)}

                                {renderSection('Liabilities', data.liabilities, data.companies)}
                                {renderSection('Equity', data.equity, data.companies)}

                                {/* Totals Check */}
                                <div className="bg-slate-950 rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl relative print:border-2 print:border-black print:rounded-none print:shadow-none print:bg-white p-8">
                                    <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-emerald-500/10 pointer-events-none print:hidden"></div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                        <div className="bg-slate-900/80 print:bg-slate-100 p-6 rounded-2xl border border-slate-800 print:border-black">
                                            <h4 className="text-sm font-black text-slate-400 print:text-slate-600 uppercase tracking-widest mb-2">Total Assets</h4>
                                            <div className="text-4xl font-mono font-black text-teal-400 print:text-teal-700">
                                                {formatCurrency(getTotal(data.assets))}
                                            </div>
                                        </div>
                                        <div className="bg-slate-900/80 print:bg-slate-100 p-6 rounded-2xl border border-slate-800 print:border-black">
                                            <h4 className="text-sm font-black text-slate-400 print:text-slate-600 uppercase tracking-widest mb-2">Total Liab + Equity</h4>
                                            <div className="text-4xl font-mono font-black text-emerald-400 print:text-emerald-700">
                                                {formatCurrency(getTotal(data.liabilities) + getTotal(data.equity))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700 print:hidden">
                                <Globe2 size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                                <p className="text-slate-500 font-bold text-lg">Select date to view consolidated balance sheet.</p>
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
