"use client";

import { useEffect, useState } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import { Download, RefreshCw, Printer, Calendar, Scale, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function TradingAccountPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [dateRange, setDateRange] = useState({
        startDate: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"),
        endDate: format(new Date(), "yyyy-MM-dd")
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams(dateRange);
            const res = await authenticatedFetch(`/api/finance/reports/trading-account?${params}`);
            const json = await res.json();
            if (json.success) {
                setData(json.data);
            }
        } catch (error) {
            console.error("Failed to fetch report", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handlePrint = () => {
        window.print();
    };

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-32">
                
                {/* SCREEN ONLY HEADER */}
                <div className="print:hidden bg-slate-950 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden border border-slate-800 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">
                            <button onClick={() => router.push('/finance/reports')} className="hover:text-indigo-300 transition-colors flex items-center gap-1">
                                <ArrowLeft size={14}/> Reports Hub
                            </button>
                            <span className="opacity-50">/</span>
                            <span className="text-white">TRADING ACCOUNT</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tight">Trading Account</h1>
                        <p className="text-slate-400 font-medium mt-1">Calculate your gross profit or loss accurately.</p>
                    </div>

                    <div className="relative z-10 flex flex-wrap gap-3">
                        <button
                            onClick={fetchData}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-sm font-bold text-white hover:bg-slate-700 transition-all shadow-sm"
                        >
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh Data
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition-transform"
                        >
                            <Printer size={16} /> Print / PDF
                        </button>
                    </div>
                </div>

                {/* Date Selection - SCREEN ONLY */}
                <div className="print:hidden p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row gap-4 md:items-end shadow-sm">
                    <div className="flex-1">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Calendar size={14}/> Start Date
                        </p>
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 dark:text-slate-300"
                        />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Calendar size={14}/> End Date
                        </p>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 dark:text-slate-300"
                        />
                    </div>
                    <button 
                        onClick={fetchData} 
                        className="px-8 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-black rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors border border-indigo-200 dark:border-indigo-800 whitespace-nowrap h-[46px]"
                    >
                        Apply Filters
                    </button>
                </div>

                {/* REPORT CONTENT */}
                <div className="min-h-[400px]">
                    <div className="print:fixed print:inset-0 print:bg-white print:z-[9999] print:p-12 print:overflow-auto">
                        
                        {/* PRINT HEADER */}
                        <div className="hidden print:block mb-10 text-center border-b-2 border-slate-800 pb-6">
                            <h1 className="text-4xl font-black uppercase tracking-widest text-slate-900 mb-2">Ansari Traders</h1>
                            <h2 className="text-2xl font-bold uppercase text-slate-600 mb-4">Trading Account</h2>
                            <div className="flex justify-center items-center gap-4 text-sm font-medium text-slate-500">
                                <span className="bg-slate-100 px-4 py-1 rounded-full">For the period: {format(new Date(dateRange.startDate), "dd MMM yyyy")} to {format(new Date(dateRange.endDate), "dd MMM yyyy")}</span>
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-32 flex flex-col items-center justify-center print:hidden">
                                <div className="relative w-16 h-16 mb-6">
                                    <div className="absolute inset-0 border-4 border-indigo-200 dark:border-indigo-900 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                                <p className="text-slate-500 font-black uppercase tracking-widest text-sm animate-pulse">Calculating Trading Profit...</p>
                            </div>
                        ) : data ? (
                            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden print:shadow-none print:border-2 print:border-black print:rounded-none">
                                {/* T-Account Header */}
                                <div className="bg-slate-100 dark:bg-slate-800 p-4 text-center border-b border-slate-200 dark:border-slate-700 flex justify-center items-center gap-3 print:bg-slate-200">
                                    <Scale size={20} className="text-slate-400" />
                                    <h2 className="text-xl font-black uppercase tracking-widest text-slate-800 dark:text-white print:text-black">Trading Account</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-700 print:grid-cols-2 print:divide-x print:divide-y-0 print:divide-black">
                                    
                                    {/* DEBIT SIDE (Dr) */}
                                    <div className="flex flex-col">
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700 print:border-black">
                                            <span className="font-black uppercase tracking-widest text-xs text-slate-500 dark:text-slate-400">Particulars (Dr)</span>
                                            <span className="font-black uppercase tracking-widest text-xs text-slate-500 dark:text-slate-400">Amount</span>
                                        </div>
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800/50 flex-1">
                                            {data.debitSide.map((item: any, i: number) => (
                                                <div key={i} className="p-4 flex justify-between text-sm group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">{item.name}</span>
                                                    <span className="font-mono font-bold text-slate-900 dark:text-white">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            ))}
                                            {/* Gross Profit Balance c/d (if profit) */}
                                            {data.grossProfit > 0 && (
                                                <div className="p-4 flex justify-between text-sm font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-t border-emerald-200 dark:border-emerald-800">
                                                    <span>Gross Profit c/d</span>
                                                    <span className="font-mono text-lg">{data.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            )}
                                        </div>
                                        {/* Total Row */}
                                        <div className="bg-slate-100 dark:bg-slate-800 p-4 flex justify-between items-center border-t border-slate-200 dark:border-slate-700 print:border-t-2 print:border-black print:bg-slate-100">
                                            <span className="font-black uppercase tracking-widest text-slate-700 dark:text-white">Total</span>
                                            <span className="font-mono font-black text-xl text-indigo-600 dark:text-indigo-400 border-double border-b-4 border-indigo-600 dark:border-indigo-400 print:border-black print:text-black">
                                                {data.totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* CREDIT SIDE (Cr) */}
                                    <div className="flex flex-col">
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700 print:border-black">
                                            <span className="font-black uppercase tracking-widest text-xs text-slate-500 dark:text-slate-400">Particulars (Cr)</span>
                                            <span className="font-black uppercase tracking-widest text-xs text-slate-500 dark:text-slate-400">Amount</span>
                                        </div>
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800/50 flex-1">
                                            {data.creditSide.map((item: any, i: number) => (
                                                <div key={i} className="p-4 flex justify-between text-sm group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">{item.name}</span>
                                                    <span className="font-mono font-bold text-slate-900 dark:text-white">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            ))}
                                            {/* Gross Loss Balance c/d (if loss) */}
                                            {data.grossProfit < 0 && (
                                                <div className="p-4 flex justify-between text-sm font-black bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-t border-rose-200 dark:border-rose-800">
                                                    <span>Gross Loss c/d</span>
                                                    <span className="font-mono text-lg">{Math.abs(data.grossProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            )}
                                        </div>
                                        {/* Total Row */}
                                        <div className="bg-slate-100 dark:bg-slate-800 p-4 flex justify-between items-center border-t border-slate-200 dark:border-slate-700 print:border-t-2 print:border-black print:bg-slate-100">
                                            <span className="font-black uppercase tracking-widest text-slate-700 dark:text-white">Total</span>
                                            <span className="font-mono font-black text-xl text-indigo-600 dark:text-indigo-400 border-double border-b-4 border-indigo-600 dark:border-indigo-400 print:border-black print:text-black">
                                                {data.totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                    
                                </div>
                            </div>
                        ) : (
                            <div className="p-32 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-[2rem] bg-slate-50 dark:bg-slate-900/50 print:hidden">
                                <Scale size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                                <h2 className="text-xl font-bold text-slate-500">No trading data available for this period.</h2>
                            </div>
                        )}

                        {/* PRINT FOOTER */}
                        <div className="hidden print:flex justify-between mt-16 text-xs font-bold text-slate-400 py-4 border-t-2 border-slate-200">
                            <p>Generated on {new Date().toLocaleString()} by Premium Accounting System</p>
                            <p>Page 1 of 1</p>
                        </div>

                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
