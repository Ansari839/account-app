"use client";

import React, { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { useParams, useSearchParams } from 'next/navigation';

export default function ReportViewer() {
    const { type } = useParams();
    const searchParams = useSearchParams();
    const reportType = (type as string)?.replace(/-/g, ' ').toUpperCase() || 'REPORT';
    const subType = searchParams.get('type');

    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-8">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">
                            <span>Reports</span>
                            <span>/</span>
                            <span>{reportType}</span>
                            {subType && <span>({subType})</span>}
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">{reportType}</h1>
                        <p className="text-slate-500 mt-1">Generate and analyze your real-time financial data.</p>
                    </div>

                    <div className="flex gap-3">
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm font-medium">
                            <span className="text-slate-400">📅</span>
                            <span>Current Year</span>
                        </div>
                        <button className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">
                            Generate PDF
                        </button>
                    </div>
                </div>

                {/* Report Placeholder Content */}
                <div className="bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-12 text-center">
                    <div className="max-w-md mx-auto space-y-4">
                        <div className="text-5xl mb-6">📉</div>
                        <h2 className="text-xl font-bold">Ready to Analyze?</h2>
                        <p className="text-slate-500 text-sm">
                            The {reportType} engine is initialized. Click the generate button above to fetch the latest ledger balances and compute the statement.
                        </p>
                        <div className="pt-4">
                            <button className="px-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-all">
                                Load Live Data
                            </button>
                        </div>
                    </div>
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
