"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import { PackageSearch, Loader2, ArrowRight, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function ProductionDashboard() {
    const router = useRouter();
    const [categories, setCategories] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const res = await authenticatedFetch("/api/finance/production/dashboard");
            const json = await res.json();
            if (json.success) {
                setCategories(json.data);
                if (json.data.length > 0) {
                    setActiveTab(json.data[0].id);
                }
            }
        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    const activeCategory = categories.find(c => c.id === activeTab);

    return (
        <MainLayout>
            <div className="max-w-[90rem] mx-auto space-y-8 animate-in fade-in duration-700 pb-32">
                
                {/* Premium Hero Header */}
                <div className="bg-slate-950 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden border border-slate-800 flex flex-col md:flex-row justify-between md:items-center gap-6">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">
                            <Layers size={14} />
                            <span className="text-white">Manufacturing Workflow</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tight">Production Dashboard</h1>
                        <p className="text-slate-400 font-medium mt-1">Track unconsumed inventory categorized by production stage.</p>
                    </div>
                    
                    <div className="relative z-10 flex gap-4">
                        <button 
                            onClick={() => router.push('/finance/production/bom')}
                            className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold transition-all border border-slate-700 hover:border-slate-600"
                        >
                            Manage BOMs
                        </button>
                        <button 
                            onClick={() => router.push('/finance/production/execution/new')}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5"
                        >
                            Process Material <ArrowRight size={18} />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800">
                        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                        <p className="text-slate-500 font-bold animate-pulse">Loading Inventory Stages...</p>
                    </div>
                ) : categories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <PackageSearch className="w-10 h-10 text-slate-400" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white">No Inventory Found</h2>
                        <p className="text-slate-500 mt-2 text-center max-w-md">There are currently no products in stock across any category. Add stock via Purchase Invoices or Production to see them here.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Dynamic Tabs */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 shadow-sm overflow-x-auto scrollbar-hide">
                            <div className="flex gap-2 min-w-max">
                                {categories.map(category => (
                                    <button
                                        key={category.id}
                                        onClick={() => setActiveTab(category.id)}
                                        className={cn(
                                            "flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300",
                                            activeTab === category.id
                                                ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                        )}
                                    >
                                        {category.name}
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-full text-xs font-black",
                                            activeTab === category.id 
                                                ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" 
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                        )}>
                                            {(category.products?.length || 0) + (category.services?.length || 0)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Active Tab Content */}
                        {activeCategory && (
                            <div className="space-y-6">
                                {/* Physical Stock Table */}
                                {!activeCategory.isService && (
                                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                                            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                                <Layers className="w-5 h-5 text-indigo-500" />
                                                {activeCategory.name} - Physical Inventory
                                            </h3>
                                            <p className="text-sm font-medium text-slate-500 mt-1">Available physical stock ready for the next production stage.</p>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                                                <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-300">
                                                    <tr>
                                                        <th scope="col" className="px-6 py-4">Item Code</th>
                                                        <th scope="col" className="px-6 py-4">Product Name</th>
                                                        <th scope="col" className="px-6 py-4">Composition</th>
                                                        <th scope="col" className="px-6 py-4 text-right">Available Stock</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                                    {activeCategory.products?.length > 0 ? activeCategory.products.map((product: any) => (
                                                        <tr key={product.id} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                            <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-400">
                                                                {product.code || '-'}
                                                            </td>
                                                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                                                {product.name}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm font-medium text-amber-600 dark:text-amber-400">
                                                                {product.composition || '-'}
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <span className="inline-flex items-center justify-center px-3 py-1 text-sm font-black text-indigo-700 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-500/10 rounded-lg">
                                                                        {product.stockBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                                    </span>
                                                                    <span className="text-xs font-bold text-slate-400 uppercase">
                                                                        {product.unit}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )) : (
                                                        <tr>
                                                            <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                                                                No physical stock available in this category.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Unconsumed Services Table */}
                                {activeCategory.isService && (
                                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                                            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                                <Layers className="w-5 h-5 text-emerald-500" />
                                                {activeCategory.name} - Unconsumed Services
                                            </h3>
                                            <p className="text-sm font-medium text-slate-500 mt-1">Service invoices pending consumption into production.</p>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                                                <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-300">
                                                    <tr>
                                                        <th scope="col" className="px-4 py-4">Date</th>
                                                        <th scope="col" className="px-4 py-4">Inv #</th>
                                                        <th scope="col" className="px-4 py-4">Vendor Name</th>
                                                        <th scope="col" className="px-4 py-4">Service</th>
                                                        <th scope="col" className="px-4 py-4 text-right">Qty (UOM)</th>
                                                        <th scope="col" className="px-4 py-4 text-right">Ex-Amount</th>
                                                        <th scope="col" className="px-4 py-4 text-right">GST</th>
                                                        <th scope="col" className="px-4 py-4 text-right">Incl Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                                    {activeCategory.services?.length > 0 ? activeCategory.services.map((svc: any) => (
                                                        <tr key={svc.id} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                            <td className="px-4 py-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                                                                {new Date(svc.date).toLocaleDateString()}
                                                            </td>
                                                            <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">
                                                                {svc.invoiceNo}
                                                            </td>
                                                            <td className="px-4 py-4 text-slate-700 dark:text-slate-300">
                                                                {svc.supplierName}
                                                            </td>
                                                            <td className="px-4 py-4 font-medium text-emerald-600 dark:text-emerald-400">
                                                                {svc.productName}
                                                            </td>
                                                            <td className="px-4 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <span className="inline-flex items-center justify-center px-2 py-1 text-sm font-black text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 rounded-md">
                                                                        {svc.unconsumedQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                                    </span>
                                                                    <span className="text-xs font-bold text-slate-400 uppercase">
                                                                        {svc.unit}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-right text-slate-600 dark:text-slate-400">
                                                                {svc.exAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="px-4 py-4 text-right text-slate-500 dark:text-slate-500">
                                                                {svc.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="px-4 py-4 text-right font-bold text-slate-900 dark:text-white">
                                                                {svc.inclAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    )) : (
                                                        <tr>
                                                            <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                                                                No unconsumed services available in this category.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
