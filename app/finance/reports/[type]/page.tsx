"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { useParams, useSearchParams } from 'next/navigation';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';

export default function ReportViewer() {
    const { type } = useParams();
    const searchParams = useSearchParams();
    const reportPath = type as string;
    const reportType = reportPath?.replace(/-/g, ' ').toUpperCase() || 'REPORT';

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Default dates for now (Current Year)
            const start = '2025-01-01';
            const end = '2025-12-31';

            let url = `/api/finance/reports/${reportPath}?startDate=${start}&endDate=${end}`;

            // Special cases for parameters
            if (reportPath === 'ledger') {
                const accId = searchParams.get('accountId');
                if (!accId) {
                    setError("Please select an account for the Ledger report.");
                    setLoading(false);
                    return;
                }
                url += `&accountId=${accId}`;
            }

            const res = await authenticatedFetch(url);
            const json = await res.json();

            if (json.success) {
                setData(json.data);
            } else {
                setError(json.error || "Failed to fetch report data");
            }
        } catch (err) {
            setError("Connectivity error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const renderReportContent = () => {
        if (loading) return (
            <div className="p-20 text-center">
                <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Computing Statement...</p>
            </div>
        );

        if (!data) return (
            <div className="bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-12 text-center">
                <div className="max-w-md mx-auto space-y-4">
                    <div className="text-5xl mb-6">📉</div>
                    <h2 className="text-xl font-bold">{error ? 'Oops!' : 'Ready to Analyze?'}</h2>
                    <p className="text-slate-500 text-sm">
                        {error || `The ${reportType} engine is initialized. Click the button below to fetch live data.`}
                    </p>
                    <div className="pt-4">
                        <button
                            onClick={fetchData}
                            className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all font-bold"
                        >
                            Load Live Data
                        </button>
                    </div>
                </div>
            </div>
        );

        // Conditional Rendering based on Report Type
        if (reportPath === 'trial-balance') {
            const rowWithIds = data.map((r: any, i: number) => ({ ...r, id: `tb-${i}` }));
            const columns: Column<any>[] = [
                { header: 'Code', accessor: (row: any) => row.accountCode },
                { header: 'Account Name', accessor: (row: any) => row.accountName },
                { header: 'Type', accessor: (row: any) => row.type },
                { header: 'Debit', accessor: (row: any) => row.debit > 0 ? `$${row.debit.toLocaleString()}` : '-' },
                { header: 'Credit', accessor: (row: any) => row.credit > 0 ? `$${row.credit.toLocaleString()}` : '-' },
            ];
            return <DataTable data={rowWithIds} columns={columns} />;
        }

        if (reportPath === 'profit-loss') {
            const incomeWithIds = data.income.map((r: any, i: number) => ({ ...r, id: `inc-${i}` }));
            const expenseWithIds = data.expense.map((r: any, i: number) => ({ ...r, id: `exp-${i}` }));

            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-emerald-500 uppercase tracking-tight">Income</h3>
                        <DataTable
                            data={incomeWithIds}
                            columns={[
                                { header: 'Account', accessor: (r: any) => r.name },
                                { header: 'Amount', accessor: (r: any) => `$${r.amount.toLocaleString()}` }
                            ]}
                        />
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex justify-between font-bold">
                            <span>Total Income</span>
                            <span>${data.totalIncome.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-rose-500 uppercase tracking-tight">Expenses</h3>
                        <DataTable
                            data={expenseWithIds}
                            columns={[
                                { header: 'Account', accessor: (r: any) => r.name },
                                { header: 'Amount', accessor: (r: any) => `$${r.amount.toLocaleString()}` }
                            ]}
                        />
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex justify-between font-bold">
                            <span>Total Expense</span>
                            <span>${data.totalExpense.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="md:col-span-2 p-6 bg-indigo-600 text-white rounded-2xl flex justify-between items-center shadow-xl shadow-indigo-500/20">
                        <span className="text-xl font-bold">Net Profit / Loss</span>
                        <span className="text-3xl font-black">${data.netProfit.toLocaleString()}</span>
                    </div>
                </div>
            );
        }

        // Generic fallback for JSON data
        return (
            <pre className="bg-slate-900 text-indigo-400 p-6 rounded-2xl overflow-auto text-xs font-mono border border-slate-800">
                {JSON.stringify(data, null, 2)}
            </pre>
        );
    };

    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-8">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">
                            <span>Reports</span>
                            <span>/</span>
                            <span>{reportType}</span>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">{reportType}</h1>
                        <p className="text-slate-500 mt-1">Generate and analyze your real-time financial data.</p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={fetchData}
                            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all font-bold"
                        >
                            🔄 Refresh
                        </button>
                        <button className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">
                            Generate PDF
                        </button>
                    </div>
                </div>

                <div className="min-h-[400px]">
                    {renderReportContent()}
                </div>

                {/* Report Parameters Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {['Date Range', 'Warehouse', 'Account Group'].map((param, i) => (
                        <div key={i} className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{param}</p>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">All Selected</span>
                                <span className="text-indigo-500 cursor-pointer text-sm font-bold">Change</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </MainLayout>
    );
}
