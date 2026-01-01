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
        { header: 'Code', accessor: (u: any) => <span className="font-bold">{u.code}</span> },
        { header: 'Name', accessor: (u: any) => u.name },
        {
            header: 'Actions',
            accessor: (u: any) => (
                <div className="flex gap-2">
                    <button onClick={() => handleEdit(u)} className="text-indigo-600 font-bold text-xs hover:underline">Edit</button>
                    <button onClick={() => handleDelete(u.id)} className="text-red-500 font-bold text-xs hover:underline">Delete</button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Form */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                <h3 className="text-lg font-semibold mb-4">{isEditing ? 'Edit Unit' : 'Add New Unit'}</h3>
                <div className="flex gap-4">
                    <input
                        placeholder="Code (e.g. KG)"
                        value={formData.code}
                        onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none"
                    />
                    <input
                        placeholder="Name (e.g. Kilograms)"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="flex-[2] p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none"
                    />
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all"
                    >
                        {isEditing ? 'Update' : 'Add'}
                    </button>
                    {isEditing && (
                        <button
                            onClick={() => { setIsEditing(false); setFormData({ id: '', code: '', name: '' }); }}
                            className="px-6 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-300 transition-all"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {/* List Units */}
            <DataTable
                data={units}
                columns={columns}
                searchPlaceholder="Search units..."
                isLoading={isLoading}
            />
        </div>
    );
}
