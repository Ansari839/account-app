"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';

interface Company {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
    _count?: {
        users: number;
    }
}

export default function AdminCompaniesPage() {
    const { showNotification } = useNotifications();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', website: '', address: ''
    });

    const fetchCompanies = async () => {
        try {
            setLoading(true);
            const res = await authenticatedFetch('/api/admin/companies');
            const data = await res.json();
            if (data.success) {
                setCompanies(data.data);
            } else {
                showNotification('error', data.error);
            }
        } catch (error) {
            console.error(error);
            showNotification('error', 'Failed to fetch companies');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await authenticatedFetch('/api/admin/companies', {
                method: 'POST',
                body: JSON.stringify(formData),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                showNotification('success', 'Company created successfully');
                setFormData({ name: '', email: '', phone: '', website: '', address: '' });
                setIsModalOpen(false);
                fetchCompanies();
            } else {
                showNotification('error', data.error);
            }
        } catch (error) {
            console.error(error);
            showNotification('error', 'Failed to create company');
        }
    };

    const [cloneModalOpen, setCloneModalOpen] = useState(false);
    const [cloneSource, setCloneSource] = useState<{ id: string; name: string } | null>(null);
    const [cloneName, setCloneName] = useState('');

    const handleClone = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cloneSource) return;

        try {
            const res = await authenticatedFetch('/api/admin/companies', {
                method: 'POST',
                body: JSON.stringify({ name: cloneName, cloneFromId: cloneSource.id }),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                showNotification('success', 'Company cloned successfully');
                setCloneName('');
                setCloneSource(null);
                setCloneModalOpen(false);
                fetchCompanies();
            } else {
                showNotification('error', data.error);
            }
        } catch (error) {
            console.error(error);
            showNotification('error', 'Failed to clone company');
        }
    };

    return (
        <MainLayout>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Companies</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Manage all companies and business units in the system.</p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                    >
                        <span className="text-xl leading-none mb-0.5">+</span> New Company
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-20 text-slate-500 font-bold animate-pulse">Loading companies...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {companies.map((company) => (
                            <div key={company.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all group">
                                <div className="flex justify-between items-start mb-5">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                                        {company.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-md text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-widest uppercase border border-slate-200 dark:border-slate-700">
                                        ID: {company.id.substring(0, 8)}...
                                    </div>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3 truncate" title={company.name}>{company.name}</h3>
                                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400 font-medium">
                                    {company.email && (
                                        <div className="flex items-center gap-3">
                                            <span className="opacity-70">📧</span> {company.email}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                                        <span className="opacity-70">👥</span> <span className="font-bold text-slate-900 dark:text-white">{company._count?.users || 0}</span> Users
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                                    <button
                                        onClick={() => {
                                            setCloneSource({ id: company.id, name: company.name });
                                            setCloneName(`${company.name} (Copy)`);
                                            setCloneModalOpen(true);
                                        }}
                                        className="text-xs px-4 py-2 rounded-lg text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:text-emerald-300 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 font-bold transition-all active:scale-95"
                                    >
                                        Clone
                                    </button>
                                    <button className="text-xs px-4 py-2 rounded-lg text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:text-indigo-300 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 font-bold transition-all active:scale-95">
                                        Edit Details →
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Create Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">Create New Company</h2>
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Company Name *</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full mt-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all font-medium"
                                        placeholder="Acme Corp"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Email</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full mt-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Phone</label>
                                        <input
                                            type="text"
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full mt-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all font-medium"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Website</label>
                                    <input
                                        type="text"
                                        value={formData.website}
                                        onChange={e => setFormData({ ...formData, website: e.target.value })}
                                        className="w-full mt-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Address</label>
                                    <textarea
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        className="w-full mt-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all font-medium h-24 resize-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-5 py-2.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                                    >
                                        Create Company
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Clone Modal */}
                {cloneModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Clone Company</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium">Create a copy of <span className="font-bold text-slate-800 dark:text-white">{cloneSource?.name}</span>. This will copy all settings, chart of accounts, and master data.</p>

                            <form onSubmit={handleClone} className="space-y-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">New Company Name *</label>
                                    <input
                                        required
                                        type="text"
                                        value={cloneName}
                                        onChange={e => setCloneName(e.target.value)}
                                        className="w-full mt-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all font-medium"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-6">
                                    <button
                                        type="button"
                                        onClick={() => setCloneModalOpen(false)}
                                        className="px-5 py-2.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                                    >
                                        Clone Company
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
