"use client";

/**
 * CompanyContext — Multi-company RBAC context
 *
 * Rules:
 *   SuperAdmin  → God mode. Sees everything in every company.
 *   ADMIN/OWNER → Full access within their company.
 *   USER        → Only modules explicitly granted in UserPermission table (Plugboard).
 *
 * Design:
 *   Permissions are fetched fresh from /api/user/permissions on every company
 *   load/switch.  We use a "stale-while-revalidate" approach: old permissions are
 *   kept visible while new ones are being fetched so the sidebar never flashes empty.
 *
 *   localStorage is used ONLY for company selection (activeCompanyId, companies list).
 *   Permissions are NEVER cached in localStorage.
 */

import React, {
    createContext, useContext, useState, useEffect,
    useCallback, useRef,
} from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CompanyRole = 'OWNER' | 'ADMIN' | 'USER';

export interface CompanyInfo {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    logo?: string | null;
    role: CompanyRole;
    isDefault: boolean;
}

interface CompanyContextType {
    activeCompany: CompanyInfo | null;
    companies: CompanyInfo[];
    activeRole: CompanyRole | null;
    /** Raw permission keys, e.g. ["chart-of-accounts.VIEW", "vouchers.VIEW"] */
    permissions: string[];
    /** True once first permission fetch for the current company is done */
    permissionsLoaded: boolean;
    /** True while permissions are being re-fetched (company switch) */
    permissionsRefreshing: boolean;
    /** Check if the current user can VIEW (or do `action` on) a module */
    canAccess: (moduleKey: string, action?: 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE') => boolean;
    switchCompany: (companyOrId: string | CompanyInfo) => Promise<void>;
    setCompanies: (companies: CompanyInfo[]) => void;
    isCompanySelected: boolean;
    clearCompany: () => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const LS_COMPANY_ID  = 'activeCompanyId';
const LS_COMPANIES   = 'companies';

// ─── Provider ────────────────────────────────────────────────────────────────

export function CompanyProvider({ children }: { children: React.ReactNode }) {
    const [activeCompany,        setActiveCompany]        = useState<CompanyInfo | null>(null);
    const [companies,            setCompaniesState]        = useState<CompanyInfo[]>([]);
    const [permissions,          setPermissions]           = useState<string[]>([]);
    const [permissionsLoaded,    setPermissionsLoaded]     = useState(false);
    const [permissionsRefreshing,setPermissionsRefreshing] = useState(false);

    // Track the company we last started fetching for (to discard stale responses)
    const fetchingForCompanyId = useRef<string | null>(null);

    // ── Core fetch ─────────────────────────────────────────────────────────

    const fetchPermissions = useCallback(async (company: CompanyInfo) => {
        const { id: companyId, role } = company;

        fetchingForCompanyId.current = companyId;

        if (role === 'ADMIN' || role === 'OWNER') {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token) {
                try {
                    const sessRes = await fetch('/api/auth/company-session', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ companyId: company.id })
                    });
                    if (!sessRes.ok) {
                        alert(`Admin Session API failed: ${sessRes.status}`);
                    }
                } catch (err: any) {
                    alert(`Admin Session API error: ${err.message}`);
                }
            }
            // Only apply if this response is still relevant
            if (fetchingForCompanyId.current === companyId) {
                setPermissions(['ALL_ACCESS']);
                setPermissionsLoaded(true);
                setPermissionsRefreshing(false);
            }
            return;
        }

