"use client";

import React, { useState, useEffect } from "react";
import { authenticatedFetch } from "@/lib/api-client";
import { PackageOpen, Truck, Loader2 } from "lucide-react";

export default function InventorySettings() {
    const [settings, setSettings] = useState({
        INVENTORY_GRN_MANDATORY: false,
        INVENTORY_DO_MANDATORY: false
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await authenticatedFetch("/api/settings/inventory");
            const json = await res.json();
            if (json.success) {
                setSettings({
                    INVENTORY_GRN_MANDATORY: json.data.INVENTORY_GRN_MANDATORY === 'true',
                    INVENTORY_DO_MANDATORY: json.data.INVENTORY_DO_MANDATORY === 'true'
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (key: string, value: boolean) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        setSaving(true);

        try {
            await authenticatedFetch("/api/settings/inventory", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    INVENTORY_GRN_MANDATORY: newSettings.INVENTORY_GRN_MANDATORY,
                    INVENTORY_DO_MANDATORY: newSettings.INVENTORY_DO_MANDATORY
                })
            });
        } catch (error) {
            console.error("Failed to save setting:", error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4 animate-in fade-in duration-500">
                <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full"></div>
                    <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin relative z-10" />
                </div>
                <p className="text-sm font-bold text-slate-500 animate-pulse uppercase tracking-widest">Loading Settings...</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Purchase & Sales Workflows</h3>
                <p className="text-sm font-bold text-slate-400 mt-1">Configure mandatory document requirements for inventory transactions</p>
            </div>

            <div className="space-y-6">
                {/* GRN Toggle */}
                <div className="flex items-start justify-between p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group">
                    <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover:scale-110 group-hover:border-indigo-300 transition-all">
                                <PackageOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <p className="font-black text-lg text-slate-900 dark:text-white">Mandatory GRN (Goods Received Note)</p>
                        </div>
                        <p className="text-sm font-medium text-slate-500 ml-13 pl-13">
                            When enabled, Purchase Invoices can only be created from a GRN.
                            <br />
                            When disabled, you can create Purchase Invoices directly from Purchase Orders.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={settings.INVENTORY_GRN_MANDATORY}
                            onChange={(e) => handleToggle('INVENTORY_GRN_MANDATORY', e.target.checked)}
                            disabled={saving}
                        />
                        <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                    </label>
                </div>

                {/* DO Toggle */}
                <div className="flex items-start justify-between p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group">
                    <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover:scale-110 group-hover:border-indigo-300 transition-all">
                                <Truck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <p className="font-black text-lg text-slate-900 dark:text-white">Mandatory DO (Delivery Order)</p>
                        </div>
                        <p className="text-sm font-medium text-slate-500 ml-13 pl-13">
                            When enabled, Sales Invoices can only be created from a Delivery Order.
                            <br />
                            When disabled, you can create Sales Invoices directly from Sales Orders.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={settings.INVENTORY_DO_MANDATORY}
                            onChange={(e) => handleToggle('INVENTORY_DO_MANDATORY', e.target.checked)}
                            disabled={saving}
                        />
                        <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>

            {saving && (
                <div className="mt-6 flex items-center justify-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-black text-sm uppercase tracking-widest">Saving Preferences...</span>
                </div>
            )}
        </div>
    );
}
