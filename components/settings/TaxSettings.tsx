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
        { header: 'Code', accessor: (t: any) => <span className="font-bold">{t.code}</span> },
        { header: 'Name', accessor: (t: any) => t.name },
        { header: 'Rate (%)', accessor: (t: any) => `${t.rate}%` },
        {
            header: 'Actions',
            accessor: (t: any) => (
                <div className="flex gap-2">
                    <button onClick={() => handleEdit(t)} className="text-indigo-600 font-bold text-xs hover:underline">Edit</button>
                    <button onClick={() => handleDelete(t.id)} className="text-red-500 font-bold text-xs hover:underline">Delete</button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                <h3 className="text-lg font-semibold mb-4">{isEditing ? 'Edit Tax Code' : 'Add Tax Code'}</h3>
                <div className="flex gap-4">
                    <input placeholder="Code (VAT)" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none" />
                    <input placeholder="Name (Value Added Tax)" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="flex-[2] p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none" />
                    <input type="number" placeholder="Rate (%)" value={formData.rate} onChange={e => setFormData({ ...formData, rate: parseFloat(e.target.value) })} className="w-24 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none" />
                    <button onClick={handleSubmit} className="bg-indigo-600 text-white font-bold px-6 rounded-xl shadow-lg hover:scale-105 transition-all">{isEditing ? 'Update' : 'Add'}</button>
                    {isEditing && (
                        <button onClick={() => { setIsEditing(false); setFormData({ id: '', code: '', name: '', rate: 0 }); }} className="bg-slate-200 text-slate-600 font-bold px-6 rounded-xl hover:bg-slate-300 transition-all">Cancel</button>
                    )}
                </div>
            </div>

            <DataTable data={taxes} columns={columns} searchPlaceholder="Search taxes..." isLoading={isLoading} />
        </div>
    );
}
