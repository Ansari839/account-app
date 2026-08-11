"use client";

import React, { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import CompanySettings from '@/components/settings/CompanySettings';
import UnitSettings from '@/components/settings/UnitSettings';
import CurrencySettings from '@/components/settings/CurrencySettings';
import TaxSettings from '@/components/settings/TaxSettings';
import FiscalYearSettings from '@/components/settings/FiscalYearSettings';
import InventorySettings from '@/components/settings/InventorySettings';
import VoucherSettings from '@/components/settings/VoucherSettings';
import RoleSettings from '@/components/settings/RoleSettings';
import BackupSettings from '@/components/settings/BackupSettings';
import { 
    Building2, 
    Calendar, 
    Scale, 
    Coins, 
    Receipt, 
    Files, 
    Boxes, 
    ShieldCheck, 
    Settings,
    DatabaseBackup
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
    { id: 'company', label: 'Company Info', icon: <Building2 size={18} /> },
    { id: 'fiscal', label: 'Fiscal Years', icon: <Calendar size={18} /> },
    { id: 'units', label: 'Units', icon: <Scale size={18} /> },
    { id: 'currency', label: 'Currency', icon: <Coins size={18} /> },
    { id: 'tax', label: 'Tax Codes', icon: <Receipt size={18} /> },
    { id: 'vouchers', label: 'Vouchers', icon: <Files size={18} /> },
    { id: 'inventory', label: 'Inventory', icon: <Boxes size={18} /> },
    { id: 'roles', label: 'Roles & Access', icon: <ShieldCheck size={18} /> },
    { id: 'backup', label: 'Backup', icon: <DatabaseBackup size={18} /> },
];

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('company');

    return (
        <MainLayout>
            <div className="max-w-[90rem] mx-auto space-y-8 animate-in fade-in duration-700 pb-32">
                
                {/* Premium Hero Header */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden border border-slate-800 flex flex-col md:flex-row justify-between md:items-center gap-6">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">
                            <Settings size={14} />
                            <span className="text-white">Administration</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tight">System Settings</h1>
                        <p className="text-slate-400 font-medium mt-1">Configure global rules, master data, and company profile.</p>
                    </div>
                </div>

                {/* Modern Tab Navigation */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 shadow-sm overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2 min-w-max">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300",
                                    activeTab === tab.id
                                        ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                )}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content Container */}
                <div className="min-h-[500px]">
                    {activeTab === 'company' && <CompanySettings />}
                    {activeTab === 'fiscal' && <FiscalYearSettings />}
                    {activeTab === 'units' && <UnitSettings />}
                    {activeTab === 'currency' && <CurrencySettings />}
                    {activeTab === 'tax' && <TaxSettings />}
                    {activeTab === 'vouchers' && <VoucherSettings />}
                    {activeTab === 'inventory' && <InventorySettings />}
                    {activeTab === 'roles' && <RoleSettings />}
                    {activeTab === 'backup' && <BackupSettings />}
                </div>
            </div>
        </MainLayout>
    );
}
