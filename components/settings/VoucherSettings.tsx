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
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Voucher Numbering</h3>
                <p className="text-sm text-slate-500">Configure prefixes and sequence numbers for different voucher types.</p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-xs">
                        <tr>
                            <th className="px-6 py-3">Voucher Type</th>
                            <th className="px-6 py-3">Prefix</th>
                            <th className="px-6 py-3">Next Number</th>
                            <th className="px-6 py-3">Preview</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {sequences.map((seq) => (
                            <tr key={seq.type} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-gray-200">
                                    {seq.type.replace(/_/g, ' ')}
                                </td>
                                <td className="px-6 py-4">
                                    {editingType === seq.type ? (
                                        <input
                                            type="text"
                                            value={editForm.prefix}
                                            onChange={(e) => setEditForm({ ...editForm, prefix: e.target.value })}
                                            className="w-24 px-2 py-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm"
                                        />
                                    ) : (
                                        <span className="font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                                            {seq.prefix || '-'}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {editingType === seq.type ? (
                                        <input
                                            type="number"
                                            value={editForm.nextValue}
                                            onChange={(e) => setEditForm({ ...editForm, nextValue: Number(e.target.value) })}
                                            className="w-24 px-2 py-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm"
                                        />
                                    ) : (
                                        <span className="font-mono">{seq.nextValue}</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                                    {editingType === seq.type
                                        ? `${editForm.prefix}${editForm.nextValue}`
                                        : (seq.prefix ? `${seq.prefix}${seq.nextValue}` : '-')
                                    }
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {editingType === seq.type ? (
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleSave(seq.type)}
                                                className="text-emerald-500 hover:text-emerald-600 font-bold text-xs bg-emerald-500/10 px-2 py-1 rounded"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingType(null)}
                                                className="text-slate-400 hover:text-slate-500 text-xs px-2 py-1"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleEdit(seq)}
                                            className="text-indigo-500 hover:text-indigo-600 font-medium text-xs hover:underline"
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
