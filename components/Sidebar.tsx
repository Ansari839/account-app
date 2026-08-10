"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Folders, FileText, ShoppingCart, TrendingUp, Package,
    ScrollText, Settings, ChevronDown, Menu, X, LogOut, Building2, Users,
    Lock, Database
} from 'lucide-react';
import CompanySwitcher from './CompanySwitcher';
import { useCompany } from '@/context/CompanyContext';
import { SIDEBAR_PERMISSION_MAP } from '@/lib/permissions';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// Menu items — each has an optional `permissionKey` (module ID
// stored in UserPermission.module).  Items WITHOUT a permissionKey
// are always shown to any authenticated user.
// ─────────────────────────────────────────────────────────────
const menuItems = [
    { name: 'Dashboard',        icon: LayoutDashboard, path: '/finance/dashboard'  },          // always visible
    { name: 'Chart of Accounts', icon: Folders,        path: '/finance/coa',        permissionKey: 'chart-of-accounts' },
    { name: 'Vouchers',         icon: FileText,        path: '/finance/vouchers',   permissionKey: 'vouchers',
      sub: ['Journal', 'Payment', 'Receipt'] },
    { name: 'Purchase',         icon: ShoppingCart,    path: '/finance/purchase',   permissionKey: 'purchase',
      sub: ['orders', 'grn', 'invoices', 'returns'] },
    { name: 'Sales',            icon: TrendingUp,      path: '/finance/sales',      permissionKey: 'sales',
      sub: ['orders', 'delivery-notes', 'invoices', 'returns'] },
    { name: 'Inventory',        icon: Package,         path: '/inventory',          permissionKey: 'inventory',
      sub: ['Products', 'Categories', 'Warehouses'] },
    { name: 'Reports',          icon: ScrollText,      path: '/finance/reports',    permissionKey: 'reports',
      sub: ['trial-balance', 'profit-loss', 'balance-sheet', 'ledger', 'inventory', 'sales', 'purchase'] },
    // Settings: visible to CompanyAdmin/SuperAdmin only (handled separately)
    { name: 'Settings',         icon: Settings,        path: '/admin/settings',     adminOnly: true },
];

