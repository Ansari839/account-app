"use client";

import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';
import DataTable from '@/components/DataTable';

export default function FiscalYearSettings() {
    const { showNotification } = useNotifications();
    const [years, setYears] = useState([]);
    const [formData, setFormData] = useState({
        id: '', name: '', startDate: '', endDate: '', isOpen: true
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    const loadData = () => {
        setIsLoading(true);
        authenticatedFetch('/api/finance/fiscal-year')
            .then(res => res.json())
            .then(json => {
                if (json.success) setYears(json.data);
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    };

    useEffect(() => { loadData(); }, []);

    const handleSubmit = async () => {
        if (!formData.name || !formData.startDate || !formData.endDate) {
            showNotification('error', 'Fields required');
            return;
        }

        try {
            const url = '/api/finance/fiscal-year';
            const method = isEditing ? 'PUT' : 'POST';

            const res = await authenticatedFetch(url, {
                method,
                body: JSON.stringify(formData)
            });
            const json = await res.json();

            if (json.success) {
                showNotification('success', isEditing ? 'Year updated' : 'Year added');
                setFormData({ id: '', name: '', startDate: '', endDate: '', isOpen: true });
                setIsEditing(false);
                loadData();
            } else {
                showNotification('error', json.error);
            }
        } catch (e) {
            showNotification('error', 'Operation failed');
        }
    };

    const handleEdit = (y: any) => {
        setFormData({
            ...y,
            startDate: y.startDate.split('T')[0],
            endDate: y.endDate.split('T')[0]
        });
        setIsEditing(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this Fiscal Year?')) return;
        try {
            const res = await authenticatedFetch(`/api/finance/fiscal-year?id=${id}`, { method: 'DELETE' });
            if ((await res.json()).success) {
                showNotification('success', 'Fiscal Year deleted');
                loadData();
            }
        } catch (e) {
            showNotification('error', 'Delete failed');
        }
    };

    const columns = [
        { header: 'Name', accessor: (y: any) => <span className="font-bold text-slate-800 dark:text-slate-200">{y.name}</span> },
        { header: 'Start Date', accessor: (y: any) => <span className="font-mono text-slate-500">{new Date(y.startDate).toLocaleDateString()}</span> },
        { header: 'End Date', accessor: (y: any) => <span className="font-mono text-slate-500">{new Date(y.endDate).toLocaleDateString()}</span> },
        {
            header: 'Status',
            accessor: (y: any) => y.isOpen
                ? <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded-full font-black tracking-widest uppercase">OPEN</span>
                : <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-full font-black tracking-widest uppercase">CLOSED</span>
        },
        {
            header: 'Actions',
            accessor: (y: any) => (
                <div className="flex gap-4">
                    <button onClick={() => handleEdit(y)} className="text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:underline uppercase tracking-widest">Edit</button>
                    <button onClick={() => handleDelete(y.id)} className="text-rose-500 dark:text-rose-400 font-bold text-xs hover:underline uppercase tracking-widest">Delete</button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2rem] shadow-sm">
                <h3 className="text-xl font-black mb-6 text-slate-800 dark:text-white tracking-tight">{isEditing ? 'Edit Fiscal Year' : 'Open New Fiscal Year'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Name</label>
                        <input
                            placeholder="e.g. FY 2025-26"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 dark:text-white transition-all placeholder:text-slate-400"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                        <input
                            type="date"
                            value={formData.startDate}
                            onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                            className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 dark:text-white transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                        <input
                            type="date"
                            value={formData.endDate}
                            onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                            className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 dark:text-white transition-all"
                        />
                    </div>
                    <div className="flex gap-2 items-end">
                        <button onClick={handleSubmit} className="flex-1 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all p-4">
                            {isEditing ? 'Update' : 'Open Year'}
                        </button>
                        {isEditing && (
                            <button onClick={() => { setIsEditing(false); setFormData({ id: '', name: '', startDate: '', endDate: '', isOpen: true }); }} className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-4 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-black">
                                ✕
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2rem] shadow-sm overflow-hidden">
                <DataTable data={years} columns={columns} searchPlaceholder="Search fiscal years..." isLoading={isLoading} />
            </div>
        </div>
    );
}
