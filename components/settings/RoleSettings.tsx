"use client";

import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';
import { useCompany } from '@/context/CompanyContext';

interface UserPermission {
    module: string;
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    canViewFinance: boolean;
}

interface UserAccess {
    id: string;
    fullName: string | null;
    email: string;
    companyRole: string;
    isSuperAdmin: boolean;
    permissions: UserPermission[];
}

const MODULES = [
    { id: 'chart-of-accounts', label: 'Chart of Accounts', type: 'main' },
    
    { id: 'vouchers', label: 'Vouchers', type: 'main', isParent: true },
    { id: 'vouchers.journal', label: '↳ Journal', type: 'sub' },
    { id: 'vouchers.payment', label: '↳ Payment', type: 'sub' },
    { id: 'vouchers.receipt', label: '↳ Receipt', type: 'sub' },
  
    { id: 'purchase', label: 'Purchase', type: 'main', isParent: true },
    { id: 'purchase.orders', label: '↳ Orders', type: 'sub' },
    { id: 'purchase.grn', label: '↳ GRN', type: 'sub' },
    { id: 'purchase.invoices', label: '↳ Invoices', type: 'sub' },
    { id: 'purchase.returns', label: '↳ Returns', type: 'sub' },
  
    { id: 'sales', label: 'Sales', type: 'main', isParent: true },
    { id: 'sales.orders', label: '↳ Orders', type: 'sub' },
    { id: 'sales.delivery-notes', label: '↳ Delivery Notes', type: 'sub' },
    { id: 'sales.invoices', label: '↳ Invoices', type: 'sub' },
    { id: 'sales.returns', label: '↳ Returns', type: 'sub' },
  
    { id: 'inventory', label: 'Inventory', type: 'main', isParent: true },
    { id: 'inventory.products', label: '↳ Products', type: 'sub' },
    { id: 'inventory.categories', label: '↳ Categories', type: 'sub' },
    { id: 'inventory.warehouses', label: '↳ Warehouses', type: 'sub' },
  
    { id: 'reports', label: 'Reports (All)', type: 'main', readOnly: true },
    
    { id: 'settings', label: 'Settings', type: 'main', isParent: true, adminOnly: true },
    { id: 'settings.companies', label: '↳ Companies', type: 'sub', superAdminOnly: true },
    { id: 'settings.users', label: '↳ Users', type: 'sub', superAdminOnly: true },
    { id: 'settings.access-control', label: '↳ Access Control', type: 'sub', superAdminOnly: true },
    { id: 'settings.backup', label: '↳ Backup & Restore', type: 'sub', superAdminOnly: true },
];

