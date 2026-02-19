"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';
import { useCompany } from '@/context/CompanyContext';

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
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Consolidated Trial Balance</h1>
                        <p className="text-slate-400 mt-1">Multi-company financial aggregation.</p>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-xl border border-slate-700">
                        <span className="text-sm font-medium text-slate-400 pl-2">As of:</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2"
                        />
                        <button
                            onClick={fetchData}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-bold transition-colors"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                        <p className="text-slate-400">Aggregating financial data across companies...</p>
                    </div>
                ) : data ? (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-400 whitespace-nowrap">
                            <thead className="bg-slate-900/50 text-slate-200 uppercase font-bold text-xs sticky top-0">
                                <tr>
                                    <th className="px-6 py-4 min-w-[100px]">Code</th>
                                    <th className="px-6 py-4 min-w-[250px]">Account Name</th>
                                    <th className="px-6 py-4">Type</th>
                                    {data.companies.map(c => (
                                        <th key={c.id} className="px-6 py-4 text-right min-w-[150px] border-l border-slate-700/50">{c.name}</th>
                                    ))}
                                    <th className="px-6 py-4 text-right font-black text-white border-l border-slate-700 bg-slate-900/80">Group Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {data.report.map((line) => {
                                    const netTotal = line.totalDebit - line.totalCredit;
                                    const isCredit = ['LIABILITY', 'EQUITY', 'INCOME'].includes(line.type);

                                    // Professional display: DR is positive, CR is usually shown in bracket or negative
                                    // For this report, we show plain numbers. If Credit type, we might want to invert for display or keep as is.
                                    // Let's standard: 
                                    // Assets/Expense: Positive = Debit
                                    // Liability/Equity/Income: Negative = Credit (or inverted)
                                    // Just show raw net value (Debit - Credit)

                                    return (
                                        <tr key={line.code} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-3 font-mono text-slate-500">{line.code}</td>
                                            <td className="px-6 py-3 font-medium text-slate-300">{line.name}</td>
                                            <td className="px-6 py-3 text-xs">{line.type}</td>
                                            {data.companies.map(c => (
                                                <td key={c.id} className="px-6 py-3 text-right font-mono border-l border-slate-700/50">
                                                    {formatCurrency(line.companies[c.id] || 0)}
                                                </td>
                                            ))}
                                            <td className="px-6 py-3 text-right font-mono font-bold text-white border-l border-slate-700 bg-slate-900/30">
                                                {formatCurrency(netTotal)}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {/* Grand Totals Row */}
                                <tr className="bg-slate-900/80 font-bold text-slate-100 border-t-2 border-slate-600">
                                    <td colSpan={3} className="px-6 py-4 text-right uppercase">Total Net Balance</td>
                                    {data.companies.map(c => {
                                        const total = data.report.reduce((sum, line) => sum + (line.companies[c.id] || 0), 0);
                                        return (
                                            <td key={c.id} className="px-6 py-4 text-right font-mono border-l border-slate-600">
                                                {formatCurrency(total)}
                                            </td>
                                        );
                                    })}
                                    <td className="px-6 py-4 text-right font-mono text-white border-l border-slate-600 bg-slate-900">
                                        {formatCurrency(data.report.reduce((sum, line) => sum + (line.totalDebit - line.totalCredit), 0))}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
                        <p className="text-slate-400">Select a date and click Refresh to view the report.</p>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
