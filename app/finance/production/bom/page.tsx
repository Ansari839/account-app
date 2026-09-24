"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { Plus, Search, FileCog, Loader2 } from "lucide-react";

export default function BOMPage() {
    const router = useRouter();
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await authenticatedFetch("/api/finance/production/bom");
            const json = await res.json();
            if (json.success) {
                setTemplates(json.data);
            }
        } catch (error) {
            console.error("Failed to fetch BOM templates", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                            <FileCog className="w-8 h-8 text-indigo-500" />
                            Bill of Materials (BOM)
                        </h1>
                        <p className="text-slate-500 mt-1 font-medium">Define recipes and formulas for your manufactured goods.</p>
                    </div>
                    <button 
                        onClick={() => router.push('/finance/production/bom/new')}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5"
                    >
                        <Plus size={20} />
                        New BOM Template
                    </button>
                </div>

                {/* Content */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FileCog className="w-10 h-10 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No BOM Templates Found</h3>
                            <p className="text-slate-500 max-w-md mx-auto">You haven't defined any bill of materials yet. Create your first template to start manufacturing.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {templates.map(template => (
                                <div key={template.id} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors group">
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1 group-hover:text-indigo-500 transition-colors">{template.name}</h3>
                                    <p className="text-sm text-slate-500 mb-4">Output: <span className="font-medium text-slate-700 dark:text-slate-300">{template.outputProduct?.name}</span> (Qty: {template.outputQuantity})</p>
                                    
                                    <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Inputs ({template.inputs.length})</p>
                                        {template.inputs.slice(0, 3).map((input: any) => (
                                            <div key={input.id} className="flex justify-between text-sm">
                                                <span className="text-slate-600 dark:text-slate-400 truncate pr-4">{input.product?.name}</span>
                                                <span className="font-medium text-slate-900 dark:text-white">{input.quantity}</span>
                                            </div>
                                        ))}
                                        {template.inputs.length > 3 && (
                                            <p className="text-xs text-indigo-500 font-medium pt-1">+ {template.inputs.length - 3} more items</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
