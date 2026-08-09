"use client";

import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';
import DataTable from '@/components/DataTable';

export default function TaxSettings() {
    const { showNotification } = useNotifications();
    const [taxes, setTaxes] = useState([]);
    const [formData, setFormData] = useState({ id: '', code: '', name: '', rate: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    const loadData = () => {
        setIsLoading(true);
        authenticatedFetch('/api/finance/tax')
            .then(res => res.json())
            .then(json => {
                if (json.success) setTaxes(json.data);
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    };

    useEffect(() => { loadData(); }, []);

    const handleSubmit = async () => {
        if (!formData.code || !formData.name) {
            showNotification('error', 'Code and Name required');
            return;
        }

        try {
            const url = '/api/finance/tax';
            const method = isEditing ? 'PUT' : 'POST';

            const res = await authenticatedFetch(url, {
                method,
                body: JSON.stringify(formData)
            });
            const json = await res.json();

            if (json.success) {
                showNotification('success', isEditing ? 'Tax updated' : 'Tax added');
                setFormData({ id: '', code: '', name: '', rate: 0 });
                setIsEditing(false);
                loadData();
            } else {
                showNotification('error', json.error);
            }
        } catch (e) {
            showNotification('error', 'Operation failed');
        }
    };

    const handleEdit = (tax: any) => {
        setFormData({ ...tax, rate: Number(tax.rate) }); // Ensure rate is number
        setIsEditing(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this tax code?')) return;
        try {
            const res = await authenticatedFetch(`/api/finance/tax?id=${id}`, { method: 'DELETE' });
            if ((await res.json()).success) {
                showNotification('success', 'Tax deleted');
                loadData();
            }
        } catch (e) {
            showNotification('error', 'Delete failed');
        }
    };

    const columns = [
        { header: 'Code', accessor: (t: any) => <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{t.code}</span> },
        { header: 'Name', accessor: (t: any) => <span className="font-bold text-slate-800 dark:text-slate-200">{t.name}</span> },
        { header: 'Rate (%)', accessor: (t: any) => <span className="font-black text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">{t.rate}%</span> },
        {
            header: 'Actions',
            accessor: (t: any) => (
                <div className="flex gap-4">
                    <button onClick={() => handleEdit(t)} className="text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:underline uppercase tracking-widest">Edit</button>
                    <button onClick={() => handleDelete(t.id)} className="text-rose-500 dark:text-rose-400 font-bold text-xs hover:underline uppercase tracking-widest">Delete</button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2rem] shadow-sm">
                <h3 className="text-xl font-black mb-6 text-slate-800 dark:text-white tracking-tight">{isEditing ? 'Edit Tax Code' : 'Add Tax Code'}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Code</label>
                        <input placeholder="e.g. VAT" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 dark:text-white transition-all font-mono" />
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Name</label>
                        <input placeholder="e.g. Value Added Tax" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 dark:text-white transition-all" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rate (%)</label>
                        <input type="number" placeholder="0" value={formData.rate} onChange={e => setFormData({ ...formData, rate: parseFloat(e.target.value) })} className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-black text-slate-800 dark:text-white transition-all" />
                    </div>
                    <div className="flex gap-2 items-end lg:col-span-2">
                        <button onClick={handleSubmit} className="flex-1 p-4 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all">
                            {isEditing ? 'Update' : 'Add'}
                        </button>
                        {isEditing && (
                            <button onClick={() => { setIsEditing(false); setFormData({ id: '', code: '', name: '', rate: 0 }); }} className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                ✕
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2rem] shadow-sm overflow-hidden">
                <DataTable data={taxes} columns={columns} searchPlaceholder="Search taxes..." isLoading={isLoading} />
            </div>
        </div>
    );
}
