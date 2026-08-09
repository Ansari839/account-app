"use client";

import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';
import DataTable from '@/components/DataTable';

export default function UnitSettings() {
    const { showNotification } = useNotifications();
    const [units, setUnits] = useState([]);
    const [formData, setFormData] = useState({ id: '', code: '', name: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    const loadUnits = () => {
        setIsLoading(true);
        authenticatedFetch('/api/finance/units')
            .then(res => res.json())
            .then(json => {
                if (json.success) setUnits(json.data);
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    };

    useEffect(() => { loadUnits(); }, []);

    const handleSubmit = async () => {
        if (!formData.code || !formData.name) {
            showNotification('error', 'Code and Name are required');
            return;
        }

        try {
            const url = '/api/finance/units';
            const method = isEditing ? 'PUT' : 'POST';

            const res = await authenticatedFetch(url, {
                method,
                body: JSON.stringify(formData)
            });
            const json = await res.json();

            if (json.success) {
                showNotification('success', isEditing ? 'Unit updated' : 'Unit added');
                setFormData({ id: '', code: '', name: '' });
                setIsEditing(false);
                loadUnits();
            } else {
                showNotification('error', json.error);
            }
        } catch (e) {
            showNotification('error', 'Operation failed');
        }
    };

    const handleEdit = (unit: any) => {
        setFormData(unit);
        setIsEditing(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this unit?')) return;
        try {
            const res = await authenticatedFetch(`/api/finance/units?id=${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) {
                showNotification('success', 'Unit deleted');
                loadUnits();
            } else {
                showNotification('error', json.error);
            }
        } catch (e) {
            showNotification('error', 'Delete failed');
        }
    };

    const columns = [
        { header: 'Code', accessor: (u: any) => <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{u.code}</span> },
        { header: 'Name', accessor: (u: any) => <span className="font-bold text-slate-800 dark:text-slate-200">{u.name}</span> },
        {
            header: 'Actions',
            accessor: (u: any) => (
                <div className="flex gap-4">
                    <button onClick={() => handleEdit(u)} className="text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:underline uppercase tracking-widest">Edit</button>
                    <button onClick={() => handleDelete(u.id)} className="text-rose-500 dark:text-rose-400 font-bold text-xs hover:underline uppercase tracking-widest">Delete</button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2rem] shadow-sm">
                <h3 className="text-xl font-black mb-6 text-slate-800 dark:text-white tracking-tight">{isEditing ? 'Edit Unit' : 'Add New Unit'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    <div className="space-y-2 md:col-span-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Code</label>
                        <input
                            placeholder="e.g. KG"
                            value={formData.code}
                            onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                            className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 dark:text-white transition-all font-mono"
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Name</label>
                        <input
                            placeholder="e.g. Kilograms"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 dark:text-white transition-all"
                        />
                    </div>
                    <div className="flex gap-2 items-end md:col-span-2">
                        <button
                            onClick={handleSubmit}
                            className="flex-1 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all p-4"
                        >
                            {isEditing ? 'Update Unit' : 'Add Unit'}
                        </button>
                        {isEditing && (
                            <button
                                onClick={() => { setIsEditing(false); setFormData({ id: '', code: '', name: '' }); }}
                                className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-4 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-black"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* List Units */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2rem] shadow-sm overflow-hidden">
                <DataTable
                    data={units}
                    columns={columns}
                    searchPlaceholder="Search units by name or code..."
                    isLoading={isLoading}
                />
            </div>
        </div>
    );
}
