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
                            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                                {companies.map((company) => (
                                    <button
                                        key={company.id}
                                        onClick={() => handleSwitch(company.id)}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition-colors ${activeCompany.id === company.id
                                                ? 'text-indigo-400 bg-indigo-500/10'
                                                : 'text-slate-300'
                                            }`}
                                    >
                                        <div className="font-medium truncate">{company.name}</div>
                                        {company.isDefault && <span className="text-[9px] bg-slate-600 px-1 rounded text-white ml-2">Default</span>}
                                    </button>
                                ))}
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
