"use client";

import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';
import { useCompany } from '@/context/CompanyContext';
import { MODULES } from '@/lib/permissions';

interface PermissionDef {
    id: string;
    key: string;
    module: string;
    action: string;
    description: string;
}

interface RoleDef {
    id: string;
    name: string;
    description: string;
    permissions: PermissionDef[];
    users: { id: string; fullName: string | null; email: string }[];
    userCount: number;
}

export default function RoleSettings() {
    const { showNotification } = useNotifications();
    const { activeCompany } = useCompany();
    const [roles, setRoles] = useState<RoleDef[]>([]);
    const [allPermissions, setAllPermissions] = useState<PermissionDef[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit modal state
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<RoleDef | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);

    const fetchRoles = async () => {
        if (!activeCompany) return;
        try {
            setLoading(true);
            const res = await authenticatedFetch(`/api/admin/roles?companyId=${activeCompany.id}`);
            const data = await res.json();
            if (data.success) {
                setRoles(data.data.roles);
                setAllPermissions(data.data.allPermissions);
            }
        } catch (error) {
            showNotification('error', 'Failed to load roles');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, [activeCompany]);

    const openEditModal = (role: RoleDef | null) => {
        if (role) {
            setEditingRole(role);
            setEditName(role.name);
            setEditDescription(role.description || '');
            setSelectedPermIds(role.permissions.map(p => p.id));
        } else {
            setEditingRole(null);
            setEditName('');
            setEditDescription('');
            setSelectedPermIds([]);
        }
        setIsEditOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeCompany) return;

        try {
            const res = await authenticatedFetch('/api/admin/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: activeCompany.id,
                    roleId: editingRole?.id,
                    name: editName,
                    description: editDescription,
                    permissionIds: selectedPermIds,
                })
            });
            const data = await res.json();
            if (data.success) {
                showNotification('success', editingRole ? 'Role updated!' : 'Role created!');
                setIsEditOpen(false);
                fetchRoles();
            } else {
                showNotification('error', data.error);
            }
        } catch {
            showNotification('error', 'Save failed');
        }
    };

    const togglePermission = (permId: string) => {
        setSelectedPermIds(prev =>
            prev.includes(permId)
                ? prev.filter(id => id !== permId)
                : [...prev, permId]
        );
    };

    const toggleModule = (moduleName: string) => {
        const modulePerms = allPermissions.filter(p => p.module === moduleName);
        const modulePermIds = modulePerms.map(p => p.id);
        const allSelected = modulePermIds.every(id => selectedPermIds.includes(id));

        if (allSelected) {
            setSelectedPermIds(prev => prev.filter(id => !modulePermIds.includes(id)));
        } else {
            setSelectedPermIds(prev => [...new Set([...prev, ...modulePermIds])]);
        }
    };

    // Group permissions by module
    const groupedPermissions = Object.keys(MODULES).map(mod => ({
        module: mod,
        permissions: allPermissions.filter(p => p.module === mod),
    })).filter(g => g.permissions.length > 0);

    const getRoleBadgeColor = (name: string) => {
        switch (name) {
            case 'ADMIN': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            case 'SALES': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'PURCHASE': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'ACCOUNTANT': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'VIEWER': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
            default: return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
        }
    };

    if (loading) {
        return <div className="text-center py-12 text-slate-500">Loading roles...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Roles & Permissions</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Define what each role can access. Users are assigned roles via the Users page.
                    </p>
                </div>
                <button
                    onClick={() => openEditModal(null)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-lg shadow-indigo-500/20 transition-all text-sm flex items-center gap-2"
                >
                    <span>+</span> New Role
                </button>
            </div>

            {/* Roles Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {roles.map(role => (
                    <div
                        key={role.id}
                        className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-indigo-500/30 transition-all group"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getRoleBadgeColor(role.name)}`}>
                                    {role.name}
                                </span>
                            </div>
                            <button
                                onClick={() => openEditModal(role)}
                                className="text-xs text-slate-400 hover:text-indigo-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                Edit ✏️
                            </button>
                        </div>
                        {role.description && (
                            <p className="text-xs text-slate-500 mb-3">{role.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mb-3">
                            {role.permissions.slice(0, 6).map(p => (
                                <span key={p.id} className="text-[10px] bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono">
                                    {p.module}.{p.action}
                                </span>
                            ))}
                            {role.permissions.length > 6 && (
                                <span className="text-[10px] text-slate-400">+{role.permissions.length - 6} more</span>
                            )}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                            👥 {role.userCount} user{role.userCount !== 1 ? 's' : ''}
                        </div>
                    </div>
                ))}
            </div>

            {roles.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-slate-500">No roles defined yet. Run the permissions seed first.</p>
                    <code className="text-xs text-indigo-400 mt-2 block">npx tsx prisma/seed-permissions.ts</code>
                </div>
            )}

            {/* Edit/Create Role Modal */}
            {isEditOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                            {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Role'}
                        </h2>
                        <p className="text-sm text-slate-500 mb-6">
                            Select which modules and actions this role can access.
                        </p>

                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Role Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value.toUpperCase())}
                                        placeholder="e.g. SALES_MANAGER"
                                        className="w-full mt-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Description</label>
                                    <input
                                        type="text"
                                        value={editDescription}
                                        onChange={e => setEditDescription(e.target.value)}
                                        placeholder="Short description"
                                        className="w-full mt-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    />
                                </div>
                            </div>

                            {/* Permissions Matrix */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                        Permissions ({selectedPermIds.length}/{allPermissions.length})
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedPermIds(allPermissions.map(p => p.id))}
                                            className="text-xs text-indigo-500 hover:text-indigo-400 font-bold"
                                        >
                                            Select All
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedPermIds([])}
                                            className="text-xs text-slate-400 hover:text-slate-300 font-bold"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                </div>

                                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 uppercase">
                                                <th className="text-left px-4 py-3 font-bold">Module</th>
                                                <th className="text-center px-3 py-3 font-bold">View</th>
                                                <th className="text-center px-3 py-3 font-bold">Create</th>
                                                <th className="text-center px-3 py-3 font-bold">Edit</th>
                                                <th className="text-center px-3 py-3 font-bold">Delete</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                            {groupedPermissions.map(group => {
                                                const modulePermIds = group.permissions.map(p => p.id);
                                                const allChecked = modulePermIds.every(id => selectedPermIds.includes(id));
                                                const someChecked = modulePermIds.some(id => selectedPermIds.includes(id));

                                                return (
                                                    <tr key={group.module} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={allChecked}
                                                                    ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                                                                    onChange={() => toggleModule(group.module)}
                                                                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 dark:border-slate-600"
                                                                />
                                                                <span className="font-bold text-slate-900 dark:text-white text-xs">
                                                                    {group.module}
                                                                </span>
                                                            </label>
                                                        </td>
                                                        {['VIEW', 'CREATE', 'EDIT', 'DELETE'].map(action => {
                                                            const perm = group.permissions.find(p => p.action === action);
                                                            if (!perm) return <td key={action} className="text-center px-3 py-3"><span className="text-slate-300 dark:text-slate-600">—</span></td>;
                                                            return (
                                                                <td key={action} className="text-center px-3 py-3">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedPermIds.includes(perm.id)}
                                                                        onChange={() => togglePermission(perm.id)}
                                                                        className="w-4 h-4 rounded text-indigo-600 border-slate-300 dark:border-slate-600 cursor-pointer"
                                                                    />
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditOpen(false)}
                                    className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-white font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg"
                                >
                                    {editingRole ? 'Save Changes' : 'Create Role'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
