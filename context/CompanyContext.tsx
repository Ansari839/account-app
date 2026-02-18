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
    /** Switch to a different company */
    switchCompany: (companyId: string) => void;
    /** Set the companies list (called after login) */
    setCompanies: (companies: CompanyInfo[]) => void;
    /** Whether a company is selected */
    isCompanySelected: boolean;
    /** Clear company context (logout) */
    clearCompany: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const STORAGE_KEY_COMPANY = 'activeCompanyId';
const STORAGE_KEY_COMPANIES = 'companies';

export function CompanyProvider({ children }: { children: React.ReactNode }) {
    const [activeCompany, setActiveCompany] = useState<CompanyInfo | null>(null);
    const [companies, setCompaniesState] = useState<CompanyInfo[]>([]);

    // Hydrate from localStorage on mount
    useEffect(() => {
        try {
            const savedCompanies = localStorage.getItem(STORAGE_KEY_COMPANIES);
            const savedCompanyId = localStorage.getItem(STORAGE_KEY_COMPANY);

            if (savedCompanies) {
                const parsed: CompanyInfo[] = JSON.parse(savedCompanies);
                setCompaniesState(parsed);

                if (savedCompanyId) {
                    const found = parsed.find(c => c.id === savedCompanyId);
                    if (found) setActiveCompany(found);
                }
            }
        } catch {
            // Corrupted data, ignore
        }
    }, []);

    const setCompanies = useCallback((newCompanies: CompanyInfo[]) => {
        setCompaniesState(newCompanies);
        localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(newCompanies));

        // Auto-select if only one company or has a default
        if (newCompanies.length === 1) {
            setActiveCompany(newCompanies[0]);
            localStorage.setItem(STORAGE_KEY_COMPANY, newCompanies[0].id);
        } else {
            const defaultCompany = newCompanies.find(c => c.isDefault);
            if (defaultCompany) {
                setActiveCompany(defaultCompany);
                localStorage.setItem(STORAGE_KEY_COMPANY, defaultCompany.id);
            }
        }
    }, []);

    const switchCompany = useCallback((companyId: string) => {
        const found = companies.find(c => c.id === companyId);
        if (found) {
            setActiveCompany(found);
            localStorage.setItem(STORAGE_KEY_COMPANY, companyId);
        }
    }, [companies]);

    const clearCompany = useCallback(() => {
        setActiveCompany(null);
        setCompaniesState([]);
        localStorage.removeItem(STORAGE_KEY_COMPANY);
        localStorage.removeItem(STORAGE_KEY_COMPANIES);
    }, []);

    return (
        <CompanyContext.Provider value={{
            activeCompany,
            companies,
            activeRole: activeCompany?.role || null,
            switchCompany,
            setCompanies,
            isCompanySelected: !!activeCompany,
            clearCompany,
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
