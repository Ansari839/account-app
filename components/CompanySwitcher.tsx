"use client";

import { useCompany } from "@/context/CompanyContext";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CompanySwitcher({ isCollapsed }: { isCollapsed?: boolean }) {
    const { activeCompany, companies, switchCompany } = useCompany();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);

    if (!activeCompany) return null;

    const handleSwitch = (companyId: string) => {
        switchCompany(companyId);
        setIsOpen(false);
        // Force reload to refresh all data with new company context
        window.location.reload();
    };

    if (companies.length <= 1) {
        return (
            <div className={`px-4 py-2 text-sm text-slate-400 ${isCollapsed ? 'hidden' : 'block'}`}>
                <div className="font-semibold text-white truncate">{activeCompany.name}</div>
                <div className="text-xs opacity-70">Current Company</div>
            </div>
        );
    }

    return (
        <div className="relative px-3 mb-4">
            {!isCollapsed ? (
                <div className="relative">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="w-full flex items-center justify-between p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all"
                    >
                        <div className="flex flex-col items-start truncate overflow-hidden">
                            <span className="text-sm font-medium text-white truncate w-full text-left">
                                {activeCompany.name}
                            </span>
                            <span className="text-[10px] text-slate-400">Switch Company</span>
                        </div>
                        <span className="text-slate-400 text-xs ml-2">▼</span>
                    </button>

                    {isOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setIsOpen(false)}
                            />
                            <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl z-20 overflow-hidden ring-1 ring-white/10">
                                <div className="p-2 border-b border-slate-700/50">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-2">Switch Organization</span>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto py-1">
                                    {companies.map((company) => (
                                        <button
                                            key={company.id}
                                            onClick={() => handleSwitch(company.id)}
                                            className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-all ${activeCompany.id === company.id
                                                ? 'bg-indigo-500/10 text-white'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${activeCompany.id === company.id ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                {company.name.substring(0, 1).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate text-sm">{company.name}</div>
                                                <div className="text-[10px] opacity-70 flex items-center gap-2">
                                                    {company.role === 'OWNER' && <span className="text-amber-500">👑 Owner</span>}
                                                    {company.role === 'ADMIN' && <span className="text-purple-400">🔧 Admin</span>}
                                                </div>
                                            </div>
                                            {activeCompany.id === company.id && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <div className="p-2 border-t border-slate-700/50 bg-slate-800/30">
                                    <button
                                        onClick={() => router.push('/auth/select-company')}
                                        className="w-full py-2 text-xs font-medium text-center text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span>View All & Stats</span>
                                        <span>→</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <button
                    onClick={() => {
                        // Expand sidebar temporarily or show tooltip?
                        // For now, simpler: do nothing or just show icon
                    }}
                    title={activeCompany.name}
                    className="w-10 h-10 mx-auto bg-slate-800/50 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-400 border border-indigo-500/30"
                >
                    {activeCompany.name.substring(0, 2).toUpperCase()}
                </button>
            )}
        </div>
    );
}
