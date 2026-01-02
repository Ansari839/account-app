"use client";

import React, { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import CompanySettings from '@/components/settings/CompanySettings';
import UnitSettings from '@/components/settings/UnitSettings';
import CurrencySettings from '@/components/settings/CurrencySettings';
import TaxSettings from '@/components/settings/TaxSettings';
import FiscalYearSettings from '@/components/settings/FiscalYearSettings';
import InventorySettings from '@/components/settings/InventorySettings';

const TABS = [
    { id: 'company', label: 'Company Info', icon: '🏢' },
    { id: 'fiscal', label: 'Fiscal Years', icon: '📅' },
    { id: 'units', label: 'Units', icon: '⚖️' },
    { id: 'currency', label: 'Currency', icon: '💱' },
    { id: 'tax', label: 'Tax Codes', icon: '🧾' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
];

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('company');

    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
                    <p className="text-slate-500 mt-1">Configure global rules, master data, and company profile.</p>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-slate-200 dark:border-slate-800">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl font-bold text-sm transition-all relative top-[1px] ${activeTab === tab.id
                                ? 'bg-white dark:bg-slate-900 border-x border-t border-slate-200 dark:border-slate-800 text-indigo-600'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }`}
                        >
                            <span>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="min-h-[500px]">
                    {activeTab === 'company' && <CompanySettings />}
                    {activeTab === 'fiscal' && <FiscalYearSettings />}
                    {activeTab === 'units' && <UnitSettings />}
                    {activeTab === 'currency' && <CurrencySettings />}
                    {activeTab === 'tax' && <TaxSettings />}
                    {activeTab === 'inventory' && <InventorySettings />}
                </div>
            </div>
        </MainLayout>
    );
}
