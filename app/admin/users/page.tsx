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

    const handleRemoveCompany = async (companyId: string) => {
        if (!selectedUser || !confirm('Are you sure you want to remove access to this company?')) return;
        try {
            const res = await authenticatedFetch(`/api/admin/users/${selectedUser.id}/assign?companyId=${companyId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                showNotification('success', 'Access removed successfully');
                
                // Update selectedUser state directly to reflect UI instantly
                const updatedUser = {
                    ...selectedUser,
                    companies: selectedUser.companies.filter(c => c.company.id !== companyId)
                };
                setSelectedUser(updatedUser);
                
                fetchData();
            } else {
                showNotification('error', data.error);
            }
        } catch (error) {
            showNotification('error', 'Failed to remove access');
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
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Users Management</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Manage system users, roles, and company access.</p>
                    </div>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                    >
                        <span className="text-xl leading-none mb-0.5">+</span> Add User
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-20 text-slate-500 font-bold animate-pulse">Loading users...</div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-black tracking-widest text-[10px]">
                                <tr>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4">Assigned Companies</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900 dark:text-white text-base">{user.fullName || 'No Name'}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{user.email}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.isSuperAdmin ? (
                                                <span className="bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">
                                                    Super Admin
                                                </span>
                                            ) : (
                                                <span className="bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">
                                                    User
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {user.companies.map((uc) => (
                                                    <span key={uc.company.id} className="bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide" title={uc.role}>
                                                        {uc.company.name} <span className="opacity-60 font-black uppercase tracking-widest ml-1">({uc.role})</span>
                                                    </span>
                                                ))}
                                                {user.companies.length === 0 && <span className="text-slate-400 dark:text-slate-500 text-xs italic font-medium">No access</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                                user.isActive 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' 
                                                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
                                            }`}>
                                                {user.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => openAssignModal(user)}
                                                className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 dark:text-indigo-400 dark:hover:text-indigo-300 text-xs font-bold dark:bg-indigo-500/10 px-4 py-2 rounded-xl dark:border-indigo-500/20 dark:hover:bg-indigo-500/20 transition-all active:scale-95"
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">Create New User</h2>
                            <form onSubmit={handleCreateUser} className="space-y-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Full Name</label>
                                    <input required type="text" value={createForm.fullName} onChange={e => setCreateForm({ ...createForm, fullName: e.target.value })} className="w-full mt-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Email</label>
                                    <input required type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} className="w-full mt-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Password</label>
                                    <input required type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} className="w-full mt-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium" />
                                </div>
                                <div className="flex items-center gap-3 pt-2">
                                    <input type="checkbox" id="isSuperAdmin" checked={createForm.isSuperAdmin} onChange={e => setCreateForm({ ...createForm, isSuperAdmin: e.target.checked })} className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500" />
                                    <label htmlFor="isSuperAdmin" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">Grant Super Admin Privileges</label>
                                </div>
                                <div className="flex justify-end gap-3 pt-6">
                                    <button type="button" onClick={() => setIsCreateOpen(false)} className="px-5 py-2.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">Cancel</button>
                                    <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all">Create User</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Assign Company Modal */}
                {isAssignOpen && selectedUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Assign Company</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium">Assign access for <span className="font-bold text-slate-700 dark:text-slate-300">{selectedUser.fullName}</span>.</p>
                            
                            {selectedUser.companies.length > 0 && (
                                <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Currently Assigned</h3>
                                    <div className="space-y-2">
                                        {selectedUser.companies.map((uc) => (
                                            <div key={uc.company.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <div>
                                                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{uc.company.name}</div>
                                                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{uc.role}</div>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveCompany(uc.company.id)}
                                                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-colors"
                                                    title="Remove Access"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleAssignCompany} className="space-y-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Select Company</label>
                                    <select
                                        required
                                        value={assignForm.companyId}
                                        onChange={e => setAssignForm({ ...assignForm, companyId: e.target.value })}
                                        className="w-full mt-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium appearance-none"
                                    >
                                        <option value="">Select a company...</option>
                                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Role within Company</label>
                                    <select
                                        value={assignForm.role}
                                        onChange={e => setAssignForm({ ...assignForm, role: e.target.value })}
                                        className="w-full mt-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium appearance-none"
                                    >
                                        <option value="USER">User (Standard)</option>
                                        <option value="ADMIN">Admin (Manager)</option>
                                        <option value="OWNER">Owner</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-3 pt-2">
                                    <input type="checkbox" id="isDefault" checked={assignForm.isDefault} onChange={e => setAssignForm({ ...assignForm, isDefault: e.target.checked })} className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500" />
                                    <label htmlFor="isDefault" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">Set as Default Company?</label>
                                </div>
                                <div className="flex justify-end gap-3 pt-6">
                                    <button type="button" onClick={() => setIsAssignOpen(false)} className="px-5 py-2.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">Cancel</button>
                                    <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all">Assign Access</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
