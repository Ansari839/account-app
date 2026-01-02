"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';

export default function PurchaseOrderDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrder();
    }, [id]);

    const fetchOrder = async () => {
        try {
            const res = await authenticatedFetch(`/api/finance/purchase/orders/${id}`);
            const json = await res.json();
            if (json.success) setOrder(json.data);
            else alert(json.error || "Failed to load order");
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    if (loading) return (
        <MainLayout>
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        </MainLayout>
    );

    if (!order) return (
        <MainLayout>
            <div className="text-center py-20">
                <h2 className="text-2xl font-bold text-slate-800">Order Not Found</h2>
                <button onClick={() => router.back()} className="mt-4 text-indigo-600 hover:underline">Go Back</button>
            </div>
        </MainLayout>
    );

    const totalQty = order.items.reduce((sum: number, it: any) => sum + Number(it.qty), 0);
    const totalReceived = order.items.reduce((sum: number, it: any) => sum + Number(it.receivedQty || 0), 0);
    const totalInvoiced = order.items.reduce((sum: number, it: any) => sum + Number(it.invoicedQty || 0), 0);

    return (
        <MainLayout>
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* Action Bar */}
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors font-bold">←</button>
                        <div>
                            <h1 className="text-xl font-bold">{order.poNo}</h1>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{order.status} Order</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => window.print()} className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Print</button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                    {/* Header Info */}
                    <div className="col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Order Details</h2>
                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Supplier / Account</p>
                                    <p className="font-bold text-lg text-slate-800 dark:text-slate-200">{order.supplier?.name}</p>
                                    <p className="text-sm font-mono text-slate-500">{order.supplier?.code}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase">Order Date</p>
                                        <p className="font-bold">{format(new Date(order.date), 'dd MMM yyyy')}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase">Exp. Delivery</p>
                                        <p className="font-bold">{order.expectedDate ? format(new Date(order.expectedDate), 'dd MMM yyyy') : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Product</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Ordered</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Received</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Invoiced</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {order.items.map((it: any) => (
                                        <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-slate-800 dark:text-slate-200">{it.product?.name}</p>
                                                <p className="text-xs text-slate-500">{it.product?.code}</p>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-600">{Number(it.qty).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">{Number(it.receivedQty || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-indigo-600">{Number(it.invoicedQty || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">{Number(it.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 dark:bg-slate-800/50 font-bold border-t border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <td className="px-6 py-4 text-slate-400 uppercase text-xs">Total Amount</td>
                                        <td colSpan={4} className="px-6 py-4 text-right text-xl font-mono text-indigo-600">
                                            {Number(order.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Stock/Balance Report (Tracking Sidebar) */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-2xl shadow-xl text-white">
                            <h3 className="text-sm font-black text-indigo-200 uppercase tracking-widest mb-4">PO Fulfillment</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-1 uppercase tracking-wider text-indigo-100">
                                        <span>Receiving Status</span>
                                        <span>{Math.round((totalReceived / totalQty) * 100)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                                        <div className="h-full bg-white transition-all" style={{ width: `${(totalReceived / totalQty) * 100}%` }}></div>
                                    </div>
                                    <p className="text-[10px] mt-1 text-indigo-100 font-medium">Received {totalReceived} / {totalQty} units</p>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-1 uppercase tracking-wider text-indigo-100">
                                        <span>Invoicing Status</span>
                                        <span>{Math.round((totalInvoiced / totalQty) * 100)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-300 transition-all" style={{ width: `${(totalInvoiced / totalQty) * 100}%` }}></div>
                                    </div>
                                    <p className="text-[10px] mt-1 text-indigo-100 font-medium">Invoiced {totalInvoiced} / {totalQty} units</p>
                                </div>
                            </div>
                        </div>

                        {/* Linked GRNs */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Linked GRNs</h3>
                            <div className="space-y-3">
                                {order.grns?.length > 0 ? order.grns.map((grn: any) => (
                                    <Link key={grn.id} href={`/finance/purchase/grn`} className="block p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200 group">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-sm text-slate-700 group-hover:text-indigo-600 transition-colors">{grn.grnNo}</span>
                                            <span className="text-[10px] font-mono font-bold text-slate-400">{format(new Date(grn.date), 'dd/MM/yy')}</span>
                                        </div>
                                    </Link>
                                )) : <p className="text-sm text-slate-400 italic">No GRNs generated yet.</p>}
                            </div>
                        </div>

                        {/* Linked Invoices */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Linked Invoices</h3>
                            <div className="space-y-3">
                                {order.invoices?.length > 0 ? order.invoices.map((inv: any) => (
                                    <Link key={inv.id} href={`/finance/purchase/invoices`} className="block p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200 group">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-sm text-slate-700 group-hover:text-indigo-600 transition-colors">{inv.invoiceNo}</span>
                                            <span className="font-mono font-bold text-xs text-indigo-600">${Number(inv.totalAmount).toLocaleString()}</span>
                                        </div>
                                    </Link>
                                )) : <p className="text-sm text-slate-400 italic">No invoices generated yet.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
