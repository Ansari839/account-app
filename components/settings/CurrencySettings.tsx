"use client";

import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';
import DataTable from '@/components/DataTable';

export default function CurrencySettings() {
    const { showNotification } = useNotifications();
    const [currencies, setCurrencies] = useState([]);
    const [formData, setFormData] = useState({ id: '', code: '', name: '', symbol: '', rate: 1, isBase: false });
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    const loadData = () => {
        setIsLoading(true);
        authenticatedFetch('/api/finance/currency')
            .then(res => res.json())
            .then(json => {
                if (json.success) setCurrencies(json.data);
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
            // Upsert handled by POST usually for currency if key is code, 
            // but we standardised Delete. Let's assume POST handles upsert as per previous logic
            // or we use PUT if my controller supports it. 
            // Controller: upsert is on POST. create is NOT separate. 
            // Let's use POST for bothCreate and Update since controller uses upsert.

            const res = await authenticatedFetch('/api/finance/currency', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            const json = await res.json();

            if (json.success) {
                showNotification('success', isEditing ? 'Currency updated' : 'Currency added');
                setFormData({ id: '', code: '', name: '', symbol: '', rate: 1, isBase: false });
                setIsEditing(false);
                loadData();
            } else {
                showNotification('error', json.error);
            }
        } catch (e) {
            showNotification('error', 'Operation failed');
        }
    };

    const handleEdit = (c: any) => {
        setFormData({ ...c, rate: Number(c.rate) });
        setIsEditing(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this currency?')) return;
        try {
            const res = await authenticatedFetch(`/api/finance/currency?id=${id}`, { method: 'DELETE' });
            if ((await res.json()).success) {
                showNotification('success', 'Currency deleted');
                loadData();
            }
        } catch (e) {
            showNotification('error', 'Delete failed');
        }
    };

    const columns = [
        { header: 'Code', accessor: (c: any) => <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{c.code}</span> },
        { header: 'Name', accessor: (c: any) => <span className="font-bold text-slate-800 dark:text-slate-200">{c.name}</span> },
        { header: 'Symbol', accessor: (c: any) => <span className="font-black text-slate-500">{c.symbol}</span> },
        { header: 'Rate', accessor: (c: any) => <span className="font-mono font-medium">{c.rate}</span> },
        {
            header: 'Base',
            accessor: (c: any) => c.isBase 
                ? <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded-full font-black tracking-widest uppercase">BASE</span> 
                : <span className="text-slate-400">-</span>
        },
        {
            header: 'Actions',
            accessor: (c: any) => (
                <div className="flex gap-4">
                    <button onClick={() => handleEdit(c)} className="text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:underline uppercase tracking-widest">Edit</button>
                    <button onClick={() => handleDelete(c.id)} className="text-rose-500 dark:text-rose-400 font-bold text-xs hover:underline uppercase tracking-widest">Delete</button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2rem] shadow-sm">
                <h3 className="text-xl font-black mb-6 text-slate-800 dark:text-white tracking-tight">{isEditing ? 'Edit Currency' : 'Add New Currency'}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Code</label>
                        <input placeholder="e.g. USD" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 dark:text-white transition-all font-mono" />
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Name</label>
                        <input placeholder="e.g. US Dollar" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 dark:text-white transition-all" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Symbol</label>
                        <input placeholder="e.g. $" value={formData.symbol} onChange={e => setFormData({ ...formData, symbol: e.target.value })} className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-black text-slate-800 dark:text-white transition-all" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Exchange Rate</label>
                        <input type="number" placeholder="1.00" value={formData.rate} onChange={e => setFormData({ ...formData, rate: parseFloat(e.target.value) })} className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-slate-800 dark:text-white transition-all" />
                    </div>
                    <div className="flex flex-col justify-end gap-2">
                        <button onClick={handleSubmit} className="w-full p-4 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all">
                            {isEditing ? 'Update' : 'Add'}
                        </button>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center">
                            <input type="checkbox" checked={formData.isBase} onChange={e => setFormData({ ...formData, isBase: e.target.checked })} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500 transition-colors"></div>
                        </div>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">Set as Base Currency</span>
                    </label>

                    {isEditing && (
                        <button onClick={() => { setIsEditing(false); setFormData({ id: '', code: '', name: '', symbol: '', rate: 1, isBase: false }); }} className="text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                            Cancel Edit
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2rem] shadow-sm overflow-hidden">
                <DataTable data={currencies} columns={columns} searchPlaceholder="Search currencies..." isLoading={isLoading} />
            </div>
        </div>
    );
}
