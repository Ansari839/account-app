"use client";

import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';

export default function CompanySettings() {
    const { showNotification } = useNotifications();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [profile, setProfile] = useState({
        name: '', address: '', phone: '', email: '', website: ''
    });

    useEffect(() => {
        authenticatedFetch('/api/admin/company')
            .then(res => res.json())
            .then(json => {
                if (json.success && json.data) setProfile(json.data);
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await authenticatedFetch('/api/admin/company', {
                method: 'PUT',
                body: JSON.stringify(profile)
            });
            const json = await res.json();
            if (json.success) showNotification('success', 'Company profile updated');
            else showNotification('error', json.error || 'Failed to update');
        } catch (e) {
            showNotification('error', 'Update failed');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-slate-500">Loading profile...</div>;

    return (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-semibold flex items-center gap-2">
                <span>🏢</span> Company Profile
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="text-sm font-medium text-slate-500">Company Name</label>
                    <input
                        type="text"
                        value={profile.name}
                        onChange={e => setProfile({ ...profile, name: e.target.value })}
                        className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-500">Email Address</label>
                    <input
                        type="email"
                        value={profile.email || ''}
                        onChange={e => setProfile({ ...profile, email: e.target.value })}
                        className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-500">Phone</label>
                    <input
                        type="text"
                        value={profile.phone || ''}
                        onChange={e => setProfile({ ...profile, phone: e.target.value })}
                        className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-500">Website</label>
                    <input
                        type="text"
                        value={profile.website || ''}
                        onChange={e => setProfile({ ...profile, website: e.target.value })}
                        className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-500">Address</label>
                    <textarea
                        value={profile.address || ''}
                        onChange={e => setProfile({ ...profile, address: e.target.value })}
                        className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 outline-none focus:ring-2 focus:ring-indigo-500/20 h-24"
                    />
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}
