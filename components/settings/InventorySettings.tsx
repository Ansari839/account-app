"use client";

import React, { useState, useEffect } from "react";
import { authenticatedFetch } from "@/lib/api-client";

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
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Purchase & Sales Workflows</h2>
                <p className="text-sm text-slate-500 mt-1">Configure mandatory document requirements for inventory transactions</p>
            </div>

            <div className="space-y-6">
                {/* GRN Toggle */}
                <div className="flex items-start justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">📦</span>
                            <p className="font-semibold text-slate-900 dark:text-white">Mandatory GRN (Goods Received Note)</p>
                        </div>
                        <p className="text-sm text-slate-500 ml-7">
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
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>

                {/* DO Toggle */}
                <div className="flex items-start justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">🚚</span>
                            <p className="font-semibold text-slate-900 dark:text-white">Mandatory DO (Delivery Order)</p>
                        </div>
                        <p className="text-sm text-slate-500 ml-7">
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
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>

            {saving && (
                <div className="mt-4 text-sm text-indigo-600 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                    Saving...
                </div>
            )}
        </div>
    );
}
