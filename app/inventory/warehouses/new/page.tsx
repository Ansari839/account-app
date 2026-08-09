"use client";

import React, { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { 
    Save, 
    ArrowLeft, 
    Warehouse,
    MapPin,
    Barcode,
    CheckCircle2
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

export default function NewWarehousePage() {
    const router = useRouter();
    const { showNotification } = useNotifications();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        address: '',
        isDefault: false
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.code.trim() || !formData.name.trim()) {
            showNotification('error', 'Warehouse Code and Name are required.');
            return;
        }

        setLoading(true);

        try {
            const res = await authenticatedFetch('/api/inventory/warehouses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const json = await res.json();

            if (res.ok && json.success) {
                showNotification('success', 'Warehouse created successfully!');
                router.push('/inventory/warehouses');
            } else {
                showNotification('error', json.error || "Failed to create warehouse");
            }
        } catch (err) {
            showNotification('error', "An error occurred while creating warehouse");
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainLayout>
            <div className="max-w-4xl mx-auto space-y-6 pb-32 animate-in fade-in duration-500">
                {/* Header Action Bar */}
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors font-bold text-sm"
                    >
                        <ArrowLeft size={16} /> Back to Warehouses
                    </button>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                        <Warehouse size={16} className="text-amber-500" /> New Warehouse
                    </div>
                </div>

                {/* Premium Dark Header Card */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl shadow-amber-500/10 relative overflow-hidden border border-slate-800">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h1 className="text-4xl font-black text-white tracking-tight">New Warehouse</h1>
                            <p className="text-slate-400 font-medium mt-1">Set up a new storage location for your inventory</p>
                            
                            <div className="mt-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        <Barcode size={14} /> Warehouse Code <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. WH-01"
                                        className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                                        value={formData.code}
                                        onChange={e => setFormData({ ...formData, code: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        <Warehouse size={14} /> Warehouse Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Main Distribution Center"
                                        className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col justify-end space-y-6">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <MapPin size={14} /> Location / Address
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Enter physical address of the warehouse..."
                                    className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-amber-500 font-medium resize-none"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>

                            <label className={cn(
                                "flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                                formData.isDefault 
                                    ? "bg-amber-500/10 border-amber-500/50 text-amber-500" 
                                    : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600"
                            )}>
                                <div className="flex-1">
                                    <p className="font-bold">Set as Default Warehouse</p>
                                    <p className="text-xs opacity-80 mt-1">Automatically select this warehouse for new transactions</p>
                                </div>
                                <div className="relative flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={formData.isDefault}
                                        onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                                    />
                                    <div className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                                        formData.isDefault ? "bg-amber-500 text-white" : "bg-slate-800 text-transparent"
                                    )}>
                                        <CheckCircle2 size={16} />
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-end gap-4">
                    <div className="flex gap-3 w-full md:w-auto">
                        <button 
                            onClick={() => router.back()}
                            className="flex-1 md:flex-none px-6 py-4 rounded-2xl font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors uppercase tracking-widest text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={loading || !formData.code.trim() || !formData.name.trim()}
                            className={cn(
                                "flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-xl shadow-amber-500/20 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2",
                                (loading || !formData.code.trim() || !formData.name.trim()) && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <Save size={18} />
                            {loading ? 'Saving...' : 'Save Warehouse'}
                        </button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
