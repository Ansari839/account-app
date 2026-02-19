"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';

interface UserCompany {
    company: { id: string; name: string };
    role: string;
    isDefault: boolean;
}

interface User {
    id: string;
    email: string;
    fullName: string | null;
    isActive: boolean;
    isSuperAdmin: boolean;
    lastLoginAt: string | null;
    companies: UserCompany[];
}

interface Company {
    id: string;
    name: string;
}

export default function AdminUsersPage() {
    const { showNotification } = useNotifications();
    const [users, setUsers] = useState<User[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // Forms state
    const [createForm, setCreateForm] = useState({ email: '', password: '', fullName: '', isSuperAdmin: false });
    const [assignForm, setAssignForm] = useState({ companyId: '', role: 'USER', isDefault: false });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [usersRes, companiesRes] = await Promise.all([
                authenticatedFetch('/api/admin/users'),
                authenticatedFetch('/api/admin/companies')
            ]);

            const usersData = await usersRes.json();
            const companiesData = await companiesRes.json();

            if (usersData.success) setUsers(usersData.data);
            if (companiesData.success) setCompanies(companiesData.data);

        } catch (error) {
            console.error(error);
            showNotification('error', 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await authenticatedFetch('/api/admin/users', {
                method: 'POST',
                body: JSON.stringify(createForm),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                showNotification('success', 'User created successfully');
                setIsCreateOpen(false);
                setCreateForm({ email: '', password: '', fullName: '', isSuperAdmin: false });
                fetchData();
            } else {
                showNotification('error', data.error);
            }
        } catch (error) {
            showNotification('error', 'Create failed');
        }
    };

    const handleAssignCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;
        try {
            const res = await authenticatedFetch(`/api/admin/users/${selectedUser.id}/assign`, {
                method: 'POST',
                body: JSON.stringify(assignForm),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                showNotification('success', 'Company assigned successfully');
                setIsAssignOpen(false);
                setAssignForm({ companyId: '', role: 'USER', isDefault: false });
                setSelectedUser(null);
                fetchData();
            } else {
                showNotification('error', data.error);
            }
        } catch (error) {
            showNotification('error', 'Assignment failed');
        }
    };

    const openAssignModal = (user: User) => {
        setSelectedUser(user);
        setAssignForm({ companyId: companies[0]?.id || '', role: 'USER', isDefault: false });
        setIsAssignOpen(true);
    };

    return (
        <MainLayout>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Users management</h1>
                        <p className="text-slate-400 mt-1">Manage users, roles, and company access.</p>
                    </div>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                    >
                        <span>+</span> Add User
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-slate-500">Loading users...</div>
                ) : (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-slate-900/50 text-slate-200 uppercase font-bold text-xs">
                                <tr>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4">Assigned Companies</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-white">{user.fullName || 'No Name'}</div>
                                            <div className="text-xs text-slate-500">{user.email}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.isSuperAdmin ? (
                                                <span className="bg-purple-500/10 text-purple-400 px-2 py-1 rounded text-xs font-bold border border-purple-500/20">SUPER ADMIN</span>
                                            ) : (
                                                <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs">User</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {user.companies.map((uc) => (
                                                    <span key={uc.company.id} className="bg-indigo-500/10 text-indigo-300 px-2 py-1 rounded text-xs border border-indigo-500/20" title={uc.role}>
                                                        {uc.company.name} ({uc.role})
                                                    </span>
                                                ))}
                                                {user.companies.length === 0 && <span className="text-slate-600 italic">No access</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${user.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                {user.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => openAssignModal(user)}
                                                className="text-indigo-400 hover:text-indigo-300 text-xs font-bold bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
                                            >
                                                Manage Access
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Create User Modal */}
                {isCreateOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                            <h2 className="text-xl font-bold text-white mb-6">Create New User</h2>
                            <form onSubmit={handleCreateUser} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-400">Full Name</label>
                                    <input required type="text" value={createForm.fullName} onChange={e => setCreateForm({ ...createForm, fullName: e.target.value })} className="w-full mt-1.5 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-400">Email</label>
                                    <input required type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} className="w-full mt-1.5 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-400">Password</label>
                                    <input required type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} className="w-full mt-1.5 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                    <input type="checkbox" checked={createForm.isSuperAdmin} onChange={e => setCreateForm({ ...createForm, isSuperAdmin: e.target.checked })} className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-600" />
                                    <label className="text-sm text-slate-300">Is Super Admin?</label>
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white font-medium hover:bg-slate-800 rounded-lg">Cancel</button>
                                    <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg">Create User</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Assign Company Modal */}
                {isAssignOpen && selectedUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                            <h2 className="text-xl font-bold text-white mb-2">Assign Company</h2>
                            <p className="text-slate-400 text-sm mb-6">Assign {selectedUser.fullName} to a company.</p>
                            <form onSubmit={handleAssignCompany} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-400">Select Company</label>
                                    <select
                                        required
                                        value={assignForm.companyId}
                                        onChange={e => setAssignForm({ ...assignForm, companyId: e.target.value })}
                                        className="w-full mt-1.5 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    >
                                        <option value="">Select a company...</option>
                                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-400">Role</label>
                                    <select
                                        value={assignForm.role}
                                        onChange={e => setAssignForm({ ...assignForm, role: e.target.value })}
                                        className="w-full mt-1.5 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    >
                                        <option value="USER">User</option>
                                        <option value="ADMIN">Admin</option>
                                        <option value="OWNER">Owner</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                    <input type="checkbox" checked={assignForm.isDefault} onChange={e => setAssignForm({ ...assignForm, isDefault: e.target.checked })} className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-600" />
                                    <label className="text-sm text-slate-300">Set as Default Company?</label>
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <button type="button" onClick={() => setIsAssignOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white font-medium hover:bg-slate-800 rounded-lg">Cancel</button>
                                    <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg">Assign Access</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
