"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import Combobox from '@/components/Combobox';
import { 
    Printer, 
    RefreshCw, 
    Calendar, 
    FileBarChart, 
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Layers,
    Box
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReportViewer() {
    const { type } = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const reportPath = type as string;
    const reportType = reportPath?.replace(/-/g, ' ').toUpperCase() || 'REPORT';

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Ledger Specific State
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>(searchParams.get('accountId') || '');

    // Stock Specific State
    const [products, setProducts] = useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<string>(searchParams.get('productId') || '');

    // Default Dates
    const [dateRange, setDateRange] = useState({ start: '2025-01-01', end: '2026-12-31' });

    // Fetch Accounts for Dropdown
    useEffect(() => {
        if (reportPath === 'ledger') {
            authenticatedFetch('/api/accounts')
                .then(res => res.json())
                .then(json => {
                    const list = json.accounts || json.data || [];
                    if (Array.isArray(list)) {
                        const flat = list.map((a: any) => ({
                            value: a.id,
                            label: `${a.code} - ${a.name}`
                        }));
                        setAccounts(flat);
                    }
                });
        }
    }, [reportPath]);

    // Fetch Products for Dropdown
    useEffect(() => {
        if (reportPath === 'stock-ledger') {
            authenticatedFetch('/api/inventory/products')
                .then(res => res.json())
                .then(json => {
                    const list = json.data || [];
                    if (Array.isArray(list)) {
                        const flat = list.map((p: any) => ({
                            value: p.id,
                            label: `${p.code} - ${p.name}`
                        }));
                        setProducts(flat);
                    }
                });
        }
    }, [reportPath]);

    // Handle initial search params for product
    useEffect(() => {
        const prodId = searchParams.get('productId');
        if (prodId) setSelectedProduct(prodId);
    }, [searchParams]);

    // Auto-fetch logic
    useEffect(() => {
        if (reportPath === 'ledger' && !selectedAccount) return;
        if (reportPath === 'stock-ledger' && !selectedProduct) return;
        fetchData();
    }, [reportPath, selectedAccount, selectedProduct]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            let url = `/api/finance/reports/${reportPath}?startDate=${dateRange.start}&endDate=${dateRange.end}`;

            if (reportPath === 'ledger') {
                if (!selectedAccount) {
                    setLoading(false);
                    return;
                }
                url += `&accountId=${selectedAccount}`;
            }

            if (reportPath === 'stock-ledger') {
                if (!selectedProduct) {
                    setLoading(false);
                    return;
                }
                url += `&productId=${selectedProduct}`;
            }

            const res = await authenticatedFetch(url);
            const json = await res.json();

            if (json.success) {
                setData(json.data);
            } else {
                setError(json.error || "Failed to fetch report data");
                setData(null);
            }
        } catch (err) {
            setError("Connectivity error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const renderReportContent = () => {
        if (loading) return (
            <div className="p-32 flex flex-col items-center justify-center">
                <div className="relative w-16 h-16 mb-6">
                    <div className="absolute inset-0 border-4 border-indigo-200 dark:border-indigo-900 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-slate-500 font-black uppercase tracking-widest text-sm animate-pulse">Computing Financials...</p>
            </div>
        );

        if (reportPath === 'ledger' && !selectedAccount) {
            return (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-16 text-center h-64 flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-700">
                    <Layers size={48} className="text-slate-300 dark:text-slate-700 mb-4" />
                    <p className="text-slate-500 font-bold text-lg">Select an account above to view its ledger.</p>
                </div>
            );
        }

        if (reportPath === 'stock-ledger' && !selectedProduct) {
            return (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-16 text-center h-64 flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-700">
                    <Box size={48} className="text-slate-300 dark:text-slate-700 mb-4" />
                    <p className="text-slate-500 font-bold text-lg">Select a product above to view its stock ledger.</p>
                </div>
            );
        }

        if (!data) return (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-16 text-center border border-slate-200 dark:border-slate-800">
                <FileBarChart size={48} className="text-slate-300 dark:text-slate-700 mb-4 mx-auto" />
                <h2 className="text-xl font-bold text-slate-500">{error || 'No Data Available'}</h2>
            </div>
        );

        // --- TRIAL BALANCE ---
        if (reportPath === 'trial-balance') {
            const rowWithIds = data.map((r: any, i: number) => ({ ...r, id: `tb-${i}` }));
            const columns: Column<any>[] = [
                { header: 'Code', accessor: (row: any) => <span className="font-mono text-slate-500">{row.accountCode}</span> },
                { header: 'Account Name', accessor: (row: any) => <span className="font-bold">{row.accountName}</span> },
                { header: 'Type', accessor: (row: any) => <span className="text-[10px] uppercase font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full">{row.type}</span> },
                { header: 'Debit', accessor: (row: any) => row.debit > 0 ? <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{Number(row.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> : '-' },
                { header: 'Credit', accessor: (row: any) => row.credit > 0 ? <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{Number(row.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> : '-' },
            ];
            return (
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <DataTable data={rowWithIds} columns={columns} />
                </div>
            );
        }

        // --- CASH FLOW ---
        if (reportPath === 'cash-flow') {
            const inflows = (data.inflows || []).map((r: any, i: number) => ({ ...r, id: `in-${i}` }));
            const outflows = (data.outflows || []).map((r: any, i: number) => ({ ...r, id: `out-${i}` }));

            const columns: Column<any>[] = [
                { header: 'Date', accessor: (r: any) => new Date(r.date).toLocaleDateString() },
                { header: 'Ref', accessor: (r: any) => <span className="font-mono">{r.ref || '-'}</span> },
                { header: 'Category', accessor: (r: any) => r.category },
                { header: 'Amount', accessor: (r: any) => <span className="font-mono">{Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> },
            ];

            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="text-emerald-500" />
                            <h3 className="text-lg font-black text-emerald-500 uppercase tracking-tight">Inflows (Cash In)</h3>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <DataTable data={inflows} columns={columns} />
                        </div>
                        <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl flex justify-between font-black text-emerald-700 dark:text-emerald-400">
                            <span>Total Inflows</span>
                            <span className="font-mono">{inflows.reduce((s: number, x: any) => s + Number(x.amount), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingDown className="text-rose-500" />
                            <h3 className="text-lg font-black text-rose-500 uppercase tracking-tight">Outflows (Cash Out)</h3>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <DataTable data={outflows} columns={columns} />
                        </div>
                        <div className="p-6 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex justify-between font-black text-rose-700 dark:text-rose-400">
                            <span>Total Outflows</span>
                            <span className="font-mono">{outflows.reduce((s: number, x: any) => s + Number(x.amount), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div className="md:col-span-2 p-8 bg-slate-950 rounded-3xl flex justify-between items-center shadow-2xl relative overflow-hidden border border-slate-800">
                        <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-3xl scale-150 pointer-events-none"></div>
                        <span className="text-2xl font-bold text-slate-300 relative z-10">Net Cash Flow</span>
                        <span className={cn(
                            "text-5xl font-black relative z-10 font-mono tracking-tight",
                            Number(data.netCashFlow) >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {Number(data.netCashFlow || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            );
        }

        // --- PROFIT & LOSS ---
        if (reportPath === 'profit-loss') {
            const income = data.income || [];
            const expense = data.expense || [];

            const incomeWithIds = income.map((r: any, i: number) => ({ ...r, id: `inc-${i}` }));
            const expenseWithIds = expense.map((r: any, i: number) => ({ ...r, id: `exp-${i}` }));

            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="text-lg font-black text-emerald-500 uppercase tracking-tight flex items-center gap-2">
                            <TrendingUp /> Income
                        </h3>
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <DataTable
                                data={incomeWithIds}
                                columns={[
                                    { header: 'Account', accessor: (r: any) => <span className="font-bold">{r.name}</span> },
                                    { header: 'Amount', accessor: (r: any) => <span className="font-mono">{Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> }
                                ]}
                            />
                        </div>
                        <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl flex justify-between font-black text-emerald-700 dark:text-emerald-400">
                            <span>Total Income</span>
                            <span className="font-mono">{Number(data.totalIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-lg font-black text-rose-500 uppercase tracking-tight flex items-center gap-2">
                            <TrendingDown /> Expenses
                        </h3>
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <DataTable
                                data={expenseWithIds}
                                columns={[
                                    { header: 'Account', accessor: (r: any) => <span className="font-bold">{r.name}</span> },
                                    { header: 'Amount', accessor: (r: any) => <span className="font-mono">{Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> }
                                ]}
                            />
                        </div>
                        <div className="p-6 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex justify-between font-black text-rose-700 dark:text-rose-400">
                            <span>Total Expense</span>
                            <span className="font-mono">{Number(data.totalExpense || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div className="md:col-span-2 p-8 bg-slate-950 rounded-3xl flex justify-between items-center shadow-2xl relative overflow-hidden border border-slate-800">
                        <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-3xl scale-150 pointer-events-none"></div>
                        <span className="text-2xl font-bold text-slate-300 relative z-10">Net Profit / (Loss)</span>
                        <span className={cn(
                            "text-5xl font-black relative z-10 font-mono tracking-tight",
                            Number(data.netProfit) >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {Number(data.netProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            );
        }

        // --- BALANCE SHEET ---
        if (reportPath === 'balance-sheet') {
            const assetGroups = data.assetSection || [];
            const liabilityGroups = data.liabilitySection || [];
            const equityItems = (data.equityItems || []).map((r: any, i: number) => ({ ...r, id: `eq-${i}` }));

            const totalAssets = Number(data.totalAssets || 0);
            const totalLiabilities = Number(data.totalLiabilities || 0);
            const totalEquity = Number(data.totalEquity || 0);

            const renderGroup = (group: any, idx: number, prefix: string) => (
                <div key={idx} className="mb-6">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4 pl-2">
                        {group.name}
                    </h4>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm mb-2">
                        <DataTable
                            data={group.items.map((r: any, i: number) => ({ ...r, id: `${prefix}-${idx}-${i}` }))}
                            columns={[
                                { header: 'Account', accessor: (r: any) => <span className="font-bold">{r.name}</span> },
                                { header: 'Amount', accessor: (r: any) => <span className="font-mono">{Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> }
                            ]}
                        />
                    </div>
                    <div className="flex justify-between font-black text-sm mt-2 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500">Total {group.name}</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">{Number(group.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            );

            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* ASSETS */}
                    <div className="space-y-6">
                        <h3 className="text-2xl font-black bg-slate-100 dark:bg-slate-800/50 p-4 rounded-2xl text-center text-slate-800 dark:text-slate-200 uppercase tracking-widest border border-slate-200 dark:border-slate-800">
                            ASSETS
                        </h3>

                        {assetGroups.map((g: any, i: number) => renderGroup(g, i, 'ast'))}

                        <div className="flex justify-between items-center text-xl font-black bg-indigo-600 text-white p-6 rounded-2xl shadow-xl shadow-indigo-500/30 border border-indigo-500">
                            <span>TOTAL ASSETS</span>
                            <span className="font-mono text-2xl">{totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    {/* LIABILITIES & EQUITY */}
                    <div className="space-y-6">
                        <h3 className="text-2xl font-black bg-slate-100 dark:bg-slate-800/50 p-4 rounded-2xl text-center text-slate-800 dark:text-slate-200 uppercase tracking-widest border border-slate-200 dark:border-slate-800">
                            LIABILITIES & EQUITY
                        </h3>

                        {liabilityGroups.map((g: any, i: number) => renderGroup(g, i, 'liab'))}

                        <div className="flex justify-between font-black text-sm px-6 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-600 dark:text-slate-400">Total Liabilities</span>
                            <span className="font-mono text-slate-800 dark:text-white">{totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>

                        {/* Equity Section */}
                        <div className="mt-8">
                            <h4 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4 pl-2">
                                Shareholders' Equity
                            </h4>
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm mb-2">
                                <DataTable
                                    data={equityItems}
                                    columns={[
                                        { header: 'Account', accessor: (r: any) => <span className="font-bold">{r.name}</span> },
                                        { header: 'Amount', accessor: (r: any) => <span className="font-mono">{Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> }
                                    ]}
                                />
                            </div>
                            <div className="flex justify-between font-black text-sm mt-2 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500">Total Equity</span>
                                <span className="font-mono text-slate-800 dark:text-slate-200">{totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-xl font-black bg-slate-950 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/50 border border-slate-800">
                            <span>TOTAL LIAB. & EQUITY</span>
                            <span className="font-mono text-2xl">{(totalLiabilities + totalEquity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            );
        }

        // --- STOCK ITEM WISE ---
        if (reportPath === 'stock-item-wise') {
            const rowWithIds = data.map((r: any, i: number) => ({ ...r, id: `si-${i}` }));
            const columns: Column<any>[] = [
                { header: 'Product Code', accessor: (row: any) => <span className="font-mono text-slate-500">{row.productCode}</span> },
                {
                    header: 'Product Name',
                    accessor: (row: any) => (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                setSelectedProduct(row.id);
                                router.push(`/finance/reports/stock-ledger?productId=${row.id}`);
                            }}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-left transition-colors"
                        >
                            {row.productName}
                        </button>
                    )
                },
                { header: 'Category', accessor: (row: any) => <span className="text-sm font-medium">{row.category}</span> },
                { header: 'Unit', accessor: (row: any) => <span className="text-xs uppercase font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full text-slate-500">{row.unit}</span> },
                { header: 'Current Stock', accessor: (row: any) => row.stock > 0 ? <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-lg">{row.stock}</span> : <span className="text-rose-500 font-black font-mono text-lg">{row.stock}</span> },
            ];
            return (
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <DataTable data={rowWithIds} columns={columns} />
                </div>
            );
        }

        // --- GENERAL LEDGER ---
        if (reportPath === 'ledger') {
            let balance = Number(data.openingBalance) || 0;
            const rows = [
                {
                    id: 'opening',
                    date: new Date(dateRange.start),
                    voucherNo: '-',
                    type: 'OPENING',
                    narration: 'Opening Balance',
                    debit: 0,
                    credit: 0,
                    balance: balance
                },
                ...(data.transactions || []).map((t: any) => {
                    const debit = Number(t.debit) || 0;
                    const credit = Number(t.credit) || 0;
                    balance += (debit - credit);
                    return { ...t, balance };
                })
            ];

            const columns: Column<any>[] = [
                { header: 'Date', accessor: (r: any) => <span className="font-mono text-sm">{new Date(r.date).toLocaleDateString()}</span> },
                { header: 'Voucher No', accessor: (r: any) => <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{r.voucherNo}</span> },
                { header: 'Type', accessor: (r: any) => <span className="text-[10px] uppercase font-black bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-1 rounded-full">{r.type}</span> },
                { header: 'Narration', accessor: (r: any) => <span className="text-slate-500 text-xs font-medium">{r.narration}</span> },
                { header: 'Debit', accessor: (r: any) => r.debit > 0 ? <span className="text-emerald-600 dark:text-emerald-400 font-black font-mono">{Number(r.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> : '-' },
                { header: 'Credit', accessor: (r: any) => r.credit > 0 ? <span className="text-rose-600 dark:text-rose-400 font-black font-mono">{Number(r.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> : '-' },
                { header: 'Balance', accessor: (r: any) => <span className="font-mono font-black text-slate-800 dark:text-white">{r.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> },
            ];

            return (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-4 p-6 bg-slate-950 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="flex-1 relative z-10">
                            <p className="text-xs uppercase font-black tracking-widest text-slate-500">Opening Balance</p>
                            <p className="text-2xl font-black text-slate-300 font-mono mt-1">{Number(data.openingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="flex-1 md:text-right relative z-10">
                            <p className="text-xs uppercase font-black tracking-widest text-slate-500">Closing Balance</p>
                            <p className="text-4xl font-black text-indigo-400 font-mono tracking-tight mt-1">{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <DataTable data={rows} columns={columns} />
                    </div>
                </div>
            );
        }

        // --- STOCK LEDGER ---
        if (reportPath === 'stock-ledger') {
            const rowWithIds = data.map((r: any, i: number) => ({ ...r, id: `sl-${i}` }));
            const columns: Column<any>[] = [
                { header: 'Date', accessor: (row: any) => <span className="font-mono text-sm">{new Date(row.date || row.createdAt).toLocaleDateString()}</span> },
                { header: 'Product', accessor: (row: any) => <span className="font-bold">{row.product?.name}</span> },
                { header: 'Warehouse', accessor: (row: any) => <span className="text-slate-500 font-medium">{row.warehouse?.name}</span> },
                { header: 'Ref Type', accessor: (row: any) => <span className="text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full">{row.refType}</span> },
                {
                    header: 'Ref No',
                    accessor: (row: any) => {
                        let link = '#';
                        if (row.refType === 'GRN') link = `/finance/purchase/grn/${row.refId}`;
                        if (row.refType === 'PURCHASE' || row.refType === 'INVOICE') link = `/finance/purchase/invoices/${row.refId}`;
                        if (row.refType === 'RETURN') link = `/finance/purchase/returns/${row.refId}`;
                        if (row.refType === 'SALE' || row.refType === 'SALES_INVOICE') link = `/finance/sales/invoices/${row.refId}`;

                        return (
                            <button
                                onClick={() => router.push(link)}
                                className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-xs font-mono transition-colors"
                            >
                                {row.refNo || row.refId}
                            </button>
                        );
                    }
                },
                { header: 'In', accessor: (row: any) => row.qtyIn > 0 ? <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">{row.qtyIn}</span> : '-' },
                { header: 'Out', accessor: (row: any) => row.qtyOut > 0 ? <span className="font-black text-rose-500 dark:text-rose-400 font-mono">{row.qtyOut}</span> : '-' },
                { header: 'Balance', accessor: (row: any) => <span className="font-black font-mono text-slate-800 dark:text-white">{row.balance}</span> },
            ];
            return (
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <DataTable data={rowWithIds} columns={columns} />
                </div>
            );
        }

        return (
            <pre className="bg-slate-900 text-indigo-400 p-8 rounded-3xl overflow-auto text-xs font-mono border border-slate-800 shadow-inner">
                {JSON.stringify(data, null, 2)}
            </pre>
        );
    };

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-32">
                
                {/* SCREEN ONLY HEADER */}
                <div className="print:hidden bg-slate-950 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden border border-slate-800 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">
                            <button onClick={() => router.push('/finance/reports')} className="hover:text-indigo-300 transition-colors flex items-center gap-1">
                                <ArrowLeft size={14}/> Reports Hub
                            </button>
                            <span className="opacity-50">/</span>
                            <span className="text-white">{reportType}</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tight">{reportType}</h1>
                        <p className="text-slate-400 font-medium mt-1">Generate and analyze your real-time financial data.</p>
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
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition-transform"
                        >
                            <Printer size={16} /> Print / PDF
                        </button>
                    </div>
                </div>

                {/* Report Parameters Section - SCREEN ONLY */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
                    {/* Product Selection */}
                    {reportPath === 'stock-ledger' && (
                        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl md:col-span-1 shadow-sm flex flex-col justify-end">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Box size={14}/> Select Product
                            </p>
                            <Combobox
                                options={products}
                                value={selectedProduct}
                                onChange={(val) => {
                                    setSelectedProduct(val);
                                    router.push(`/finance/reports/stock-ledger?productId=${val}`);
                                }}
                                placeholder="Search product..."
                            />
                        </div>
                    )}

                    {/* Account Selection */}
                    {reportPath === 'ledger' && (
                        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl md:col-span-1 shadow-sm flex flex-col justify-end">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Layers size={14}/> Select Account
                            </p>
                            <Combobox
                                options={accounts}
                                value={selectedAccount}
                                onChange={(val) => setSelectedAccount(val)}
                                placeholder="Search account..."
                            />
                        </div>
                    )}

                    {/* Date Selection */}
                    <div className={cn(
                        "p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row gap-4 md:items-end shadow-sm",
                        (reportPath === 'ledger' || reportPath === 'stock-ledger') ? "md:col-span-3" : "md:col-span-4 lg:col-span-3"
                    )}>
                        <div className="flex-1">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Calendar size={14}/> Start Date
                            </p>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 dark:text-slate-300"
                            />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Calendar size={14}/> End Date
                            </p>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 dark:text-slate-300"
                            />
                        </div>
                        <button 
                            onClick={fetchData} 
                            className="px-8 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-black rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors border border-indigo-200 dark:border-indigo-800 whitespace-nowrap h-[46px]"
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>

                {/* REPORT CONTENT AREA */}
                <div className="min-h-[400px]">
                    <div className="print:fixed print:inset-0 print:bg-white print:z-[9999] print:p-12 print:overflow-auto">
                        
                        {/* PRINT ONLY HEADER */}
                        <div className="hidden print:block mb-10 text-center border-b-2 border-slate-800 pb-6">
                            <h1 className="text-4xl font-black uppercase tracking-widest text-slate-900 mb-2">Ansari Traders</h1>
                            <h2 className="text-2xl font-bold uppercase text-slate-600 mb-4">{reportType}</h2>
                            <div className="flex justify-center items-center gap-4 text-sm font-medium text-slate-500">
                                <span className="bg-slate-100 px-4 py-1 rounded-full">Period: {new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}</span>
                                {selectedAccount && reportPath === 'ledger' && (
                                    <span className="bg-slate-100 px-4 py-1 rounded-full font-bold text-slate-800">Account: {accounts.find(a => a.value === selectedAccount)?.label}</span>
                                )}
                            </div>
                        </div>

                        {renderReportContent()}

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
