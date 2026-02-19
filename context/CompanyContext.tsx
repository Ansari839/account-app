"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
    /** Currently active company */
    activeCompany: CompanyInfo | null;
    /** All companies the user has access to */
    companies: CompanyInfo[];
    /** User's role in the active company */
    activeRole: CompanyRole | null;
    /** User's permission keys, e.g. ["SALES.VIEW", "PURCHASE.CREATE"] */
    permissions: string[];
    /** Check if user has a specific permission */
    hasPermission: (module: string, action?: string) => boolean;
    /** Switch to a different company */
    switchCompany: (companyId: string) => void;
    /** Set the companies list (called after login) */
    setCompanies: (companies: CompanyInfo[]) => void;
    /** Whether a company is selected */
    isCompanySelected: boolean;
    /** Clear company context (logout) */
    clearCompany: () => void;
    /** Whether permissions have loaded */
    permissionsLoaded: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const STORAGE_KEY_COMPANY = 'activeCompanyId';
const STORAGE_KEY_COMPANIES = 'companies';
const STORAGE_KEY_PERMISSIONS = 'userPermissions';

export function CompanyProvider({ children }: { children: React.ReactNode }) {
    const [activeCompany, setActiveCompany] = useState<CompanyInfo | null>(null);
    const [companies, setCompaniesState] = useState<CompanyInfo[]>([]);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);

    // Load permissions for a company
    const loadPermissions = useCallback(async (companyId: string) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const res = await fetch(`/api/user/permissions?companyId=${companyId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setPermissions(data.data);
                localStorage.setItem(STORAGE_KEY_PERMISSIONS, JSON.stringify(data.data));
            }
        } catch (error) {
            console.error('Failed to load permissions:', error);
        } finally {
            setPermissionsLoaded(true);
        }
    }, []);

    // Hydrate from localStorage on mount
    useEffect(() => {
        try {
            const savedCompanies = localStorage.getItem(STORAGE_KEY_COMPANIES);
            const savedCompanyId = localStorage.getItem(STORAGE_KEY_COMPANY);
            const savedPermissions = localStorage.getItem(STORAGE_KEY_PERMISSIONS);

            if (savedPermissions) {
                try {
                    setPermissions(JSON.parse(savedPermissions));
                    setPermissionsLoaded(true);
                } catch {
                    // ignore
                }
            }

            if (savedCompanies) {
                const parsed: CompanyInfo[] = JSON.parse(savedCompanies);
                setCompaniesState(parsed);

                if (savedCompanyId) {
                    const found = parsed.find(c => c.id === savedCompanyId);
                    if (found) {
                        setActiveCompany(found);
                        // Refresh permissions from API
                        loadPermissions(found.id);
                    }
                }
            }
        } catch {
            // Corrupted data, ignore
        }
    }, [loadPermissions]);

    const setCompanies = useCallback((newCompanies: CompanyInfo[]) => {
        setCompaniesState(newCompanies);
        localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(newCompanies));

        // Auto-select if only one company or has a default
        if (newCompanies.length === 1) {
            setActiveCompany(newCompanies[0]);
            localStorage.setItem(STORAGE_KEY_COMPANY, newCompanies[0].id);
            loadPermissions(newCompanies[0].id);
        } else {
            const defaultCompany = newCompanies.find(c => c.isDefault);
            if (defaultCompany) {
                setActiveCompany(defaultCompany);
                localStorage.setItem(STORAGE_KEY_COMPANY, defaultCompany.id);
                loadPermissions(defaultCompany.id);
            }
        }
    }, [loadPermissions]);

    const switchCompany = useCallback((companyId: string) => {
        const found = companies.find(c => c.id === companyId);
        if (found) {
            setActiveCompany(found);
            localStorage.setItem(STORAGE_KEY_COMPANY, companyId);
            // Reload permissions for the new company
            setPermissionsLoaded(false);
            loadPermissions(companyId);
        }
    }, [companies, loadPermissions]);

    const clearCompany = useCallback(() => {
        setActiveCompany(null);
        setCompaniesState([]);
        setPermissions([]);
        setPermissionsLoaded(false);
        localStorage.removeItem(STORAGE_KEY_COMPANY);
        localStorage.removeItem(STORAGE_KEY_COMPANIES);
        localStorage.removeItem(STORAGE_KEY_PERMISSIONS);
    }, []);

    const hasPermission = useCallback((module: string, action: string = 'VIEW') => {
        // SuperAdmin check — if user is superadmin, allow everything
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user.isSuperAdmin) return true;
            }
        } catch {
            // ignore
        }

        // If permissions haven't loaded yet, allow access to avoid flickering
        if (!permissionsLoaded) return true;

        // If no permissions at all (no roles assigned), deny all
        if (permissions.length === 0) return false;

        return permissions.includes(`${module}.${action}`);
    }, [permissions, permissionsLoaded]);

    return (
        <CompanyContext.Provider value={{
            activeCompany,
            companies,
            activeRole: activeCompany?.role || null,
            permissions,
            hasPermission,
            switchCompany,
            setCompanies,
            isCompanySelected: !!activeCompany,
            clearCompany,
            permissionsLoaded,
        }}>
            {children}
        </CompanyContext.Provider>
    );
}

export const useCompany = () => {
    const context = useContext(CompanyContext);
    if (!context) throw new Error('useCompany must be used within CompanyProvider');
    return context;
};
