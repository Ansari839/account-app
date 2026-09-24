"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/api-client";
import { Hammer, Plus, Search, Loader2 } from "lucide-react";

export default function ProductionExecutionPage() {
    const router = useRouter();
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRecords();
    }, []);

    const fetchRecords = async () => {
        try {
            const res = await authenticatedFetch("/api/finance/production/record");
            const json = await res.json();
            if (json.success) {
                setRecords(json.data);
            }
        } catch (error) {
            console.error("Failed to fetch records", error);
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
                            <Hammer className="w-8 h-8 text-indigo-500" />
                            Production Execution
                        </h1>
                        <p className="text-slate-500 mt-1 font-medium">Record daily manufacturing output and consume raw materials.</p>
                    </div>
                    <button 
                        onClick={() => router.push('/finance/production/execution/new')}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5"
                    >
                        <Plus size={20} />
                        Record Production
                    </button>
                </div>

                {/* Content */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm min-h-[400px]">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                        </div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Hammer className="w-10 h-10 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Production Records</h3>
                            <p className="text-slate-500 max-w-md mx-auto">Start recording your production to track raw material consumption and finished goods inventory.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-300">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 rounded-tl-xl">Date</th>
                                        <th scope="col" className="px-6 py-4">Output Product</th>
                                        <th scope="col" className="px-6 py-4">Quantity</th>
                                        <th scope="col" className="px-6 py-4">Total Cost</th>
                                        <th scope="col" className="px-6 py-4 text-center">Status</th>
                                        <th scope="col" className="px-6 py-4 rounded-tr-xl text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map((record) => (
                                        <tr key={record.id} className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                {new Date(record.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">
                                                {record.outputProduct?.name}
                                            </td>
                                            <td className="px-6 py-4 font-medium">
                                                {record.outputQuantity}
                                            </td>
                                            <td className="px-6 py-4 font-medium">
                                                {record.totalCost?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded dark:bg-green-900 dark:text-green-300">
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center flex items-center justify-center gap-3">
                                                <button onClick={() => router.push(`/finance/production/execution/${record.id}`)} className="text-blue-500 hover:text-blue-700 font-medium">View</button>
                                                <button 
                                                    onClick={async () => {
                                                        if(confirm('Are you sure you want to delete this production record? This will revert stock and accounts.')) {
                                                            const res = await authenticatedFetch(`/api/finance/production/execution/${record.id}`, { method: 'DELETE' });
                                                            if (res.ok) fetchRecords();
                                                            else alert('Failed to delete.');
                                                        }
                                                    }}
                                                    className="text-red-500 hover:text-red-700 font-medium"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
