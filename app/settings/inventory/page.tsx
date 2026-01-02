"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";

export default function InventorySettingsPage() {
    const [settings, setSettings] = useState({
        INVENTORY_GRN_MANDATORY: false,
        INVENTORY_DO_MANDATORY: false
    });
    const [loading, setLoading] = useState(true);

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

        try {
            await authenticatedFetch("/api/settings/inventory", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, value: String(value) })
            });
        } catch (error) {
            console.error("Failed to save setting:", error);
        }
    };

    return (
        <MainLayout>
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">Inventory Settings</h1>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4 border-b pb-2">Purchase & Sales Workflows</h2>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">Mandatory GRN (Goods Received Note)</p>
                                <p className="text-sm text-slate-500">
                                    If enabled, a Purchase Invoice can only be created from a GRN.
                                    <br />If disabled, you can create a PI directly from a Purchase Order.
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.INVENTORY_GRN_MANDATORY}
                                    onChange={(e) => handleToggle('INVENTORY_GRN_MANDATORY', e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">Mandatory DO (Delivery Order)</p>
                                <p className="text-sm text-slate-500">
                                    If enabled, a Sales Invoice can only be created from a Delivery Order.
                                    <br />If disabled, you can create a SI directly from a Sales Order.
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.INVENTORY_DO_MANDATORY}
                                    onChange={(e) => handleToggle('INVENTORY_DO_MANDATORY', e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
