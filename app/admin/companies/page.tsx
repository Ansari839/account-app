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
                        <h1 className="text-3xl font-bold tracking-tight text-white">Companies</h1>
                        <p className="text-slate-400 mt-1">Manage all companies in the system.</p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                    >
                        <span>+</span> New Company
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-slate-500">Loading companies...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {companies.map((company) => (
                            <div key={company.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-indigo-500/50 transition-colors group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center text-xl font-bold text-white shadow-lg">
                                        {company.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="bg-slate-700/50 px-2 py-1 rounded text-xs text-slate-400 font-mono">
                                        ID: {company.id.substring(0, 8)}...
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2 truncate" title={company.name}>{company.name}</h3>
                                <div className="space-y-2 text-sm text-slate-400">
                                    {company.email && (
                                        <div className="flex items-center gap-2">
                                            <span>📧</span> {company.email}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50 mt-2">
                                        <span>👥</span> {company._count?.users || 0} Users
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-700 flex justify-end gap-3">
                                    <button
                                        onClick={() => {
                                            setCloneSource({ id: company.id, name: company.name });
                                            setCloneName(`${company.name} (Copy)`);
                                            setCloneModalOpen(true);
                                        }}
                                        className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
                                    >
                                        Clone
                                    </button>
                                    <button className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">Edit Details →</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Create Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                            <h2 className="text-xl font-bold text-white mb-6">Create New Company</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-400">Company Name *</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full mt-1.5 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                        placeholder="Acme Corp"
                                    />
                                </div>
                                {/* ... existing fields ... */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-slate-400">Email</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full mt-1.5 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-400">Phone</label>
                                        <input
                                            type="text"
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full mt-1.5 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-400">Website</label>
                                    <input
                                        type="text"
                                        value={formData.website}
                                        onChange={e => setFormData({ ...formData, website: e.target.value })}
                                        className="w-full mt-1.5 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-400">Address</label>
                                    <textarea
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        className="w-full mt-1.5 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none h-20"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 text-slate-400 hover:text-white font-medium hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg shadow-indigo-500/20"
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                            <h2 className="text-xl font-bold text-white mb-2">Clone Company</h2>
                            <p className="text-slate-400 text-sm mb-6">Create a copy of <span className="font-bold text-white">{cloneSource?.name}</span>. This will copy all settings, chart of accounts, and master data.</p>

                            <form onSubmit={handleClone}>
                                <div>
                                    <label className="text-sm font-medium text-slate-400">New Company Name *</label>
                                    <input
                                        required
                                        type="text"
                                        value={cloneName}
                                        onChange={e => setCloneName(e.target.value)}
                                        className="w-full mt-1.5 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-6">
                                    <button
                                        type="button"
                                        onClick={() => setCloneModalOpen(false)}
                                        className="px-4 py-2 text-slate-400 hover:text-white font-medium hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-500/20"
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