export default function UserAccessPlugboard() {
    const { showNotification } = useNotifications();
    const { activeCompany } = useCompany();
    
    const [users, setUsers] = useState<UserAccess[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [togglingMap, setTogglingMap] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!activeCompany) return;
        const fetchUsers = async () => {
            try {
                setLoading(true);
                const res = await authenticatedFetch(`/api/admin/user-permissions?companyId=${activeCompany.id}`);
                const data = await res.json();
                if (data.success) {
                    setUsers(data.data.users);
                    if (data.data.users.length > 0 && !selectedUserId) {
                        setSelectedUserId(data.data.users[0].id);
                    }
                }
            } catch {
                showNotification('error', 'Failed to load user permissions');
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, [activeCompany]);

    const handleToggle = async (userId: string, module: string, action: 'read' | 'write' | 'delete' | 'finance', currentValue: boolean) => {
        const toggleKey = `${userId}-${module}-${action}`;
        setTogglingMap(prev => ({ ...prev, [toggleKey]: true }));
        
        try {
            const res = await authenticatedFetch('/api/admin/user-permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: activeCompany?.id,
                    userId,
                    module,
                    action,
                    value: !currentValue
                })
            });
            const data = await res.json();
            if (data.success) {
                setUsers(prev => prev.map(u => {
                    if (u.id === userId) {
                        const existingPermIndex = u.permissions.findIndex(p => p.module === module);
                        const updatedPerms = [...u.permissions];
                        if (existingPermIndex >= 0) {
                            updatedPerms[existingPermIndex] = {
                                ...updatedPerms[existingPermIndex],
                                [action === 'read' ? 'canRead' : action === 'write' ? 'canWrite' : action === 'delete' ? 'canDelete' : 'canViewFinance']: !currentValue
                            };
                        } else {
                            updatedPerms.push({
                                module,
                                canRead: action === 'read' ? !currentValue : false,
                                canWrite: action === 'write' ? !currentValue : false,
                                canDelete: action === 'delete' ? !currentValue : false,
                                canViewFinance: action === 'finance' ? !currentValue : false,
                            });
                        }
                        return { ...u, permissions: updatedPerms };
                    }
                    return u;
                }));
            } else {
                showNotification('error', data.error);
            }
        } catch {
            showNotification('error', 'Update failed');
        } finally {
            setTogglingMap(prev => ({ ...prev, [toggleKey]: false }));
        }
    };

    const selectedUser = users.find(u => u.id === selectedUserId);

    if (loading) return <div className="text-center py-12 text-slate-500">Loading plugboard...</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Access Control Plugboard</h2>
                <p className="text-sm font-bold text-slate-400 mt-1">
                    Manage direct granular permissions for each user.
                </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 bg-slate-50 dark:bg-slate-950 p-1 rounded-[2rem] border border-slate-200 dark:border-slate-800">
                
                {/* Left Sidebar - Users List */}
                <div className="w-full lg:w-72 flex-shrink-0 bg-white dark:bg-slate-900 rounded-[1.8rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[700px]">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Users</h3>
                    </div>
                    <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {users.map(user => (
                            <button
                                key={user.id}
                                onClick={() => setSelectedUserId(user.id)}
                                className={`w-full text-left p-3 rounded-xl transition-all ${
                                    selectedUserId === user.id 
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                            >
                                <div className="font-bold truncate">{user.fullName || 'No Name'}</div>
                                <div className={`text-[10px] mt-0.5 uppercase font-black tracking-widest ${
                                    selectedUserId === user.id ? 'text-indigo-200' : 'text-slate-400'
                                }`}>
                                    {user.isSuperAdmin ? 'SUPER ADMIN' : user.companyRole}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right Area - Modules Matrix */}
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-[1.8rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[700px]">
                    {selectedUser ? (
                        <>
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{selectedUser.fullName}'s Permissions</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Configure module access</p>
                                </div>
                                {selectedUser.isSuperAdmin && (
                                    <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest">
                                        Super Admin (Full Access)
                                    </span>
                                )}
                            </div>
                            
                            <div className="overflow-y-auto custom-scrollbar flex-1">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white dark:bg-slate-900 sticky top-0 z-10 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                                        <tr>
                                            <th className="px-6 py-4">Module Identity</th>
                                            <th className="px-4 py-4 text-center">Read / View</th>
                                            <th className="px-4 py-4 text-center">Write / Mod</th>
                                            <th className="px-4 py-4 text-center">Drop / Purge</th>
                                            <th className="px-4 py-4 text-center">Financials</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                        {MODULES.map(mod => {
                                            const perm = selectedUser.permissions.find(p => p.module === mod.id) || { canRead: false, canWrite: false, canDelete: false, canViewFinance: false };
                                            
                                            // Handle disabled states based on module type and user role
                                            const isSuperAdminOnly = mod.superAdminOnly && !selectedUser.isSuperAdmin;
                                            const disabled = selectedUser.isSuperAdmin || isSuperAdminOnly;

                                            return (
                                                <tr key={mod.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${mod.type === 'main' ? 'bg-slate-50/30 dark:bg-slate-800/10' : ''}`}>
                                                    <td className={`px-6 py-3 font-bold ${mod.type === 'main' ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                                                        {mod.label}
                                                    </td>
                                                    
                                                    {/* Read Toggle */}
                                                    <td className="px-4 py-3 text-center">
                                                        <Toggle 
                                                            active={perm.canRead || selectedUser.isSuperAdmin} 
                                                            onChange={() => handleToggle(selectedUser.id, mod.id, 'read', perm.canRead)} 
                                                            loading={togglingMap[`${selectedUser.id}-${mod.id}-read`]}
                                                            disabled={disabled}
                                                            color="emerald"
                                                        />
                                                    </td>

                                                    {/* Write Toggle */}
                                                    <td className="px-4 py-3 text-center">
                                                        {!mod.readOnly && !mod.isParent ? (
                                                            <Toggle 
                                                                active={perm.canWrite || selectedUser.isSuperAdmin} 
                                                                onChange={() => handleToggle(selectedUser.id, mod.id, 'write', perm.canWrite)} 
                                                                loading={togglingMap[`${selectedUser.id}-${mod.id}-write`]}
                                                                disabled={disabled}
                                                                color="indigo"
                                                            />
                                                        ) : <span className="text-slate-300 dark:text-slate-700">-</span>}
                                                    </td>

                                                    {/* Delete Toggle */}
                                                    <td className="px-4 py-3 text-center">
                                                        {!mod.readOnly && !mod.isParent ? (
                                                            <Toggle 
                                                                active={perm.canDelete || selectedUser.isSuperAdmin} 
                                                                onChange={() => handleToggle(selectedUser.id, mod.id, 'delete', perm.canDelete)} 
                                                                loading={togglingMap[`${selectedUser.id}-${mod.id}-delete`]}
                                                                disabled={disabled}
                                                                color="rose"
                                                            />
                                                        ) : <span className="text-slate-300 dark:text-slate-700">-</span>}
                                                    </td>

                                                    {/* Finance Toggle */}
                                                    <td className="px-4 py-3 text-center">
                                                        {!mod.readOnly && !mod.isParent ? (
                                                            <Toggle 
                                                                active={perm.canViewFinance || selectedUser.isSuperAdmin} 
                                                                onChange={() => handleToggle(selectedUser.id, mod.id, 'finance', perm.canViewFinance)} 
                                                                loading={togglingMap[`${selectedUser.id}-${mod.id}-finance`]}
                                                                disabled={disabled}
                                                                color="amber"
                                                            />
                                                        ) : <span className="text-slate-300 dark:text-slate-700">-</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <svg className="w-12 h-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <p className="font-bold uppercase tracking-widest text-xs">Select a user to view permissions</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Reusable Toggle Component
function Toggle({ active, onChange, loading, disabled, color }: { active: boolean, onChange: () => void, loading?: boolean, disabled?: boolean, color: 'emerald' | 'indigo' | 'rose' | 'amber' }) {
    
    let colorClasses = 'bg-slate-200 dark:bg-slate-800';
    if (active) {
        if (color === 'emerald') colorClasses = 'bg-emerald-500';
        if (color === 'indigo') colorClasses = 'bg-indigo-500';
        if (color === 'rose') colorClasses = 'bg-rose-500';
        if (color === 'amber') colorClasses = 'bg-amber-500';
    }

    return (
        <button
            type="button"
            disabled={disabled || loading}
            onClick={onChange}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${colorClasses} ${(disabled || loading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'}`}
        >
            <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    active ? 'translate-x-4.5' : 'translate-x-1'
                } ${loading ? 'animate-pulse' : ''}`}
            />
        </button>
    );
}
