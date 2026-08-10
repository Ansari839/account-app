"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    ArrowRight,
    LogOut,
    Star,
    Users,
    TrendingUp,
    Building2,
    Crown,
    ShieldCheck,
    User,
    Loader2
} from 'lucide-react';
import { useCompany, CompanyInfo } from '@/context/CompanyContext';
import { cn } from '@/lib/utils';

export default function SelectCompanyPage() {
    const router = useRouter();
    const { companies, setCompanies, switchCompany, activeCompany, permissionsLoaded } = useCompany();
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<Record<string, { sales: number; users: number }>>({});

    useEffect(() => {
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

        const token = localStorage.getItem('token');
        if (token) {
            fetch('/api/user/companies-stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setStats(data.data);
                    }
                })
                .catch(console.error);
        }
    }, []);

    useEffect(() => {
        if (!isLoading && companies.length === 1 && activeCompany && permissionsLoaded) {
            window.location.href = '/finance/dashboard';
        }
    }, [isLoading, companies, activeCompany, permissionsLoaded, router]);

    useEffect(() => {
        if (!isLoading && companies.length === 0) {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/auth/login');
            }
        }
    }, [isLoading, companies, router]);

    const handleSelectCompany = async (company: CompanyInfo) => {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Token is missing from localStorage!');
            return;
        }

        if (companies.length === 0) {
            setCompanies([company]);
        }
        
        try {
            await switchCompany(company); // PASS FULL OBJECT
            window.location.href = '/finance/dashboard';
        } catch (error: any) {
            alert(`Error switching: ${error.message}`);
        }
    };

    if (isLoading || companies.length <= 1) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-muted-foreground font-medium text-sm tracking-widest uppercase">Initializing Console...</span>
            </div>
        );
    }

    const getRoleConfig = (role: string) => {
        switch (role) {
            case 'OWNER': return {
                icon: Crown,
                label: 'Owner',
                color: 'text-amber-500',
                bg: 'bg-amber-500/10'
            };
            case 'ADMIN': return {
                icon: ShieldCheck,
                label: 'Admin',
                color: 'text-primary',
                bg: 'bg-primary/10'
            };
            default: return {
                icon: User,
                label: 'User',
                color: 'text-emerald-500',
                bg: 'bg-emerald-500/10'
            };
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-500">
            {/* Background Aesthetic Orbs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-15%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/20 dark:bg-indigo-500/10 rounded-full blur-[150px] animate-pulse"></div>
                <div className="absolute bottom-[-15%] left-[-10%] w-[60%] h-[60%] bg-fuchsia-500/20 dark:bg-fuchsia-500/10 rounded-full blur-[150px] animate-pulse delay-1000"></div>
            </div>

            <div className="w-full max-w-2xl relative z-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                {/* Header */}
                <div className="text-center mb-10 space-y-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[2rem] mx-auto flex items-center justify-center shadow-2xl shadow-indigo-500/30 mb-6 rotate-12 hover:rotate-0 hover:scale-105 transition-all duration-500">
                        <span className="text-2xl font-black text-white">A</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Select Company</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Choose a workspace to continue to your dashboard</p>
                </div>

                {/* Company Cards Grid */}
                <div className="grid gap-4">
                    {companies.map((company) => {
                        const role = getRoleConfig(company.role);
                        const RoleIcon = role.icon;

                        return (
                            <button
                                key={company.id}
                                onClick={() => handleSelectCompany(company)}
                                onMouseEnter={() => setHoveredId(company.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                className={cn(
                                    "w-full text-left p-6 rounded-3xl border-2 transition-all duration-300 group relative overflow-hidden",
                                    hoveredId === company.id
                                        ? 'bg-white dark:bg-slate-800 border-indigo-500 shadow-xl shadow-indigo-500/20 -translate-y-1 scale-[1.01]'
                                        : 'bg-white/70 dark:bg-slate-900/70 border-transparent hover:border-slate-300 dark:hover:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-none backdrop-blur-md'
                                )}
                            >
                                <div className="flex items-center gap-5 relative z-10">
                                    {/* Company Icon */}
                                    <div className={cn(
                                        "w-16 h-16 rounded-2xl border flex items-center justify-center shadow-sm flex-shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3",
                                        hoveredId === company.id 
                                            ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white border-indigo-400/50"
                                            : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50"
                                    )}>
                                        {company.logo ? (
                                            <img src={company.logo} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                        ) : (
                                            <Building2 size={24} />
                                        )}
                                    </div>

                                    {/* Company Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate transition-colors">
                                                {company.name}
                                            </h3>
                                            {company.isDefault && (
                                                <Star size={14} className="fill-amber-400 text-amber-400 drop-shadow-sm" />
                                            )}
                                        </div>
                                        {company.email && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">{company.email}</p>
                                        )}

                                        {/* Quick Stats */}
                                        <div className="flex gap-5 mt-4">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                                                    <TrendingUp size={14} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Sales</span>
                                                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                                                        {stats[company.id]?.sales ? `$${(stats[company.id].sales / 1000).toFixed(1)}k` : '$12.5k'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                                                    <Users size={14} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Team</span>
                                                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                                                        {stats[company.id]?.users || '5'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Role Badge + Arrow */}
                                    <div className="flex items-center gap-4 flex-shrink-0">
                                        <div className={cn(
                                            "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all",
                                            role.bg,
                                            role.color,
                                            "border-current/20"
                                        )}>
                                            <RoleIcon size={12} />
                                            {role.label}
                                        </div>
                                        <div className={cn(
                                            "w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-500 group-hover:translate-x-1",
                                            hoveredId === company.id 
                                                ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border-indigo-400"
                                                : "bg-transparent text-slate-400 border-slate-200 dark:border-slate-700/50"
                                        )}>
                                            <ArrowRight size={20} />
                                        </div>
                                    </div>
                                </div>

                                {hoveredId === company.id && (
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Logout Link */}
                <div className="text-center mt-10">
                    <button
                        onClick={() => {
                            localStorage.clear();
                            router.push('/auth/login');
                        }}
                        className="group flex items-center gap-2 mx-auto text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs font-bold uppercase tracking-widest transition-all"
                    >
                        <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Sign out and switch account
                    </button>
                </div>
            </div>

            {/* Subtle Footer branding */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-500/30 dark:text-slate-400/30 uppercase tracking-[0.3em] pointer-events-none">
                &copy; Antigravity Accounting 2026
            </div>
        </div>
    );
}
