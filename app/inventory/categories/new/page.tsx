"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { 
    Save, 
    ArrowLeft, 
    Tags,
    FolderTree,
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

export default function NewCategoryPage() {
    const router = useRouter();
    const { showNotification } = useNotifications();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        name: '',
        parentId: ''
    });

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await authenticatedFetch('/api/inventory/categories');
                const json = await res.json();
                if (json.success) setCategories(json.data);
            } catch (e) {
                console.error(e);
            }
        };
        fetchCategories();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.name.trim()) {
            showNotification('error', 'Category Name is required.');
            return;
        }

        setLoading(true);

        try {
            const res = await authenticatedFetch('/api/inventory/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    parentId: formData.parentId || null
                })
            });

            const json = await res.json();

            if (res.ok && json.success) {
                showNotification('success', 'Category created successfully!');
                router.push('/inventory/categories');
            } else {
                showNotification('error', json.error || "Failed to create category");
            }
        } catch (err) {
            showNotification('error', "An error occurred while creating category");
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainLayout>
            <div className="max-w-3xl mx-auto space-y-6 pb-32 animate-in fade-in duration-500">
                {/* Header Action Bar */}
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors font-bold text-sm"
                    >
                        <ArrowLeft size={16} /> Back to Categories
                    </button>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                        <Tags size={16} className="text-pink-500" /> New Category
                    </div>
                </div>

                {/* Premium Dark Header Card */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl shadow-pink-500/10 relative overflow-hidden border border-slate-800">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10">
                        <h1 className="text-4xl font-black text-white tracking-tight">New Category</h1>
                        <p className="text-slate-400 font-medium mt-1">Organize your products effectively</p>
                        
                        <div className="mt-8 space-y-6">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <Tags size={14} /> Category Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Electronics, Clothing..."
                                    className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-pink-500 font-medium"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    <FolderTree size={14} /> Parent Category (Optional)
                                </label>
                                <select
                                    className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-pink-500 font-medium"
                                    value={formData.parentId}
                                    onChange={e => setFormData({ ...formData, parentId: e.target.value })}
                                >
                                    <option value="">None (Top Level Category)</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-end gap-4">
                    <div className="flex gap-3 w-full md:w-auto">
                        <button 
                            onClick={() => router.back()}
                            className="flex-1 md:flex-none px-6 py-4 rounded-2xl font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors uppercase tracking-widest text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={loading || !formData.name.trim()}
                            className={cn(
                                "flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 shadow-xl shadow-pink-500/20 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2",
                                (loading || !formData.name.trim()) && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <Save size={18} />
                            {loading ? 'Saving...' : 'Save Category'}
                        </button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
