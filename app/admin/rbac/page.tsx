"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useCompany } from '@/context/CompanyContext';

interface RoleDef {
    id: string;
    name: string;
    description: string | null;
    permissionCount: number;
}

interface UserRole {
    userRoleId: string;
    roleId: string;
    roleName: string;
    roleDescription: string | null;
}

interface CompanyUser {
    id: string;
    fullName: string | null;
    email: string;
    isSuperAdmin: boolean;
    isActive: boolean;
    lastLoginAt: string | null;
    companyRole: string;
    assignedRoles: UserRole[];
}

export default function RBACPage() {
    const { activeCompany } = useCompany();
    const [users, setUsers] = useState<CompanyUser[]>([]);
    const [roles, setRoles] = useState<RoleDef[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null); // userId being saved
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = async () => {
        if (!activeCompany) return;
        try {
            setLoading(true);
            const res = await authenticatedFetch(`/api/admin/roles/company-users?companyId=${activeCompany.id}`);
            const data = await res.json();
            if (data.success) {
                setUsers(data.data.users);
                setRoles(data.data.roles);
            }
        } catch (error) {
            console.error('Failed to load RBAC data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeCompany]);

    const toggleRole = async (userId: string, roleId: string, isAssigned: boolean) => {
        setSaving(userId);
        try {
            const res = await authenticatedFetch('/api/admin/roles/assign', {
                method: isAssigned ? 'DELETE' : 'POST',
                body: JSON.stringify({ userId, roleId }),
            });
            const data = await res.json();
            if (data.success) {
                await fetchData();
            }
        } catch (error) {
            console.error('Failed to toggle role:', error);
        } finally {
            setSaving(null);
        }
    };

    const filteredUsers = users.filter(u =>
        (u.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getRoleColor = (name: string) => {
        switch (name) {
            case 'ADMIN': return { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', accent: 'bg-purple-500' };
            case 'SALES': return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', accent: 'bg-emerald-500' };
            case 'PURCHASE': return { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', accent: 'bg-blue-500' };
            case 'ACCOUNTANT': return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', accent: 'bg-amber-500' };
            case 'VIEWER': return { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30', accent: 'bg-slate-500' };
            default: return { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30', accent: 'bg-indigo-500' };
        }
    };

    const getCompanyRoleBadge = (role: string) => {
        switch (role) {
            case 'OWNER': return { icon: '👑', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
            case 'ADMIN': return { icon: '🔧', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
            default: return { icon: '👤', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
        }
    };

    return (
        <MainLayout>
            <div className="p-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <span className="text-lg">🔐</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                Access Control
                            </h1>
                            <p className="text-sm text-slate-500">
                                {activeCompany?.name} — Manage user roles and permissions
                            </p>
                        </div>
                    </div>
                </div>

                {/* Role Legend */}
                <div className="mb-6 flex flex-wrap gap-3">
                    {roles.map(role => {
                        const colors = getRoleColor(role.name);
                        const assignedCount = users.filter(u =>
                            u.assignedRoles.some(r => r.roleId === role.id)
                        ).length;
                        return (
                            <div
                                key={role.id}
                                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border ${colors.bg} ${colors.border} transition-all hover:scale-[1.02]`}
                            >
                                <div className={`w-2.5 h-2.5 rounded-full ${colors.accent}`}></div>
                                <div>
                                    <span className={`font-bold text-sm ${colors.text}`}>{role.name}</span>
                                    <span className="text-xs text-slate-500 ml-1.5">
                                        {role.permissionCount} perms · {assignedCount} user{assignedCount !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Search */}
                <div className="mb-4">
                    <div className="relative max-w-md">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-20">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-slate-500 text-sm">Loading users...</p>
                    </div>
                ) : (
                    /* Users × Roles Table */
                    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/80">
                                        <th className="text-left px-5 py-4 font-bold text-slate-600 dark:text-slate-300 uppercase text-xs tracking-wider w-[280px]">
                                            User
                                        </th>
                                        <th className="text-center px-3 py-4 font-bold text-slate-500 uppercase text-xs tracking-wider w-[80px]">
                                            Status
                                        </th>
                                        {roles.map(role => {
                                            const colors = getRoleColor(role.name);
                                            return (
                                                <th
                                                    key={role.id}
                                                    className="text-center px-3 py-4 font-bold uppercase text-xs tracking-wider min-w-[100px]"
                                                >
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`${colors.text}`}>{role.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-normal normal-case">
                                                            {role.permissionCount} perms
                                                        </span>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                    {filteredUsers.map(user => {
                                        const badge = getCompanyRoleBadge(user.companyRole);
                                        const isSaving = saving === user.id;

                                        return (
                                            <tr
                                                key={user.id}
                                                className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isSaving ? 'opacity-60' : ''} ${!user.isActive ? 'opacity-40' : ''}`}
                                            >
                                                {/* User Info */}
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">
                                                            {user.fullName?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-bold text-slate-900 dark:text-white truncate">
                                                                    {user.fullName || user.email.split('@')[0]}
                                                                </p>
                                                                {user.isSuperAdmin && (
                                                                    <span className="text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                                                                        SUPER
                                                                    </span>
                                                                )}
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold ${badge.color}`}>
                                                                    {badge.icon} {user.companyRole}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Active Status */}
                                                <td className="text-center px-3 py-4">
                                                    <span className={`inline-flex w-2.5 h-2.5 rounded-full ${user.isActive ? 'bg-green-500 shadow-sm shadow-green-500/50' : 'bg-red-500'}`}></span>
                                                </td>

                                                {/* Role Toggles */}
                                                {roles.map(role => {
                                                    const isAssigned = user.assignedRoles.some(r => r.roleId === role.id);
                                                    const colors = getRoleColor(role.name);

                                                    return (
                                                        <td key={role.id} className="text-center px-3 py-4">
                                                            <button
                                                                onClick={() => toggleRole(user.id, role.id, isAssigned)}
                                                                disabled={isSaving || user.isSuperAdmin}
                                                                className={`
                                                                    w-10 h-10 rounded-xl border-2 transition-all duration-200
                                                                    flex items-center justify-center mx-auto
                                                                    ${user.isSuperAdmin
                                                                        ? 'bg-purple-500/10 border-purple-500/30 cursor-not-allowed'
                                                                        : isAssigned
                                                                            ? `${colors.bg} ${colors.border} hover:opacity-80 shadow-sm`
                                                                            : 'bg-transparent border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                                                                    }
                                                                    ${isSaving ? 'animate-pulse' : ''}
                                                                `}
                                                                title={
                                                                    user.isSuperAdmin
                                                                        ? 'Super Admin has all permissions'
                                                                        : isAssigned
                                                                            ? `Remove ${role.name} role`
                                                                            : `Assign ${role.name} role`
                                                                }
                                                            >
                                                                {user.isSuperAdmin ? (
                                                                    <span className="text-purple-400 text-lg">👑</span>
                                                                ) : isAssigned ? (
                                                                    <span className={`${colors.text} text-lg font-bold`}>✓</span>
                                                                ) : (
                                                                    <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
                                                                )}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}

                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={roles.length + 2} className="text-center py-12 text-slate-500">
                                                {searchQuery ? 'No users match your search' : 'No users found in this company'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer summary */}
                        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                                {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} in {activeCompany?.name}
                            </span>
                            <span className="text-xs text-slate-400">
                                Click on a cell to toggle role • Super Admins have all permissions automatically
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