const adminItems = [
    { name: 'Companies', icon: Building2, path: '/admin/companies' },
    { name: 'Users', icon: Users, path: '/admin/users' },
    { name: 'Access Control', icon: Lock, path: '/admin/rbac' },
    { name: 'Backup & Restore', icon: Database, path: '/admin/backup' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [user, setUser] = useState<{ fullName: string; email: string; isSuperAdmin?: boolean } | null>(null);
    const { canAccess, permissionsRefreshing, activeCompany, permissionsLoaded, clearCompany } = useCompany();

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try { setUser(JSON.parse(userStr)); }
            catch (e) { console.error('Failed to parse user', e); }
        }
    }, []);

    const logout = async () => {
        try {
            const token = localStorage.getItem('token');
            // Clear API session cookie
            await fetch('/api/auth/clear-session', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
            await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        } catch (e) {
            console.error('Logout error', e);
        }
        
        clearCompany(); // Reset CompanyContext state
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
        window.location.href = '/auth/login';
    };

    const isSuperAdmin   = !!user?.isSuperAdmin;
    const isCompanyAdmin = activeCompany?.role === 'ADMIN' || activeCompany?.role === 'OWNER';
    const hasFullAccess  = isSuperAdmin || isCompanyAdmin;

    // canSeeModule delegates to context's canAccess (which implements all RBAC rules)
    const canSeeModule = (moduleKey: string) => canAccess(moduleKey, 'VIEW');

    const visibleMenuItems = menuItems.filter((item: any) => {
        if (item.adminOnly)      return hasFullAccess;   // Settings — admin only
        if (!item.permissionKey) return true;            // Dashboard — always visible
        return canSeeModule(item.permissionKey);
    });

    return (
        <aside
            className={cn(
                "h-screen bg-[#0B1120] text-slate-300 transition-all duration-300 ease-in-out border-r border-slate-800/80 flex flex-col sticky top-0 z-50",
                isCollapsed ? "w-20" : "w-64"
            )}
        >
            {/* Logo Section */}
            <div className="p-6 flex items-center justify-between border-b border-slate-800/50">
                {!isCollapsed && (
                    <div className="flex items-center gap-3 animate-in fade-in duration-500">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
                            A
                        </div>
                        <span className="font-bold text-xl tracking-tight text-white">
                            Antigravity
                        </span>
                    </div>
                )}
                {isCollapsed && (
                    <div className="mx-auto w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
                        A
                    </div>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {isCollapsed ? <Menu size={20} /> : <X size={20} />}
                </button>
            </div>

            {/* Company Switcher */}
            <div className="px-4 mt-4">
                <CompanySwitcher isCollapsed={isCollapsed} />
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
                {/* Loading skeleton while permissions first load */}
                {!permissionsLoaded && (
                    <div className="space-y-1.5 animate-pulse">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-10 rounded-xl bg-slate-800/60" style={{ opacity: 1 - i * 0.15 }} />
                        ))}
                    </div>
                )}
                {permissionsLoaded && visibleMenuItems.map((item) => {
                    const isActive = pathname.startsWith(item.path);
                    const Icon = item.icon;

                    return (
                        <div key={item.name} className="space-y-1">
                            <Link
                                href={item.path}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                                    isActive
                                        ? "bg-indigo-500/10 text-indigo-400 font-medium"
                                        : "hover:bg-slate-800/50 hover:text-white"
                                )}
                            >
                                <Icon size={22} className={cn(
                                    "transition-colors",
                                    isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-indigo-400"
                                )} />

                                {!isCollapsed && (
                                    <span className="flex-1 truncate">{item.name}</span>
                                )}

                                {!isCollapsed && item.sub && (
                                    <ChevronDown size={14} className={cn(
                                        "transition-transform duration-200 opacity-40",
                                        isActive && "rotate-180 opacity-100"
                                    )} />
                                )}

                                {isActive && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full" />
                                )}
                            </Link>

                            {/* Sub-menu rendering */}
                            {!isCollapsed && item.sub && isActive && (
                                <div className="ml-9 border-l border-slate-700/50 space-y-1 py-1 animate-in slide-in-from-top-1 duration-200">
                                    {item.sub.map((sub) => {
                                        // Check permission for this specific sub-module
                                        // e.g. parent is 'purchase', sub is 'orders' => module is 'purchase.orders'
                                        // Note: For 'vouchers', the sub might be 'Journal', so we lowercase it.
                                        const parentModule = SIDEBAR_PERMISSION_MAP[item.name];
                                        const subModuleKey = parentModule ? `${parentModule}.${sub.toLowerCase()}` : '';
                                        
                                        // Only show if SuperAdmin, or if the user has VIEW access to this specific sub-module.
                                        // Wait, hasPermission will return true if they have 'purchase.VIEW' or 'purchase.orders.VIEW'.
                                        const hasSubAccess = isSuperAdmin || !subModuleKey || canSeeModule(subModuleKey);
                                        
                                        if (!hasSubAccess) return null;

                                        const subPath = `${item.path}/${sub.toLowerCase()}`;
                                        const isSubActive = pathname === subPath;
                                        return (
                                            <Link
                                                key={sub}
                                                href={subPath}
                                                className={cn(
                                                    "block px-4 py-2 text-sm rounded-md transition-colors",
                                                    isSubActive
                                                        ? "text-indigo-400 font-medium bg-indigo-500/10"
                                                        : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                                                )}
                                            >
                                                {sub.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Admin Section */}
                {isSuperAdmin && (
                    <div className="pt-6 mt-6 border-t border-slate-800/80">
                        {!isCollapsed && (
                            <h3 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                                Administrator
                            </h3>
                        )}
                        {adminItems.map((item) => {
                            const isActive = pathname.startsWith(item.path);
                            const Icon = item.icon;

                            return (
                                <Link
                                    key={item.name}
                                    href={item.path}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                                        isActive
                                            ? "bg-rose-500/10 text-rose-500 font-medium"
                                            : "hover:bg-slate-800/50 hover:text-white"
                                    )}
                                >
                                    <Icon size={22} className={cn(
                                        "transition-colors",
                                        isActive ? "text-rose-500" : "text-slate-400 group-hover:text-white"
                                    )} />
                                    {!isCollapsed && (
                                        <span className="flex-1 truncate">{item.name}</span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </nav>

            {/* User Block */}
            <div className="p-4 border-t border-slate-800/80 bg-[#0B1120]">
                <div className={cn(
                    "flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800 group cursor-pointer transition-all duration-200",
                    isCollapsed && "justify-center"
                )}>
                    <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold shadow-inner group-hover:border-indigo-500/50 group-hover:text-indigo-400 transition-colors">
                        {user?.fullName?.charAt(0) || 'U'}
                    </div>

                    {!isCollapsed && (
                        <div className="flex-1 min-w-0" onClick={logout}>
                            <p className="text-sm font-semibold truncate group-hover:text-white text-slate-200">
                                {user?.fullName || 'User'}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1 group-hover:text-rose-500 transition-colors">
                                <LogOut size={10} /> Logout
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
