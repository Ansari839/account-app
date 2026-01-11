"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function SalesInvoiceDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [invoice, setInvoice] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchInvoice();
    }, [id]);

    const fetchInvoice = async () => {
        try {
            const res = await authenticatedFetch(`/api/finance/sales/invoices/${id}`);
            const json = await res.json();
            if (json.success) setInvoice(json.data);
            else alert(json.error || "Failed to load invoice");
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    if (loading) return (
        <MainLayout>
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        </MainLayout>
    );

    if (!invoice) return (
        <MainLayout>
            <div className="text-center py-20">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Invoice Not Found</h2>
                <p className="text-slate-500 mt-2">The requested invoice could not be located or you don't have access.</p>
                <button onClick={() => router.back()} className="mt-8 bg-indigo-600 text-white px-8 py-2 rounded-xl font-bold shadow-lg">← Go Back</button>
            </div>
        </MainLayout>
    );

    return (
        <MainLayout>
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                {/* Header Action Bar */}
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 px-6 py-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors font-bold text-lg text-slate-400 hover:text-indigo-600">←</button>
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight">Invoice {invoice.invoiceNo}</h1>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                Sales Confirmation
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => window.print()}
                            className="bg-indigo-600 text-white px-8 py-2.5 rounded-2xl font-bold shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2 transform active:scale-95"
                        >
                            <span>⎙</span> Print Invoice
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Invoice Document */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white dark:bg-slate-900 p-12 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-2xl print:shadow-none print:border-none print:p-0">
                            {/* Document Header */}
                            <div className="flex justify-between items-start mb-16 border-b border-slate-100 dark:border-slate-800 pb-10">
                                <div className="space-y-2">
                                    <h2 className="text-5xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">INVOICE</h2>
                                    <div className="bg-indigo-500 text-white px-3 py-1 rounded-lg inline-block font-mono font-bold text-sm tracking-widest">{invoice.invoiceNo}</div>
                                </div>
                                <div className="text-right">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Issue Date</p>
                                            <p className="text-xl font-bold">{format(new Date(invoice.date), 'dd MMMM yyyy')}</p>
                                        </div>
                                        {invoice.dueDate && (
                                            <div>
                                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Due Date</p>
                                                <p className="text-lg font-bold text-rose-500">{format(new Date(invoice.dueDate), 'dd MMMM yyyy')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Client Info */}
                            <div className="grid grid-cols-2 gap-12 mb-16">
                                <div className="bg-slate-50 dark:bg-slate-800/40 p-8 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-4">Bill To Customer</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{invoice.customer?.name}</p>
                                    <p className="text-sm font-bold text-slate-400 font-mono mt-1 opacity-60 uppercase">{invoice.customer?.code || "CUST-UNASSIGNED"}</p>

                                    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex gap-4">
                                        {invoice.order && (
                                            <div className="flex-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Order Ref</p>
                                                <p className="text-xs font-bold text-indigo-600">{invoice.order.orderNo}</p>
                                            </div>
                                        )}
                                        {invoice.do && (
                                            <div className="flex-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Delivery Ref</p>
                                                <p className="text-xs font-bold text-emerald-600">{invoice.do.doNo}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="p-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl flex flex-col justify-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-50">Warehouse Location</p>
                                    <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{invoice.warehouse?.name || "Main Warehouse"}</p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <table className="w-full text-left mb-16">
                                <thead>
                                    <tr className="border-b-2 border-slate-900 dark:border-white">
                                        <th className="pb-6 text-[11px] font-black uppercase tracking-widest px-2">Item Description</th>
                                        <th className="pb-6 text-center text-[11px] font-black uppercase tracking-widest px-2 w-32">Qty</th>
                                        <th className="pb-6 text-right text-[11px] font-black uppercase tracking-widest px-2 w-48">Rate</th>
                                        <th className="pb-6 text-right text-[11px] font-black uppercase tracking-widest px-2 w-48">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {invoice.items.map((it: any) => (
                                        <tr key={it.id} className="group">
                                            <td className="py-8 px-2">
                                                <p className="font-black text-slate-900 dark:text-white text-lg group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{it.product?.name}</p>
                                                <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-widest mt-0.5">{it.product?.code}</p>
                                            </td>
                                            <td className="py-8 px-2 text-center">
                                                <div className="bg-slate-100 dark:bg-slate-800 inline-block px-3 py-1 rounded-lg font-mono font-bold text-slate-700 dark:text-slate-300">
                                                    {Number(it.qty).toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="py-8 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{Number(it.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="py-8 px-2 text-right">
                                                <span className="font-black text-xl text-slate-900 dark:text-white font-mono tracking-tighter">
                                                    {(Number(it.qty) * Number(it.rate)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={2} className="py-12"></td>
                                        <td className="py-12 text-right">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Subtotal Amount</p>
                                            <p className="font-mono text-slate-500 font-bold">{Number(invoice.totalAmount - (invoice.taxAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>

                                            {invoice.taxAmount > 0 && (
                                                <div className="mt-4">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tax Total</p>
                                                    <p className="font-mono text-slate-500 font-bold">+{Number(invoice.taxAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-12 text-right pl-8">
                                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Grand Total</p>
                                            <p className="text-4xl font-black text-slate-900 dark:text-white font-mono tracking-tighter leading-none">
                                                {Number(invoice.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </p>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Sidebar Area */}
                    <div className="space-y-8 print:hidden">
                        {/* Status Card */}
                        <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 blur-3xl rounded-full translate-x-10 -translate-y-10"></div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Invoice Security</p>
                            <h4 className="text-3xl font-black italic tracking-tighter mb-4">POSTED</h4>
                            <div className="h-1 w-12 bg-indigo-500 mb-6"></div>
                            <p className="text-xs opacity-60 leading-relaxed font-medium">
                                This document is finalized and legally binding. Deletion or modification will trigger a mandatory reversal journal.
                            </p>
                        </div>

                        {/* Accounting Breakdown */}
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-xl">
                            <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                                Ledger Postings
                            </h3>

                            {invoice.journalEntry ? (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl">
                                        <p className="text-[10px] font-black text-slate-400 uppercase truncate">Entry No: <span className="text-slate-900 dark:text-white">{invoice.journalEntry.number}</span></p>
                                        <button
                                            onClick={() => router.push(`/finance/vouchers/journal/${invoice.journalEntryId}`)}
                                            className="text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-400 transition-colors"
                                        >
                                            View Voucher
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {invoice.journalEntry.lines.map((line: any, idx: number) => (
                                            <div key={idx} className="group relative">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate uppercase mt-0.5">{line.account?.name}</p>
                                                    <p className={`font-mono text-xs font-black ${line.debit > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                        {line.debit > 0 ? `DR ${line.debit.toLocaleString()}` : `CR ${line.credit.toLocaleString()}`}
                                                    </p>
                                                </div>
                                                <div className="h-0.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${line.debit > 0 ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'}`}
                                                        style={{ width: `${Math.min(100, (Math.max(line.debit, line.credit) / invoice.totalAmount) * 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic">Pending Journal Generation</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
