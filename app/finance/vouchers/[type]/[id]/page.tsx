"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useParams, useRouter } from 'next/navigation';
import { useNotifications } from '@/context/NotificationContext';

export default function VoucherDetailPage() {
    const { type, id } = useParams();
    const router = useRouter();
    const { showNotification } = useNotifications();

    const [voucher, setVoucher] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        authenticatedFetch(`/api/finance/vouchers/${id}`)
            .then(res => res.json())
            .then(json => {
                if (json.success) {
                    setVoucher(json.data);
                } else {
                    showNotification('error', json.error || 'Failed to load voucher');
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [id]);

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this voucher? This action cannot be undone.')) return;

        try {
            const res = await authenticatedFetch(`/api/finance/vouchers/${id}`, {
                method: 'DELETE'
            });
            const json = await res.json();
            if (json.success) {
                showNotification('success', 'Voucher deleted');
                router.push(`/finance/vouchers/${type}`);
            } else {
                showNotification('error', json.error || 'Failed to delete');
            }
        } catch (error) {
            showNotification('error', 'Network error');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) return (
        <MainLayout>
            <div className="flex h-96 items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        </MainLayout>
    );

    if (!voucher) return (
        <MainLayout>
            <div className="text-center py-20">
                <h2 className="text-2xl font-bold text-slate-800">Voucher Not Found</h2>
                <button onClick={() => router.back()} className="mt-4 text-indigo-600 hover:underline">Go Back</button>
            </div>
        </MainLayout>
    );

    const totalDebit = voucher.lines.reduce((sum: number, l: any) => sum + (Number(l.debit) || 0), 0);
    const totalCredit = voucher.lines.reduce((sum: number, l: any) => sum + (Number(l.credit) || 0), 0);

    return (
        <MainLayout>
            {/* 
                Print Styling Note:
                print:fixed print:inset-0 print:z-[9999] print:bg-white 
                These classes force this specific div to take up the WHOLE screen when printing,
                covering up the sidebar, header, and everything else in MainLayout.
            */}
            <div className="max-w-4xl mx-auto animate-in fade-in duration-500 print:fixed print:inset-0 print:w-screen print:h-screen print:z-[9999] print:bg-white print:p-8 print:overflow-auto">

                {/* Action Bar - Hidden in Print */}
                <div className="flex justify-between items-center mb-6 print:hidden">
                    <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-800 flex items-center gap-2">
                        ← Back to List
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={() => router.push(`/finance/vouchers/${type}/${id}/edit`)}
                            className="px-4 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-medium transition-colors"
                        >
                            ✎ Edit
                        </button>
                        <button
                            onClick={handleDelete}
                            className="px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-lg font-medium transition-colors"
                        >
                            ✕ Delete
                        </button>
                        <button
                            onClick={handlePrint}
                            className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                        >
                            🖨 Print View
                        </button>
                    </div>
                </div>

                {/* Printable Area */}
                <div className="bg-white p-8 md:p-12 rounded-xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0 print:w-full">

                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-slate-100 pb-8 mb-8">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Journal Voucher</h1>
                            <p className="text-slate-500 mt-2 font-medium">{voucher.type} Voucher</p>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-slate-500 uppercase font-bold mb-1">Voucher No</div>
                            <div className="text-xl font-mono font-bold text-slate-900">{voucher.number}</div>

                            <div className="mt-4 text-sm text-slate-500 uppercase font-bold mb-1">Date</div>
                            <div className="text-lg font-medium text-slate-900">{new Date(voucher.date).toLocaleDateString()}</div>
                        </div>
                    </div>

                    {/* VDetails */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <h3 className="text-xs uppercase font-bold text-slate-400 mb-2">Narration / Description</h3>
                            <p className="text-slate-700 leading-relaxed max-w-md">{voucher.narration || "No narration provided."}</p>
                        </div>
                        {voucher.reference && (
                            <div className="text-right">
                                <h3 className="text-xs uppercase font-bold text-slate-400 mb-2">Reference</h3>
                                <p className="text-slate-900 font-medium">{voucher.reference}</p>
                            </div>
                        )}
                    </div>

                    {/* Table */}
                    <table className="w-full text-sm text-left mb-8">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Account Code</th>
                                <th className="px-4 py-3">Account Name</th>
                                <th className="px-4 py-3">Narration</th>
                                <th className="px-4 py-3 text-right">Debit</th>
                                <th className="px-4 py-3 text-right rounded-r-lg">Credit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {voucher.lines.map((line: any) => (
                                <tr key={line.id}>
                                    <td className="px-4 py-3 font-mono text-slate-600 font-medium">{line.account?.code}</td>
                                    <td className="px-4 py-3 font-bold text-slate-800">{line.account?.name}</td>
                                    <td className="px-4 py-3 text-slate-500">{line.narration}</td>
                                    <td className="px-4 py-3 text-right font-mono text-indigo-600 font-bold">
                                        {(Number(line.debit) || 0) > 0 ? Number(line.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-600 font-bold">
                                        {(Number(line.credit) || 0) > 0 ? Number(line.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-100">
                            <tr>
                                <td colSpan={3} className="px-4 py-4 text-right font-bold uppercase text-xs text-slate-400">Total</td>
                                <td className="px-4 py-4 text-right font-bold font-mono text-lg text-indigo-700">
                                    {Number(totalDebit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-4 text-right font-bold font-mono text-lg text-slate-700">
                                    {Number(totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Footer */}
                    <div className="flex justify-between items-end pt-12 mt-12 border-t border-slate-100 print:flex">
                        <div className="text-center w-40">
                            <div className="h-0.5 bg-slate-300 mb-2 w-full"></div>
                            <span className="text-xs uppercase font-bold text-slate-400">Prepared By</span>
                        </div>
                        <div className="text-center w-40">
                            <div className="h-0.5 bg-slate-300 mb-2 w-full"></div>
                            <span className="text-xs uppercase font-bold text-slate-400">Checked By</span>
                        </div>
                        <div className="text-center w-40">
                            <div className="h-0.5 bg-slate-300 mb-2 w-full"></div>
                            <span className="text-xs uppercase font-bold text-slate-400">Approved By</span>
                        </div>
                    </div>

                </div>
            </div>
        </MainLayout>
    );
}
