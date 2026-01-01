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
        { header: 'Code', accessor: (c: any) => <span className="font-bold">{c.code}</span> },
        { header: 'Name', accessor: (c: any) => c.name },
        { header: 'Symbol', accessor: (c: any) => c.symbol },
        { header: 'Rate', accessor: (c: any) => c.rate },
        {
            header: 'Base',
            accessor: (c: any) => c.isBase ? <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full font-bold">BASE</span> : '-'
        },
        {
            header: 'Actions',
            accessor: (c: any) => (
                <div className="flex gap-2">
                    <button onClick={() => handleEdit(c)} className="text-indigo-600 font-bold text-xs hover:underline">Edit</button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-500 font-bold text-xs hover:underline">Delete</button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                <h3 className="text-lg font-semibold mb-4">{isEditing ? 'Edit Currency' : 'Add New Currency'}</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <input placeholder="Code (USD)" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none" />
                    <input placeholder="Name (Dollar)" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none" />
                    <input placeholder="Symbol ($)" value={formData.symbol} onChange={e => setFormData({ ...formData, symbol: e.target.value })} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none" />
                    <input type="number" placeholder="Rate" value={formData.rate} onChange={e => setFormData({ ...formData, rate: parseFloat(e.target.value) })} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none" />
                    <button onClick={handleSubmit} className="bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all">{isEditing ? 'Update' : 'Add'}</button>
                </div>
                {isEditing && <button onClick={() => { setIsEditing(false); setFormData({ id: '', code: '', name: '', symbol: '', rate: 1, isBase: false }); }} className="mt-2 text-sm text-slate-500 underline">Cancel Edit</button>}
                <div className="mt-4 flex items-center gap-2">
                    <input type="checkbox" checked={formData.isBase} onChange={e => setFormData({ ...formData, isBase: e.target.checked })} />
                    <label className="text-sm text-slate-500">Is Base Currency?</label>
                </div>
            </div>

            <DataTable data={currencies} columns={columns} searchPlaceholder="Search currencies..." isLoading={isLoading} />
        </div>
    );
}
