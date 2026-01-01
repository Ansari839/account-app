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
        { header: 'Name', accessor: (y: any) => <span className="font-bold">{y.name}</span> },
        { header: 'Start Date', accessor: (y: any) => new Date(y.startDate).toLocaleDateString() },
        { header: 'End Date', accessor: (y: any) => new Date(y.endDate).toLocaleDateString() },
        {
            header: 'Status',
            accessor: (y: any) => y.isOpen
                ? <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full font-bold">OPEN</span>
                : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-bold">CLOSED</span>
        },
        {
            header: 'Actions',
            accessor: (y: any) => (
                <div className="flex gap-2">
                    <button onClick={() => handleEdit(y)} className="text-indigo-600 font-bold text-xs hover:underline">Edit</button>
                    <button onClick={() => handleDelete(y.id)} className="text-red-500 font-bold text-xs hover:underline">Delete</button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                <h3 className="text-lg font-semibold mb-4">{isEditing ? 'Edit Fiscal Year' : 'Open New Fiscal Year'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input
                        placeholder="Name (FY 2025-26)"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none"
                    />
                    <input
                        type="date"
                        value={formData.startDate}
                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none"
                    />
                    <input
                        type="date"
                        value={formData.endDate}
                        onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none"
                    />
                    <div className="flex gap-2">
                        <button onClick={handleSubmit} className="flex-1 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all">
                            {isEditing ? 'Update' : 'Open Year'}
                        </button>
                        {isEditing && (
                            <button onClick={() => { setIsEditing(false); setFormData({ id: '', name: '', startDate: '', endDate: '', isOpen: true }); }} className="bg-slate-200 text-slate-600 p-3 rounded-xl hover:bg-slate-300">
                                ✕
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <DataTable data={years} columns={columns} searchPlaceholder="Search fiscal years..." isLoading={isLoading} />
        </div>
    );
}
