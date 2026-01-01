"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';
import { useParams, useRouter } from 'next/navigation';
import Combobox from '@/components/Combobox';

interface JournalLine {
    accountId: string;
    debit: string | number;
    credit: string | number;
    narration: string;
}

export default function VoucherEditPage() {
    const { type, id } = useParams();
    const router = useRouter();
    const { showNotification } = useNotifications();

    // State
    const [date, setDate] = useState('');
    const [reference, setReference] = useState('');
    const [narration, setNarration] = useState('');
    const [lines, setLines] = useState<JournalLine[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    // Load Data
    useEffect(() => {
        const load = async () => {
            try {
                // 1. Load Accounts
                const accRes = await authenticatedFetch('/api/accounts');
                const accJson = await accRes.json();
                if (accJson.accounts) {
                    const postingAccounts = accJson.accounts.filter((acc: any) => acc._count?.children === 0);
                    setAccounts(postingAccounts);
                }

                // 2. Load Voucher
                const vRes = await authenticatedFetch(`/api/finance/vouchers/${id}`);
                const vJson = await vRes.json();
                if (vJson.success) {
                    const v = vJson.data;
                    setDate(new Date(v.date).toISOString().split('T')[0]);
                    setReference(v.reference || '');
                    setNarration(v.narration || '');
                    setLines(v.lines.map((l: any) => ({
                        accountId: l.accountId,
                        debit: l.debit,
                        credit: l.credit,
                        narration: l.narration || ''
                    })));
                } else {
                    showNotification('error', 'Voucher not found');
                    router.back();
                }
            } catch (error) {
                console.error(error);
                showNotification('error', 'Failed to load data');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [id]);

    // Helper: Totals
    const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    // Handlers
    const addLine = () => {
        setLines([...lines, { accountId: '', debit: '', credit: '', narration: '' }]);
    };

    const removeLine = (index: number) => {
        if (lines.length <= 2) {
            showNotification('error', 'Journal must have at least 2 lines');
            return;
        }
        setLines(lines.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, updates: Partial<JournalLine>) => {
        setLines(prevLines => {
            const newLines = [...prevLines];
            newLines[index] = { ...newLines[index], ...updates };
            return newLines;
        });
    };

    const handleSubmit = async () => {
        // Validate Amounts
        const hasInvalidAmounts = lines.some(l => {
            const d = Number(l.debit) || 0;
            const c = Number(l.credit) || 0;
            return (d === 0 && c === 0) || (d < 0 || c < 0);
        });

        if (hasInvalidAmounts) {
            showNotification('error', 'All lines must have a valid non-zero amount');
            return;
        }

        if (lines.some(l => !l.accountId)) {
            showNotification('error', 'All lines must have an account selected');
            return;
        }

        if (!isBalanced) {
            showNotification('error', 'Voucher is not balanced');
            return;
        }

        setIsSubmitting(true);
        try {
            const body = {
                date: new Date(date),
                reference,
                narration,
                lines: lines.map(l => ({
                    accountId: l.accountId,
                    debit: Number(l.debit) || 0,
                    credit: Number(l.credit) || 0,
                    narration: l.narration
                }))
            };

            const res = await authenticatedFetch(`/api/finance/vouchers/${id}`, {
                method: 'PUT',
                body: JSON.stringify(body)
            });

            const json = await res.json();
            if (json.success) {
                showNotification('success', 'Voucher Updated');
                router.push(`/finance/vouchers/${type}/${id}`);
            } else {
                showNotification('error', json.error || 'Failed to update voucher');
            }
        } catch (error) {
            showNotification('error', 'Network error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const accountOptions = accounts.map(acc => ({
        value: acc.id,
        label: `${acc.code} - ${acc.name}`
    }));

    if (loading) return (
        <MainLayout>
            <div className="flex h-96 items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        </MainLayout>
    );

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Edit {type?.toString().toUpperCase()} Voucher</h1>
                    <button onClick={() => router.back()} className="text-slate-500 hover:underline">Cancel</button>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm space-y-8">
                    {/* Header Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="text-sm font-semibold text-slate-500">Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full mt-1 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 outline-none" />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-500">Reference</label>
                            <input type="text" placeholder="e.g. INV-001" value={reference} onChange={e => setReference(e.target.value)} className="w-full mt-1 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 outline-none" />
                        </div>
                        <div className="md:col-span-3">
                            <label className="text-sm font-semibold text-slate-500">Narration</label>
                            <textarea placeholder="Description of the transaction..." value={narration} onChange={e => setNarration(e.target.value)} className="w-full mt-1 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 outline-none h-20" />
                        </div>
                    </div>

                    {/* Lines Table */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-4 py-3 w-[35%]">Account</th>
                                    <th className="px-4 py-3 w-[30%]">Narration</th>
                                    <th className="px-4 py-3 w-[15%] text-right">Debit</th>
                                    <th className="px-4 py-3 w-[15%] text-right">Credit</th>
                                    <th className="px-4 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {lines.map((line, idx) => (
                                    <tr key={idx} className="bg-white dark:bg-slate-900">
                                        <td className="p-2 align-top">
                                            <Combobox
                                                options={accountOptions}
                                                value={line.accountId}
                                                onChange={(val) => updateLine(idx, { accountId: val })}
                                                placeholder={accountOptions.length === 0 ? "Loading accounts..." : "Select Account..."}
                                                className="w-full"
                                            />
                                        </td>
                                        <td className="p-2 align-top">
                                            <input
                                                type="text"
                                                placeholder="Line Note"
                                                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 outline-none"
                                                value={line.narration}
                                                onChange={e => updateLine(idx, { narration: e.target.value })}
                                            />
                                        </td>
                                        <td className="p-2 align-top">
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                className="w-full text-right p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 outline-none font-mono"
                                                value={line.debit}
                                                onChange={e => updateLine(idx, { debit: e.target.value, credit: '' })}
                                                step="any"
                                            />
                                        </td>
                                        <td className="p-2 align-top">
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                className="w-full text-right p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 outline-none font-mono"
                                                value={line.credit}
                                                onChange={e => updateLine(idx, { credit: e.target.value, debit: '' })}
                                                step="any"
                                            />
                                        </td>
                                        <td className="p-2 align-middle text-center">
                                            <button
                                                onClick={() => removeLine(idx)}
                                                className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Remove Line"
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-center">
                        <button onClick={addLine} className="text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:underline px-2">
                            + Add Another Line
                        </button>

                        {/* Totals Display */}
                        <div className="flex gap-8 text-right bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div>
                                <div className="text-slate-400 text-xs uppercase font-bold mb-1">Total Debit</div>
                                <div className="text-xl font-mono font-bold text-slate-700 dark:text-slate-200">{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                            <div>
                                <div className="text-slate-400 text-xs uppercase font-bold mb-1">Total Credit</div>
                                <div className="text-xl font-mono font-bold text-slate-700 dark:text-slate-200">{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div className={`font-bold flex items-center gap-2 ${isBalanced ? 'text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg' : 'text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg'}`}>
                            {isBalanced ? (
                                <><span>✓</span> Balanced</>
                            ) : (
                                <><span>⚠</span> Unbalanced (Diff: {Math.abs(totalDebit - totalCredit).toFixed(2)})</>
                            )}
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !isBalanced}
                            className="btn-primary px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                        >
                            {isSubmitting ? 'Update Voucher' : 'Update Voucher'}
                        </button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
