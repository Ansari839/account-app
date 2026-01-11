"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function SalesOrderDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchOrder();
    }, [id]);

    const fetchOrder = async () => {
        try {
            const res = await authenticatedFetch(`/api/finance/sales/orders/${id}`);
            const json = await res.json();
            if (json.success) setOrder(json.data);
            else alert(json.error || "Failed to load order");
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    if (loading) return (
        <MainLayout>
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        </MainLayout>
    );

    if (!order) return (
        <MainLayout>
            <div className="text-center py-20">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Order Not Found</h2>
                <button onClick={() => router.back()} className="mt-8 bg-emerald-600 text-white px-8 py-2 rounded-xl font-bold">← Go Back</button>
            </div>
        </MainLayout>
    );

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 px-6 py-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 text-slate-400 hover:text-emerald-600 font-bold text-lg">←</button>
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight">Order {order.orderNo}</h1>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${order.status === 'CLOSED' ? 'bg-slate-400' : 'bg-emerald-500'}`}></span>
                                {order.status || 'OPEN'} Order
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-12 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-2xl">
                    <div className="flex justify-between items-start mb-16 border-b pb-10">
                        <div>
                            <h2 className="text-5xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">SALES ORDER</h2>
                            <p className="text-sm font-mono font-bold text-emerald-600 mt-2 tracking-widest">{order.orderNo}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Order Date</p>
                            <p className="text-xl font-bold">{format(new Date(order.date), 'dd MMMM yyyy')}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-12 mb-16">
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-8 rounded-3xl border">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Customer Details</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{order.customer?.name}</p>
                            <p className="text-sm font-bold text-slate-500 font-mono mt-1 uppercase">{order.customer?.code}</p>
                        </div>
                    </div>

                    <table className="w-full text-left mb-16">
                        <thead>
                            <tr className="border-b-2 border-slate-900 dark:border-white">
                                <th className="pb-6 text-[11px] font-black uppercase tracking-widest px-2">Product</th>
                                <th className="pb-6 text-center text-[11px] font-black uppercase tracking-widest px-2 w-32">Qty</th>
                                <th className="pb-6 text-right text-[11px] font-black uppercase tracking-widest px-2 w-48">Rate</th>
                                <th className="pb-6 text-right text-[11px] font-black uppercase tracking-widest px-2 w-48">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {order.items.map((it: any) => (
                                <tr key={it.id}>
                                    <td className="py-8 px-2 font-bold text-lg text-slate-800 dark:text-white">{it.product?.name}</td>
                                    <td className="py-8 px-2 text-center font-mono font-bold">{Number(it.qty).toLocaleString()}</td>
                                    <td className="py-8 px-2 text-right font-mono">{Number(it.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td className="py-8 px-2 text-right font-black text-xl font-mono">{(Number(it.qty) * Number(it.rate)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3} className="py-12 text-right font-black text-slate-400 uppercase tracking-widest">Grand Total</td>
                                <td className="py-12 text-right text-3xl font-black text-emerald-600 font-mono tracking-tighter">
                                    {Number(order.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </MainLayout>
    );
}