        // USER → fetch from server
        try {
            const token = typeof window !== 'undefined'
                ? localStorage.getItem('token')
                : null;

            if (!token) {
                if (fetchingForCompanyId.current === companyId) {
                    setPermissions([]);
                    setPermissionsLoaded(true);
                    setPermissionsRefreshing(false);
                }
                return;
            }

            const res  = await fetch(`/api/user/permissions?companyId=${companyId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();

            // Discard if user switched company again while we were fetching
            if (fetchingForCompanyId.current !== companyId) return;

            if (json.success && Array.isArray(json.data)) {
                try {
                    const sessRes = await fetch('/api/auth/company-session', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ companyId: company.id })
                    });
                    
                    if (!sessRes.ok) {
                        const errData = await sessRes.text();
                        alert(`Session API failed: ${sessRes.status} ${errData}`);
                    }
                } catch (err: any) {
                    alert(`Failed to call company-session API: ${err.message}`);
                    console.error('Failed to set company session:', err);
                }

                setPermissions(json.data);
            } else {
                alert(`Permissions API failed: ${JSON.stringify(json)}`);
                console.error('[fetchPermissions] Failed:', json);
                setPermissions([]);
            }
        } catch (err: any) {
            alert(`fetchPermissions error: ${err.message}`);
            console.error('[CompanyContext] fetchPermissions error:', err);
            if (fetchingForCompanyId.current === companyId) {
                setPermissions([]);
            }
        } finally {
            if (fetchingForCompanyId.current === companyId) {
                setPermissionsLoaded(true);
                setPermissionsRefreshing(false);
            }
        }
    }, []);

    // ── Hydrate on mount ───────────────────────────────────────────────────

    useEffect(() => {
        try {
            const rawCompanies = localStorage.getItem(LS_COMPANIES);
            const savedId      = localStorage.getItem(LS_COMPANY_ID);

            if (!rawCompanies) return;

            const parsed: CompanyInfo[] = JSON.parse(rawCompanies);
            setCompaniesState(parsed);

            const found = savedId ? parsed.find(c => c.id === savedId) : null;
            if (found) {
                setActiveCompany(found);
                fetchPermissions(found);
            }
        } catch {
            // corrupt data — ignore
        }
    }, [fetchPermissions]);

    // ── setCompanies (called after login) ─────────────────────────────────

    const setCompanies = useCallback((newCompanies: CompanyInfo[]) => {
        setCompaniesState(newCompanies);
        localStorage.setItem(LS_COMPANIES, JSON.stringify(newCompanies));

        // Auto-select only when there is exactly one company
        if (newCompanies.length === 1) {
            const only = newCompanies[0];
            setActiveCompany(only);
            localStorage.setItem(LS_COMPANY_ID, only.id);
            fetchPermissions(only);
        }
        // For multiple companies: user picks on the select-company page →
        // switchCompany() will be called.
    }, [fetchPermissions]);

    // ── switchCompany ──────────────────────────────────────────────────────

    const switchCompany = useCallback(async (companyOrId: string | CompanyInfo) => {
        let found: CompanyInfo | undefined;
        
        if (typeof companyOrId === 'string') {
            found = companies.find(c => c.id === companyOrId);
        } else {
            found = companyOrId;
        }
        
        if (!found) return;

        // Update active company immediately so the UI shows the new name
        setActiveCompany(found);
        localStorage.setItem(LS_COMPANY_ID, found.id);

        // Mark as refreshing
        setPermissionsRefreshing(true);

        // Fetch fresh permissions for the new company (which also sets the session cookie)
        await fetchPermissions(found);
    }, [companies, fetchPermissions]);

    // ── clearCompany (logout) ──────────────────────────────────────────────

    const clearCompany = useCallback(() => {
        fetchingForCompanyId.current = null;
        setActiveCompany(null);
        setCompaniesState([]);
        setPermissions([]);
        setPermissionsLoaded(false);
        setPermissionsRefreshing(false);
        localStorage.removeItem(LS_COMPANY_ID);
        localStorage.removeItem(LS_COMPANIES);
    }, []);

    // ── canAccess ──────────────────────────────────────────────────────────
    // Central gate for all RBAC checks.

    const canAccess = useCallback((
        moduleKey: string,
        action: 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE' = 'VIEW',
    ): boolean => {
        // 1. SuperAdmin — read from localStorage (set on login, never changes mid-session)
        try {
            const u = localStorage.getItem('user');
            if (u && JSON.parse(u).isSuperAdmin) return true;
        } catch { /* ignore */ }

        // 2. Company Admin/Owner — full access in their company
        const role = activeCompany?.role;
        if (role === 'ADMIN' || role === 'OWNER') return true;

        // 3. ALL_ACCESS flag (set locally for ADMIN/OWNER as extra safety)
        if (permissions.includes('ALL_ACCESS')) return true;

        // 4. Permissions not yet loaded → deny (prevent premature reveals).
        //    We do NOT deny during `permissionsRefreshing` because we show stale
        //    data while new permissions arrive (better UX, no empty flash).
        if (!permissionsLoaded) return false;

        // 5. No permissions assigned → deny
        if (permissions.length === 0) return false;

        // 6. Match: exact "moduleKey.ACTION"  OR  any child "moduleKey.sub.ACTION"
        //    e.g. canAccess('vouchers') → matches 'vouchers.VIEW' or 'vouchers.journal.VIEW'
        const suffix = `.${action}`;
        return permissions.some(p =>
            p === `${moduleKey}${suffix}` ||
            (p.startsWith(`${moduleKey}.`) && p.endsWith(suffix))
        );
    }, [permissions, permissionsLoaded, activeCompany]);

    // ── Context value ──────────────────────────────────────────────────────

    return (
        <CompanyContext.Provider value={{
            activeCompany,
            companies,
            activeRole:           activeCompany?.role ?? null,
            permissions,
            permissionsLoaded,
            permissionsRefreshing,
            canAccess,
            switchCompany,
            setCompanies,
            isCompanySelected:    !!activeCompany,
            clearCompany,
        }}>
            {children}
        </CompanyContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useCompany = () => {
    const ctx = useContext(CompanyContext);
    if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
    return ctx;
};
