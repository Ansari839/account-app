"use client";

import React, { useEffect, useState } from 'react';
import { Building2, Mail, Phone, Globe, MapPin, Save, Loader2 } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

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

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground animate-in fade-in">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                <p className="text-sm font-medium">Loading profile...</p>
            </div>
        );
    }

    return (
        <div className="bg-card border border-border p-6 md:p-8 rounded-2xl shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between border-b border-border pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                        <Building2 size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground">Company Profile</h3>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">General Information</p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="hidden md:flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-2 lg:col-span-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 ml-1">
                        <Building2 size={12} /> Company Name
                    </label>
                    <input
                        type="text"
                        placeholder="Enter full company name"
                        value={profile.name}
                        onChange={e => setProfile({ ...profile, name: e.target.value })}
                        className="w-full p-4 rounded-xl border border-border bg-muted/10 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium placeholder:text-muted-foreground/40"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 ml-1">
                        <Mail size={12} /> Email Address
                    </label>
                    <input
                        type="email"
                        placeholder="contact@company.com"
                        value={profile.email || ''}
                        onChange={e => setProfile({ ...profile, email: e.target.value })}
                        className="w-full p-4 rounded-xl border border-border bg-muted/10 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium placeholder:text-muted-foreground/40"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 ml-1">
                        <Phone size={12} /> Contact Phone
                    </label>
                    <input
                        type="text"
                        placeholder="+92 000 0000000"
                        value={profile.phone || ''}
                        onChange={e => setProfile({ ...profile, phone: e.target.value })}
                        className="w-full p-4 rounded-xl border border-border bg-muted/10 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium placeholder:text-muted-foreground/40"
                    />
                </div>

                <div className="space-y-2 lg:col-span-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 ml-1">
                        <Globe size={12} /> Official Website
                    </label>
                    <input
                        type="text"
                        placeholder="https://www.company.com"
                        value={profile.website || ''}
                        onChange={e => setProfile({ ...profile, website: e.target.value })}
                        className="w-full p-4 rounded-xl border border-border bg-muted/10 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium placeholder:text-muted-foreground/40"
                    />
                </div>

                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 ml-1">
                        <MapPin size={12} /> Physical Address
                    </label>
                    <textarea
                        placeholder="Full street address, city, and country"
                        value={profile.address || ''}
                        onChange={e => setProfile({ ...profile, address: e.target.value })}
                        className="w-full p-4 rounded-xl border border-border bg-muted/10 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium placeholder:text-muted-foreground/40 h-32 resize-none"
                    />
                </div>
            </div>

            <div className="flex md:hidden justify-end pt-4 border-t border-border">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.01] transition-all disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}
