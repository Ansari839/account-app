"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function PurchaseInvoiceDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [invoice, setInvoice] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInvoice();
    }, [id]);

    const fetchInvoice = async () => {
        try {
            const res = await authenticatedFetch(`/api/finance/purchase/invoices/${id}`);
            const json = await res.json();
            if (json.success) setInvoice(json.data);
            else alert(json.error || "Failed to load invoice");
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    if (loading) return (
        <MainLayout>
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        </MainLayout>
    );

    if (!invoice) return (
        <MainLayout>
            <div className="text-center py-20">
                <h2 className="text-2xl font-bold text-slate-800">Invoice Not Found</h2>
                <button onClick={() => router.back()} className="mt-4 text-indigo-600 hover:underline font-bold">← Go Back</button>
            </div>
        </MainLayout>
    );

    return (
        <MainLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* Header Action Bar */}
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors font-bold text-lg">←</button>
                        <div>
                            <h1 className="text-xl font-bold">Purchase Invoice: {invoice.invoiceNo}</h1>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supplier Bill Confirmation</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => window.print()}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center gap-2"
                        >
                            <span>⎙</span> Print Invoice
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                    {/* Main Invoice Document */}
                    <div className="col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl print:shadow-none print:border-none print:p-0">
                            {/* Document Header */}
                            <div className="flex justify-between items-start mb-12 border-b border-slate-100 dark:border-slate-800 pb-8">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-1">INVOICE</h2>
                                    <p className="text-slate-500 font-mono font-bold">{invoice.invoiceNo}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Billing Date</p>
                                    <p className="text-lg font-bold">{format(new Date(invoice.date), 'dd MMMM yyyy')}</p>
                                    {invoice.dueDate && (
                                        <div className="mt-2">
                                            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Due Date</p>
                                            <p className="text-sm font-bold text-red-500">{format(new Date(invoice.dueDate), 'dd MMMM yyyy')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-12 mb-12">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Vendor / Supplier</p>
                                    <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{invoice.supplier?.name}</p>
                                    <p className="text-sm text-slate-500 font-mono mt-1">{invoice.supplier?.code}</p>
                                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reference Links</p>
                                        {invoice.po && <p className="text-xs font-bold text-indigo-600">PO: {invoice.po.poNo}</p>}
                                        {invoice.grn && <p className="text-xs font-bold text-emerald-600">GRN: {invoice.grn.grnNo}</p>}
                                    </div>
                                </div>
                            </div>

                            <table className="w-full text-left mb-12">
                                <thead>
                                    <tr className="bg-slate-900 text-white rounded-xl overflow-hidden">
                                        <th className="px-6 py-4 rounded-l-xl text-[10px] font-black uppercase tracking-widest">Description</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest">Qty</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest">Rate</th>
                                        <th className="px-6 py-4 rounded-r-xl text-right text-[10px] font-black uppercase tracking-widest">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {invoice.items.map((it: any) => (
                                        <tr key={it.id}>
                                            <td className="px-6 py-5">
                                                <p className="font-bold text-slate-800 dark:text-slate-200">{it.product?.name}</p>
                                                <p className="text-[10px] font-mono text-slate-500 uppercase">{it.product?.code}</p>
                                            </td>
                                            <td className="px-6 py-5 text-center font-mono font-bold">{Number(it.qty).toLocaleString()}</td>
                                            <td className="px-6 py-5 text-right font-mono">{Number(it.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="px-6 py-5 text-right font-black text-slate-900 dark:text-white">
                                                {Number(it.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t border-slate-100 dark:border-slate-800">
                                        <td colSpan={3} className="px-6 pt-8 pb-2 text-right font-black text-slate-400 uppercase tracking-widest text-[10px]">Subtotal</td>
                                        <td className="px-6 pt-8 pb-2 text-right font-mono text-slate-500 font-bold">
                                            {Number(invoice.totalAmount - (invoice.taxAmount || 0) + (invoice.hasDiscount ? Number(invoice.discountAmount || 0) : 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                    {invoice.taxAmount > 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-2 text-right font-black text-slate-400 uppercase tracking-widest text-[10px]">Tax</td>
                                            <td className="px-6 py-2 text-right font-mono text-slate-500 font-bold">
                                                +{Number(invoice.taxAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    )}
                                    {invoice.hasDiscount && invoice.discountAmount > 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-2 text-right font-black text-slate-400 uppercase tracking-widest text-[10px]">Discount</td>
                                            <td className="px-6 py-2 text-right font-mono text-rose-500 font-bold">
                                                -{Number(invoice.discountAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td colSpan={3} className="px-6 py-6 text-right font-black text-slate-400 uppercase tracking-widest">Grand Total</td>
                                        <td className="px-6 py-6 text-right font-black text-2xl text-indigo-600">
                                            {Number(invoice.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Sidebar: Accounting / Journal */}
                    <div className="space-y-6 print:hidden">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                Accounting Ledger Entries
                            </h3>

                            {invoice.journalEntry ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <p className="text-xs font-mono font-bold text-slate-500">{invoice.journalEntry.number}</p>
                                        <button
                                            onClick={() => router.push(`/finance/vouchers/journal/${invoice.journalEntryId}`)}
                                            className="text-[10px] font-bold text-indigo-600 hover:underline"
                                        >
                                            View Voucher →
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {invoice.journalEntry.lines.map((line: any, idx: number) => (
                                            <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{line.account?.name}</p>
                                                <div className="flex justify-between mt-1 items-baseline">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase">{line.debit > 0 ? 'Debit' : 'Credit'}</p>
                                                    <p className={`font-mono text-sm font-bold ${line.debit > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                        {line.debit > 0 ? line.debit.toLocaleString() : line.credit.toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <p className="text-slate-400 text-sm italic">No accounting entries found.</p>
                                </div>
                            )}
                        </div>

                        {/* Status Card */}
                        <div className="bg-indigo-600 text-white p-6 rounded-3xl shadow-xl shadow-indigo-500/20">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Invoice Status</p>
                            <h4 className="text-2xl font-black">POSTED</h4>
                            <p className="text-xs mt-2 opacity-80 leading-relaxed">
                                This invoice has been posted into the general ledger. Deleting this invoice will reverse all accounting entries.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
