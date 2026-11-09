"use client";

import React from 'react';
import MainLayout from '@/components/MainLayout';
import RoleSettings from '@/components/settings/RoleSettings';
import { ShieldCheck } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';

export default function RBACPage() {
    const { activeCompany } = useCompany();

    return (
        <MainLayout>
            <div className="max-w-[90rem] mx-auto space-y-8 animate-in fade-in duration-700 pb-32 p-6">
                {/* Header */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden border border-slate-800 flex flex-col md:flex-row justify-between md:items-center gap-6">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    <div className="relative z-10 space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-wider uppercase">
                            <ShieldCheck size={14} className="animate-pulse" /> Access Control & RBAC
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight">
                            User Permissions Plugboard
                        </h1>
                        <p className="text-slate-400 text-sm max-w-xl">
                            {activeCompany 
                                ? `Manage fine-grained module permissions and capabilities for ${activeCompany.name}.` 
                                : 'Select a company to manage user access and permissions.'}
                        </p>
                    </div>
                </div>

                {/* Plugboard UI */}
                <RoleSettings />
            </div>
        </MainLayout>
    );
}
