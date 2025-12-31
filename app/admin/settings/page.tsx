"use client";

import React, { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { useNotifications } from '@/context/NotificationContext';

export default function SettingsPage() {
    const { showNotification } = useNotifications();
    const [settings, setSettings] = useState({
        companyName: 'Antigravity ERP',
        mandatoryGRN: true,
        mandatoryDO: false,
        negativeStock: false,
        currency: 'USD',
    });

    const handleSave = () => {
        showNotification('success', 'Global settings updated successfully');
    };

    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
                    <p className="text-slate-500 mt-1">Configure global rules, branding, and feature toggles.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Company Profile */}
                    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm space-y-6">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <span>🏢</span> Company Profile
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-500">Company Name</label>
                                <input
                                    type="text"
                                    value={settings.companyName}
                                    onChange={e => setSettings({ ...settings, companyName: e.target.value })}
                                    className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold">Corporate Logo</p>
                                    <p className="text-xs text-slate-500">Visible on invoices and reports</p>
                                </div>
                                <button className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:shadow-lg hover:shadow-indigo-500/20 transition-all">
                                    Upload
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Feature Toggles */}
                    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm space-y-6">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <span>⚡</span> Application Rules
                        </h3>
                        <div className="space-y-4">
                            {[
                                { label: 'Mandatory GRN', desc: 'Require GRN before Purchase Invoice', key: 'mandatoryGRN' },
                                { label: 'Mandatory DO', desc: 'Require Delivery Order before Sales Invoice', key: 'mandatoryDO' },
                                { label: 'Allow Negative Stock', desc: 'Warn but allow stock to go below zero', key: 'negativeStock' }
                            ].map(toggle => (
                                <div key={toggle.key} className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-semibold">{toggle.label}</p>
                                        <p className="text-xs text-slate-500">{toggle.desc}</p>
                                    </div>
                                    <button
                                        onClick={() => setSettings({ ...settings, [toggle.key]: !settings[toggle.key as keyof typeof settings] })}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${settings[toggle.key as keyof typeof settings] ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings[toggle.key as keyof typeof settings] ? 'left-7' : 'left-1'}`}></div>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        onClick={handleSave}
                        className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-xl shadow-indigo-500/20 hover:scale-105 transition-all"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </MainLayout>
    );
}
