"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import Combobox from '@/components/Combobox'; // Ensure this exists and works

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
                    // API returns { accounts: [...] } based on route.ts inspection
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
        // If it's a ledger, we need an account. If not provided, don't fetch yet.
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
            <div className="p-20 text-center">
                <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Computing Statement...</p>
            </div>
        );

        if (reportPath === 'ledger' && !selectedAccount) {
            return (
                <div className="bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-12 text-center h-64 flex flex-col items-center justify-center">
                    <p className="text-slate-500 font-medium text-lg">Select an account above to view its ledger.</p>
                </div>
            );
        }

        if (reportPath === 'stock-ledger' && !selectedProduct) {
            return (
                <div className="bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-12 text-center h-64 flex flex-col items-center justify-center">
                    <p className="text-slate-500 font-medium text-lg">Select a product above to view its stock ledger.</p>
                </div>
            );
        }

        if (!data) return (
            <div className="bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-12 text-center">
                <h2 className="text-xl font-bold">{error || 'No Data Available'}</h2>
            </div>
        );

        // --- TRIAL BALANCE ---
        if (reportPath === 'trial-balance') {
            const rowWithIds = data.map((r: any, i: number) => ({ ...r, id: `tb-${i}` }));
            const columns: Column<any>[] = [
                { header: 'Code', accessor: (row: any) => row.accountCode },
                { header: 'Account Name', accessor: (row: any) => row.accountName },
                { header: 'Type', accessor: (row: any) => row.type },
                { header: 'Debit', accessor: (row: any) => row.debit > 0 ? Number(row.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-' },
                { header: 'Credit', accessor: (row: any) => row.credit > 0 ? Number(row.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-' },
            ];
            return <DataTable data={rowWithIds} columns={columns} />;
        }

        // --- CASH FLOW ---
        if (reportPath === 'cash-flow') {
            const inflows = (data.inflows || []).map((r: any, i: number) => ({ ...r, id: `in-${i}` }));
            const outflows = (data.outflows || []).map((r: any, i: number) => ({ ...r, id: `out-${i}` }));

            const columns: Column<any>[] = [
                { header: 'Date', accessor: (r: any) => new Date(r.date).toLocaleDateString() },
                { header: 'Ref', accessor: (r: any) => r.ref || '-' },
                { header: 'Category', accessor: (r: any) => r.category },
                { header: 'Amount', accessor: (r: any) => Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            ];

            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-emerald-500 uppercase tracking-tight">Inflows (Cash In)</h3>
                        <DataTable data={inflows} columns={columns} />
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex justify-between font-bold">
                            <span>Total Inflows</span>
                            <span>{inflows.reduce((s: number, x: any) => s + Number(x.amount), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-rose-500 uppercase tracking-tight">Outflows (Cash Out)</h3>
                        <DataTable data={outflows} columns={columns} />
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex justify-between font-bold">
                            <span>Total Outflows</span>
                            <span>{outflows.reduce((s: number, x: any) => s + Number(x.amount), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div className="md:col-span-2 p-6 bg-slate-800 text-white rounded-2xl flex justify-between items-center shadow-lg">
                        <span className="text-xl font-bold">Net Cash Flow</span>
                        <span className="text-3xl font-black">{Number(data.netCashFlow || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            );
        }

        // --- PROFIT & LOSS ---
        if (reportPath === 'profit-loss') {
            // Ensure arrays exist
            const income = data.income || [];
            const expense = data.expense || [];

            const incomeWithIds = income.map((r: any, i: number) => ({ ...r, id: `inc-${i}` }));
            const expenseWithIds = expense.map((r: any, i: number) => ({ ...r, id: `exp-${i}` }));

            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-emerald-500 uppercase tracking-tight">Income</h3>
                        <DataTable
                            data={incomeWithIds}
                            columns={[
                                { header: 'Account', accessor: (r: any) => r.name },
                                { header: 'Amount', accessor: (r: any) => `${Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` }
                            ]}
                        />
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex justify-between font-bold">
                            <span>Total Income</span>
                            <span>{Number(data.totalIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-rose-500 uppercase tracking-tight">Expenses</h3>
                        <DataTable
                            data={expenseWithIds}
                            columns={[
                                { header: 'Account', accessor: (r: any) => r.name },
                                { header: 'Amount', accessor: (r: any) => `${Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` }
                            ]}
                        />
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex justify-between font-bold">
                            <span>Total Expense</span>
                            <span>{Number(data.totalExpense || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div className="md:col-span-2 p-6 bg-indigo-600 text-white rounded-2xl flex justify-between items-center shadow-xl shadow-indigo-500/20">
                        <span className="text-xl font-bold">Net Profit / Loss</span>
                        <span className="text-3xl font-black">{Number(data.netProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
                    <h4 className="text-sm font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-1 mb-2">
                        {group.name}
                    </h4>
                    <DataTable
                        data={group.items.map((r: any, i: number) => ({ ...r, id: `${prefix}-${idx}-${i}` }))}
                        columns={[
                            { header: 'Account', accessor: (r: any) => r.name },
                            { header: 'Amount', accessor: (r: any) => Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) }
                        ]}
                    />
                    <div className="flex justify-between font-bold text-sm mt-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded">
                        <span>Total {group.name}</span>
                        <span>{Number(group.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            );

            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 font-mono text-sm">
                    {/* ASSETS */}
                    <div>
                        <h3 className="text-xl font-bold bg-slate-100 dark:bg-slate-800 p-3 rounded-lg mb-6 text-center">ASSETS</h3>

                        {assetGroups.map((g: any, i: number) => renderGroup(g, i, 'ast'))}

                        <div className="flex justify-between items-center text-lg font-black bg-indigo-600 text-white p-4 rounded-xl mt-8 shadow-lg shadow-indigo-500/30">
                            <span>TOTAL ASSETS</span>
                            <span>{totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    {/* LIABILITIES & EQUITY */}
                    <div>
                        <h3 className="text-xl font-bold bg-slate-100 dark:bg-slate-800 p-3 rounded-lg mb-6 text-center">LIABILITIES & EQUITY</h3>

                        {/* Liabilities Groups */}
                        {liabilityGroups.map((g: any, i: number) => renderGroup(g, i, 'liab'))}

                        <div className="flex justify-between font-bold text-sm mt-2 mb-8 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded">
                            <span>Total Liabilities</span>
                            <span>{totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>

                        {/* Equity Section (Flat) */}
                        <div className="mb-6">
                            <h4 className="text-sm font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-1 mb-2">
                                Shareholders' Equity
                            </h4>
                            <DataTable
                                data={equityItems}
                                columns={[
                                    { header: 'Account', accessor: (r: any) => r.name },
                                    { header: 'Amount', accessor: (r: any) => Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) }
                                ]}
                            />
                            <div className="flex justify-between font-bold text-sm mt-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded">
                                <span>Total Equity</span>
                                <span>{totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-lg font-black bg-slate-800 text-white p-4 rounded-xl mt-8 shadow-lg">
                            <span>TOTAL LIAB. & EQUITY</span>
                            <span>{(totalLiabilities + totalEquity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            );
        }

        // --- STOCK ITEM WISE ---
        if (reportPath === 'stock-item-wise') {
            const rowWithIds = data.map((r: any, i: number) => ({ ...r, id: `si-${i}` }));
            const columns: Column<any>[] = [
                { header: 'Product Code', accessor: (row: any) => row.productCode },
                {
                    header: 'Product Name',
                    accessor: (row: any) => (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                setSelectedProduct(row.id);
                                router.push(`/finance/reports/stock-ledger?productId=${row.id}`);
                            }}
                            className="text-indigo-600 hover:underline font-bold text-left"
                        >
                            {row.productName}
                        </button>
                    )
                },
                { header: 'Category', accessor: (row: any) => row.category },
                { header: 'Unit', accessor: (row: any) => row.unit },
                { header: 'Current Stock', accessor: (row: any) => row.stock > 0 ? <span className="font-bold text-emerald-600">{row.stock}</span> : <span className="text-rose-500 font-bold">{row.stock}</span> },
            ];
            return <DataTable data={rowWithIds} columns={columns} />;
        }

        // --- GENERAL LEDGER ---
        if (reportPath === 'ledger') {
            // Calculate running balance locally for display
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
                { header: 'Date', accessor: (r: any) => new Date(r.date).toLocaleDateString() },
                { header: 'Voucher No', accessor: (r: any) => r.voucherNo },
                { header: 'Type', accessor: (r: any) => <span className="text-[10px] uppercase font-bold bg-slate-100 px-2 py-1 rounded">{r.type}</span> },
                { header: 'Narration', accessor: (r: any) => <span className="text-slate-500 text-xs">{r.narration}</span> },
                { header: 'Debit', accessor: (r: any) => r.debit > 0 ? <span className="text-indigo-600 font-bold">{Number(r.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> : '-' },
                { header: 'Credit', accessor: (r: any) => r.credit > 0 ? <span className="text-slate-600 font-bold">{Number(r.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> : '-' },
                { header: 'Balance', accessor: (r: any) => <span className="font-mono font-bold">{r.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> },
            ];

            return (
                <div className="space-y-6">
                    <div className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex-1">
                            <p className="text-xs uppercase font-bold text-slate-400">Opening Balance</p>
                            <p className="text-xl font-bold text-slate-700">{Number(data.openingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="flex-1 text-right">
                            <p className="text-xs uppercase font-bold text-slate-400">Closing Balance</p>
                            <p className="text-2xl font-black text-indigo-600">{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                    <DataTable data={rows} columns={columns} />
                </div>
            );
        }

        // --- STOCK LEDGER ---
        if (reportPath === 'stock-ledger') {
            const rowWithIds = data.map((r: any, i: number) => ({ ...r, id: `sl-${i}` }));
            const columns: Column<any>[] = [
                { header: 'Date', accessor: (row: any) => new Date(row.date || row.createdAt).toLocaleDateString() },
                { header: 'Product', accessor: (row: any) => row.product?.name },
                { header: 'Warehouse', accessor: (row: any) => row.warehouse?.name },
                { header: 'Ref Type', accessor: (row: any) => <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded">{row.refType}</span> },
                {
                    header: 'Ref No',
                    accessor: (row: any) => {
                        let link = '#';
                        // GRN
                        if (row.refType === 'GRN') link = `/finance/purchase/grn/${row.refId}`;

                        // PURCHASE (Handle both 'PURCHASE' and 'INVOICE' as Purchase Invoice)
                        if (row.refType === 'PURCHASE' || row.refType === 'INVOICE') link = `/finance/purchase/invoices/${row.refId}`;

                        // RETURN
                        if (row.refType === 'RETURN') link = `/finance/purchase/returns/${row.refId}`;

                        // SALES (Handle 'SALE' and 'SALES_INVOICE')
                        if (row.refType === 'SALE' || row.refType === 'SALES_INVOICE') link = `/finance/sales/invoices/${row.refId}`;

                        return (
                            <button
                                onClick={() => router.push(link)}
                                className="text-indigo-600 hover:underline font-bold text-xs font-mono"
                            >
                                {row.refNo || row.refId}
                            </button>
                        );
                    }
                },
                { header: 'In', accessor: (row: any) => row.qtyIn > 0 ? <span className="font-bold text-emerald-600">{row.qtyIn}</span> : '-' },
                { header: 'Out', accessor: (row: any) => row.qtyOut > 0 ? <span className="font-bold text-rose-500">{row.qtyOut}</span> : '-' },
                { header: 'Balance', accessor: (row: any) => <span className="font-bold font-mono">{row.balance}</span> },
            ];
            return <DataTable data={rowWithIds} columns={columns} />;
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
                {/* PRINT ONLY HEADER */}
                <div className="hidden print:block mb-8 text-center">
                    <h1 className="text-2xl font-bold uppercase tracking-widest text-black">{reportType}</h1>
                    <p className="text-sm text-slate-600">
                        Period: {new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}
                    </p>
                    {selectedAccount && reportPath === 'ledger' && (
                        <p className="text-sm font-bold mt-2">Account: {accounts.find(a => a.value === selectedAccount)?.label}</p>
                    )}
                </div>

                {/* SCREEN ONLY HEADER */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-8 print:hidden">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">
                            <button onClick={() => router.push('/finance/reports')} className="hover:underline">Reports</button>
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
                        <button
                            onClick={() => window.print()}
                            className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all"
                        >
                            🖨 Print / PDF
                        </button>
                    </div>
                </div>

                {/* Report Parameters Section - SCREEN ONLY */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 print:hidden">
                    {/* Product Selection - Only for Stock Ledger */}
                    {reportPath === 'stock-ledger' && (
                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl md:col-span-1">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Select Product</p>
                            <Combobox
                                options={products}
                                value={selectedProduct}
                                onChange={(val) => {
                                    setSelectedProduct(val);
                                    router.push(`/finance/reports/stock-ledger?productId=${val}`);
                                }}
                                placeholder="Search product..."
                                className="w-full"
                            />
                        </div>
                    )}

                    {/* Account Selection - Only for Ledger */}
                    {reportPath === 'ledger' && (
                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl md:col-span-1">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Select Account</p>
                            <Combobox
                                options={accounts}
                                value={selectedAccount}
                                onChange={(val) => setSelectedAccount(val)}
                                placeholder="Search account..."
                                className="w-full"
                            />
                        </div>
                    )}

                    {/* Date Selection - Used for all */}
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl md:col-span-2 flex gap-4 items-end">
                        <div className="flex-1">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Start Date</p>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full p-2 border border-slate-200 rounded-lg font-mono text-sm dark:bg-slate-800"
                            />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">End Date</p>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full p-2 border border-slate-200 rounded-lg font-mono text-sm dark:bg-slate-800"
                            />
                        </div>
                        <button onClick={fetchData} className="px-4 py-2 bg-indigo-50 text-indigo-600 font-bold rounded-lg hover:bg-indigo-100 h-10">
                            Apply
                        </button>
                    </div>
                </div>

                <div className="min-h-[400px] print:min-h-0">
                    <div className="print:fixed print:inset-0 print:bg-white print:z-[9999] print:p-8 print:overflow-auto">
                        {/* REPEAT HEADER IN PRINT OVERLAY */}
                        <div className="hidden print:block mb-8 text-center border-b pb-4 border-black">
                            <h1 className="text-3xl font-black uppercase tracking-widest text-black mb-2">Ansari Traders</h1>
                            <h2 className="text-xl font-bold uppercase text-slate-800">{reportType}</h2>
                            <p className="text-sm text-slate-600 mt-2">
                                Period: {new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}
                            </p>
                            {selectedAccount && reportPath === 'ledger' && (
                                <p className="text-md font-bold mt-2 bg-slate-100 inline-block px-4 py-1 rounded">Account: {accounts.find(a => a.value === selectedAccount)?.label}</p>
                            )}
                        </div>
                        {renderReportContent()}
                        <div className="hidden print:block mt-8 text-center text-xs text-slate-400 py-4 border-t">
                            <p>Generated on {new Date().toLocaleString()} by System</p>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
