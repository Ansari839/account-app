"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany, CompanyInfo } from '@/context/CompanyContext';

export default function SelectCompanyPage() {
    const router = useRouter();
    const { companies, setCompanies, switchCompany, activeCompany } = useCompany();
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load companies from localStorage if context is empty
        const stored = localStorage.getItem('companies');
        if (stored) {
            try {
                const parsed: CompanyInfo[] = JSON.parse(stored);
                if (parsed.length > 0) {
                    setCompanies(parsed);
                }
            } catch {
                router.push('/auth/login');
            }
        }
        setIsLoading(false);
    }, []);

    // Redirect if only one company (auto-selected by context)
    useEffect(() => {
        if (!isLoading && companies.length === 1 && activeCompany) {
            router.push('/finance/dashboard');
        }
    }, [isLoading, companies, activeCompany, router]);

    // Redirect to login if no companies
    useEffect(() => {
        if (!isLoading && companies.length === 0) {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/auth/login');
            }
        }
    }, [isLoading, companies, router]);

    const handleSelectCompany = (company: CompanyInfo) => {
        switchCompany(company.id);
        router.push('/finance/dashboard');
    };

    if (isLoading || companies.length <= 1) {
        return (
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-slate-400 font-medium">Loading...</span>
                </div>
            </div>
        );
    }

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'OWNER': return 'from-amber-500 to-orange-600';
            case 'ADMIN': return 'from-indigo-500 to-purple-600';
            default: return 'from-emerald-500 to-teal-600';
        }
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'OWNER': return '👑 Owner';
            case 'ADMIN': return '🔧 Admin';
            default: return '👤 User';
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background */}
            <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[150px]" />
            <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[150px]" />

            <div className="w-full max-w-2xl relative z-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-indigo-500/30 mb-5 rotate-12 hover:rotate-0 transition-transform duration-500">
                        <span className="text-2xl font-black text-white">A</span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Select Company</h1>
                    <p className="text-slate-400 mt-2">Choose a company to continue to your dashboard</p>
                </div>

                {/* Company Cards Grid */}
                <div className="grid gap-4">
                    {companies.map((company) => (
                        <button
                            key={company.id}
                            onClick={() => handleSelectCompany(company)}
                            onMouseEnter={() => setHoveredId(company.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            className={`
                                w-full text-left p-5 rounded-2xl border transition-all duration-300 group
                                ${hoveredId === company.id
                                    ? 'bg-white/10 border-indigo-500/50 scale-[1.02] shadow-xl shadow-indigo-500/10'
                                    : 'bg-white/5 border-white/10 hover:bg-white/8'
                                }
                            `}
                        >
                            <div className="flex items-center gap-4">
                                {/* Company Icon */}
                                <div className={`
                                    w-14 h-14 rounded-xl bg-gradient-to-tr ${getRoleColor(company.role)}
                                    flex items-center justify-center shadow-lg flex-shrink-0
                                    transition-transform group-hover:scale-110
                                `}>
                                    {company.logo ? (
                                        <img src={company.logo} alt="" className="w-8 h-8 rounded-lg object-cover" />
                                    ) : (
                                        <span className="text-xl font-bold text-white">
                                            {company.name.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>

                                {/* Company Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-white truncate">
                                        {company.name}
                                    </h3>
                                    {company.email && (
                                        <p className="text-sm text-slate-400 truncate">{company.email}</p>
                                    )}
                                </div>

                                {/* Role Badge + Arrow */}
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className={`
                                        text-xs font-bold px-3 py-1.5 rounded-full bg-gradient-to-r ${getRoleColor(company.role)}
                                        text-white shadow-sm
                                    `}>
                                        {getRoleBadge(company.role)}
                                    </span>
                                    <span className={`
                                        text-slate-500 transition-all duration-300
                                        ${hoveredId === company.id ? 'translate-x-1 text-indigo-400' : ''}
                                    `}>
                                        →
                                    </span>
                                </div>
                            </div>

                            {company.isDefault && (
                                <div className="mt-2 ml-[72px]">
                                    <span className="text-xs text-indigo-400 font-medium">
                                        ★ Default Company
                                    </span>
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Logout Link */}
                <div className="text-center mt-6">
                    <button
                        onClick={() => {
                            localStorage.clear();
                            router.push('/auth/login');
                        }}
                        className="text-slate-500 hover:text-white text-sm font-medium transition-colors"
                    >
                        ← Sign out and switch account
                    </button>
                </div>
            </div>
        </div>
    );
}
