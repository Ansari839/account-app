"use client";

import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { useCompany } from '@/context/CompanyContext';

interface VoucherSequence {
    type: string;
    prefix: string;
    nextValue: number;
    id?: string;
}

export default function VoucherSettings() {
    const { activeCompany } = useCompany();
    const [sequences, setSequences] = useState<VoucherSequence[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingType, setEditingType] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ prefix: '', nextValue: 0 });

    const fetchSequences = async () => {
        try {
            setLoading(true);
            const res = await authenticatedFetch('/api/settings/vouchers');
            const data = await res.json();
            if (data.success) {
                setSequences(data.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeCompany) {
            fetchSequences();
        }
    }, [activeCompany]);

    const handleEdit = (seq: VoucherSequence) => {
        setEditingType(seq.type);
        setEditForm({ prefix: seq.prefix, nextValue: seq.nextValue });
    };

    const handleSave = async (type: string) => {
        try {
            const res = await authenticatedFetch('/api/settings/vouchers', {
                method: 'POST',
                body: JSON.stringify({
                    type,
                    prefix: editForm.prefix,
                    nextValue: editForm.nextValue
                })
            });
            const data = await res.json();
            if (data.success) {
                setEditingType(null);
                fetchSequences();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error(error);
            alert('Failed to save');
        }
    };

    if (loading) return <div>Loading settings...</div>;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Voucher Numbering</h3>
                <p className="text-sm font-bold text-slate-400 mt-1">Configure prefixes and sequence numbers for different voucher types.</p>
            </div>

            <div className="overflow-x-auto p-4 md:p-8">
                <table className="w-full text-sm text-left">
                    <thead className="text-slate-400 uppercase font-black text-[10px] tracking-widest border-b border-slate-200 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-4">Voucher Type</th>
                            <th className="px-6 py-4">Prefix</th>
                            <th className="px-6 py-4">Next Number</th>
                            <th className="px-6 py-4">Preview</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {sequences.map((seq) => (
                            <tr key={seq.type} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors group">
                                <td className="px-6 py-5 font-bold text-slate-800 dark:text-slate-200">
                                    {seq.type.replace(/_/g, ' ')}
                                </td>
                                <td className="px-6 py-5">
                                    {editingType === seq.type ? (
                                        <input
                                            type="text"
                                            value={editForm.prefix}
                                            onChange={(e) => setEditForm({ ...editForm, prefix: e.target.value })}
                                            className="w-24 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        />
                                    ) : (
                                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 px-3 py-1.5 rounded-lg">
                                            {seq.prefix || '-'}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-5">
                                    {editingType === seq.type ? (
                                        <input
                                            type="number"
                                            value={editForm.nextValue}
                                            onChange={(e) => setEditForm({ ...editForm, nextValue: Number(e.target.value) })}
                                            className="w-24 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        />
                                    ) : (
                                        <span className="font-mono font-medium text-slate-600 dark:text-slate-400">{seq.nextValue}</span>
                                    )}
                                </td>
                                <td className="px-6 py-5 text-slate-400 font-mono text-sm font-medium">
                                    {editingType === seq.type
                                        ? `${editForm.prefix}${editForm.nextValue}`
                                        : (seq.prefix ? `${seq.prefix}${seq.nextValue}` : '-')
                                    }
                                </td>
                                <td className="px-6 py-5 text-right">
                                    {editingType === seq.type ? (
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleSave(seq.type)}
                                                className="text-white font-bold text-[10px] uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingType(null)}
                                                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold text-[10px] uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleEdit(seq)}
                                            className="text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:underline uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
