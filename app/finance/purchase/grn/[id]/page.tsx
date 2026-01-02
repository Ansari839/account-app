"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function GRNDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [grn, setGrn] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGRN();
    }, [id]);

    const fetchGRN = async () => {
        try {
            const res = await authenticatedFetch(`/api/finance/purchase/grn/${id}`);
            const json = await res.json();
            if (json.success) setGrn(json.data);
            else alert(json.error || "Failed to load GRN");
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

    if (!grn) return (
        <MainLayout>
            <div className="text-center py-20">
                <h2 className="text-2xl font-bold text-slate-800">GRN Not Found</h2>
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
                            <h1 className="text-xl font-bold">Goods Received Note: {grn.grnNo}</h1>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory Receipt Record</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => window.print()}
                            className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-6 py-2 rounded-xl font-bold shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
                        >
                            <span>⎙</span> Print Document
                        </button>
                    </div>
                </div>

                {/* GRN Document Layout */}
                <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl print:shadow-none print:border-none print:p-0">
                    {/* Invoice Header */}
                    <div className="flex justify-between items-start mb-12 border-b border-slate-100 dark:border-slate-800 pb-8 rounded-full">
                        <div className="px-4">
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-1">G R N</h2>
                            <p className="text-slate-500 font-mono font-bold">{grn.grnNo}</p>
                        </div>
                        <div className="text-right px-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Receipt Date</p>
                            <p className="text-lg font-bold">{format(new Date(grn.date), 'dd MMMM yyyy')}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-12 mb-12">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Received From (Supplier)</p>
                            <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{grn.supplier?.name}</p>
                            <p className="text-sm text-slate-500 font-mono mt-1">{grn.supplier?.code}</p>
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reference PO</p>
                                <p className="font-bold text-indigo-600">{grn.po?.poNo || 'Manual Receipt'}</p>
                            </div>
                        </div>
                        <div className="p-6">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Inventory Location (Warehouse)</p>
                            <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{grn.warehouse?.name || 'Central Store'}</p>
                            <p className="text-sm text-slate-500 mt-1">{grn.warehouse?.location || 'Main Site'}</p>
                        </div>
                    </div>

                    <table className="w-full text-left mb-12">
                        <thead>
                            <tr className="bg-slate-900 text-white rounded-xl overflow-hidden">
                                <th className="px-6 py-4 rounded-l-xl text-[10px] font-black uppercase tracking-widest">#</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Product / Item</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest">Ordered</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest">ReceivedQty</th>
                                <th className="px-6 py-4 rounded-r-xl text-center text-[10px] font-black uppercase tracking-widest">Rejected</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {grn.items.map((it: any, idx: number) => (
                                <tr key={it.id} className="group">
                                    <td className="px-6 py-5 text-sm font-bold text-slate-400">{idx + 1}</td>
                                    <td className="px-6 py-5">
                                        <p className="font-bold text-slate-800 dark:text-slate-200">{it.product?.name}</p>
                                        <p className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">{it.product?.code}</p>
                                    </td>
                                    <td className="px-6 py-5 text-center font-mono font-bold text-slate-400 italic">
                                        {it.poItem?.qty ? Number(it.poItem.qty).toLocaleString() : '-'}
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <span className="px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-lg font-black font-mono shadow-sm">
                                            {Number(it.qtyReceived).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-center px-4 font-mono font-bold text-red-500">
                                        {Number(it.qtyRejected) > 0 ? Number(it.qtyRejected).toLocaleString() : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="grid grid-cols-2 gap-20 pt-12">
                        <div className="text-center">
                            <div className="h-[1px] bg-slate-200 dark:bg-slate-700 mb-4 w-48 mx-auto"></div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Receiver Signature</p>
                        </div>
                        <div className="text-center">
                            <div className="h-[1px] bg-slate-200 dark:bg-slate-700 mb-4 w-48 mx-auto"></div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Store Manager</p>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
