"use client";

import React, { useEffect, useState } from 'react';
import { Building2, Mail, Phone, Globe, MapPin, Save, Loader2, Factory } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';
import { useCompany } from '@/context/CompanyContext';
import SettingsLoading from './SettingsLoading';
import { cn } from '@/lib/utils';

export default function CompanySettings() {
    const { showNotification } = useNotifications();
    const { activeCompany, switchCompany } = useCompany();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [profile, setProfile] = useState<{
        name: string;
        address: string;
        phone: string;
        email: string;
        website: string;
        isManufacturing?: boolean;
    }>({
        name: '', address: '', phone: '', email: '', website: '', isManufacturing: false
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
            if (json.success) {
                showNotification('success', 'Company profile updated');
                if (activeCompany) {
                    await switchCompany({ ...activeCompany, isManufacturing: profile.isManufacturing });
                }
            } else {
                showNotification('error', json.error || 'Failed to update');
            }
        } catch (e) {
            showNotification('error', 'Update failed');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <SettingsLoading
                title="Loading Company Profile..."
                description="Fetching company details, address, and operational configurations."
            />
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2rem] shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl text-indigo-600 dark:text-indigo-400">
                        <Building2 size={28} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Company Profile</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">General Information</p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="hidden md:flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-3 lg:col-span-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                        <Building2 size={14} /> Company Name
                    </label>
                    <input
                        type="text"
                        placeholder="Enter full company name"
                        value={profile.name}
                        onChange={e => setProfile({ ...profile, name: e.target.value })}
                        className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 dark:text-white transition-all placeholder:text-slate-400"
                    />
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                        <Mail size={14} /> Email Address
                    </label>
                    <input
                        type="email"
                        placeholder="contact@company.com"
                        value={profile.email || ''}
                        onChange={e => setProfile({ ...profile, email: e.target.value })}
                        className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 dark:text-white transition-all placeholder:text-slate-400"
                    />
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                        <Phone size={14} /> Contact Phone
                    </label>
                    <input
                        type="text"
                        placeholder="+92 000 0000000"
                        value={profile.phone || ''}
                        onChange={e => setProfile({ ...profile, phone: e.target.value })}
                        className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 dark:text-white transition-all placeholder:text-slate-400 font-mono"
                    />
                </div>

                <div className="space-y-3 lg:col-span-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                        <Globe size={14} /> Official Website
                    </label>
                    <input
                        type="text"
                        placeholder="https://www.company.com"
                        value={profile.website || ''}
                        onChange={e => setProfile({ ...profile, website: e.target.value })}
                        className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 dark:text-white transition-all placeholder:text-slate-400"
                    />
                </div>

                <div className="space-y-3 md:col-span-2 lg:col-span-3">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                        <MapPin size={14} /> Physical Address
                    </label>
                    <textarea
                        placeholder="Full street address, city, and country"
                        value={profile.address || ''}
                        onChange={e => setProfile({ ...profile, address: e.target.value })}
                        className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 dark:text-white transition-all placeholder:text-slate-400 h-32 resize-none"
                    />
                </div>

                {/* Business Nature / Manufacturing Module Toggle */}
                <div className="md:col-span-2 lg:col-span-3 pt-6 border-t border-slate-200 dark:border-slate-800">
                    <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 transition-all hover:border-slate-300 dark:hover:border-slate-700">
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                "p-3 rounded-2xl transition-colors shrink-0",
                                profile.isManufacturing 
                                    ? "bg-indigo-500/10 text-indigo-500" 
                                    : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                            )}>
                                <Factory size={26} />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                                        Manufacturing & Production Facility
                                    </h4>
                                    <span className={cn(
                                        "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                        profile.isManufacturing 
                                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                            : "bg-slate-200 dark:bg-slate-800 text-slate-400 border-transparent"
                                    )}>
                                        {profile.isManufacturing ? 'Enabled' : 'Disabled'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                                    Turn this ON only if this company manufactures products. When enabled, the <strong>Production Dashboard, Bill of Materials (BOM), and Material Execution</strong> will be visible in the navigation. Commercial or Trading companies should keep this off.
                                </p>
                            </div>
                        </div>

                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                                type="checkbox"
                                checked={!!profile.isManufacturing}
                                onChange={e => setProfile({ ...profile, isManufacturing: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>
                </div>
            </div>

            <div className="flex md:hidden justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}
