"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';

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
            <div className="mb-8">
                <h3 className="text-xl font-bold text-white mb-4 px-4 border-l-4 border-teal-500">{title}</h3>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400 whitespace-nowrap">
                        <thead className="bg-slate-900/50 text-slate-200 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-6 py-4 min-w-[300px]">Account</th>
                                <th className="px-6 py-4 w-24">Code</th>
                                {companies.map(c => (
                                    <th key={c.id} className="px-6 py-4 text-right min-w-[150px] border-l border-slate-700/50">{c.name}</th>
                                ))}
                                <th className="px-6 py-4 text-right font-black text-white border-l border-slate-700 bg-slate-900/80">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {lines.map((line) => (
                                <tr key={line.code} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-3 font-medium text-slate-300">
                                        <div style={{ paddingLeft: `${line.level * 20}px` }}>
                                            {line.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 font-mono text-slate-500 text-xs">{line.code}</td>
                                    {companies.map(c => (
                                        <td key={c.id} className="px-6 py-3 text-right font-mono border-l border-slate-700/50">
                                            {formatCurrency(line.companies[c.id] || 0)}
                                        </td>
                                    ))}
                                    <td className="px-6 py-3 text-right font-mono font-bold text-white border-l border-slate-700 bg-slate-900/30">
                                        {formatCurrency(line.total)}
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-slate-900/80 font-bold text-white border-t-2 border-slate-600">
                                <td colSpan={2} className="px-6 py-4 text-right uppercase">Total {title}</td>
                                {companies.map(c => (
                                    <td key={c.id} className="px-6 py-4 text-right font-mono border-l border-slate-600">
                                        {formatCurrency(totalForSection(c.id))}
                                    </td>
                                ))}
                                <td className="px-6 py-4 text-right font-mono border-l border-slate-600 bg-slate-900">
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
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Consolidated Balance Sheet</h1>
                        <p className="text-slate-400 mt-1">Multi-company financial position.</p>
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
                        <p className="text-slate-400">Consolidating balance sheet...</p>
                    </div>
                ) : data ? (
                    <div className="space-y-8 pb-12">
                        {renderSection('Assets', data.assets, data.companies)}

                        <div className="border-t-2 border-dashed border-slate-700 my-8"></div>

                        {renderSection('Liabilities', data.liabilities, data.companies)}
                        {renderSection('Equity', data.equity, data.companies)}

                        {/* Totals Check */}
                        <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-400 uppercase mb-2">Total Assets</h4>
                                    <div className="text-3xl font-mono font-bold text-teal-400">
                                        {formatCurrency(getTotal(data.assets))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-400 uppercase mb-2">Total Liabilities + Equity</h4>
                                    <div className="text-3xl font-mono font-bold text-teal-400">
                                        {formatCurrency(getTotal(data.liabilities) + getTotal(data.equity))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
                        <p className="text-slate-400">Select date range to view report.</p>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
