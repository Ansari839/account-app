"use client";

import { useEffect, useState } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import { Download, RefreshCw, Printer } from "lucide-react";
import { format } from "date-fns";

export default function TradingAccountPage() {
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
            <div className="p-6 space-y-6 print:p-0">
                <div className="flex justify-between items-center print:hidden">
                    <h1 className="text-2xl font-bold text-slate-800">Trading Account (Gross Profit)</h1>
                    <div className="flex gap-2">
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                            className="border rounded px-3 py-2 text-sm"
                        />
                        <span className="self-center">to</span>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                            className="border rounded px-3 py-2 text-sm"
                        />
                        <button
                            onClick={fetchData}
                            className="bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700"
                            title="Refresh"
                        >
                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                        </button>
                        <button
                            onClick={handlePrint}
                            className="bg-slate-100 text-slate-600 p-2 rounded hover:bg-slate-200"
                            title="Print"
                        >
                            <Printer size={18} />
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none">
                    <div className="p-6 text-center border-b border-slate-100">
                        <h2 className="text-xl font-bold text-slate-800">Trading Account</h2>
                        <p className="text-slate-500 text-sm">
                            For the period {format(new Date(dateRange.startDate), "dd MMM yyyy")} to {format(new Date(dateRange.endDate), "dd MMM yyyy")}
                        </p>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-slate-400">Loading...</div>
                    ) : data ? (
                        <div className="grid grid-cols-2 divide-x divide-slate-200 sm:divide-x-0 print:grid-cols-2 print:divide-x">
                            {/* DEBIT SIDE */}
                            <div className="p-0">
                                <div className="bg-slate-50 p-3 font-semibold text-slate-700 border-b border-slate-200 flex justify-between">
                                    <span>Particulars (Dr)</span>
                                    <span>Amount</span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {data.debitSide.map((item: any, i: number) => (
                                        <div key={i} className="p-3 flex justify-between text-sm">
                                            <span>{item.name}</span>
                                            <span className="font-mono">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    ))}
                                    {/* Gross Profit Balance c/d (if profit) */}
                                    {data.grossProfit > 0 && (
                                        <div className="p-3 flex justify-between text-sm font-bold text-green-600 bg-green-50/30">
                                            <span>Gross Profit c/d</span>
                                            <span className="font-mono">{data.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-slate-100 p-3 font-bold flex justify-between border-t border-slate-200 mt-auto">
                                    <span>Total</span>
                                    <span className="font-mono">{data.totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    {/* Use totalCredits here because Dr + Profit = Cr */}
                                </div>
                            </div>

                            {/* CREDIT SIDE */}
                            <div className="p-0">
                                <div className="bg-slate-50 p-3 font-semibold text-slate-700 border-b border-slate-200 flex justify-between">
                                    <span>Particulars (Cr)</span>
                                    <span>Amount</span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {data.creditSide.map((item: any, i: number) => (
                                        <div key={i} className="p-3 flex justify-between text-sm">
                                            <span>{item.name}</span>
                                            <span className="font-mono">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    ))}
                                    {/* Gross Loss Balance c/d (if loss) */}
                                    {data.grossProfit < 0 && (
                                        <div className="p-3 flex justify-between text-sm font-bold text-red-600 bg-red-50/30">
                                            <span>Gross Loss c/d</span>
                                            <span className="font-mono">{Math.abs(data.grossProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-slate-100 p-3 font-bold flex justify-between border-t border-slate-200 mt-4">
                                    <span>Total</span>
                                    <span className="font-mono">{data.totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-12 text-center text-slate-400">No data available</div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
