"use client";

import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { CheckCheck, Check, User, Clock, ArrowUpRight, ArrowDownRight, CreditCard, Banknote } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function PaymentLogs({ currencySymbol = '$' }: { currencySymbol?: string }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchLogs = async () => {
        try {
            const res = await authenticatedFetch('/api/finance/dashboard/logs', { cache: 'no-store' });
            const json = await res.json();
            if (json.success) {
                setLogs(json.data);
                const unread = json.data.filter((l: any) => !l.isViewed).length;
                setUnreadCount(unread);
            }
        } catch (error) {
            console.error("Failed to fetch logs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const markAsRead = async () => {
        if (unreadCount === 0) return;
        
        try {
            const res = await authenticatedFetch('/api/finance/dashboard/logs/mark-viewed', { method: 'POST' });
            const json = await res.json();
            if (json.success) {
                setUnreadCount(0);
                setLogs(logs.map(l => ({ ...l, isViewed: true })));
            }
        } catch (error) {
            console.error("Failed to mark as read:", error);
        }
    };

    if (loading) {
        return (
            <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-8 h-[400px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6 h-[400px] flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Payments & Receipts</h3>
                    {unreadCount > 0 && (
                        <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-lg shadow-rose-500/30">
                            {unreadCount} NEW
                        </span>
                    )}
                </div>
                <button 
                    onClick={markAsRead}
                    disabled={unreadCount === 0}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
                        unreadCount > 0 
                            ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 cursor-pointer'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    }`}
                >
                    {unreadCount > 0 ? <Check className="w-3.5 h-3.5" /> : <CheckCheck className="w-3.5 h-3.5" />}
                    {unreadCount > 0 ? 'Mark All Read' : 'All Read'}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Clock className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm font-medium">No recent logs found</p>
                    </div>
                ) : (
                    logs.map((log) => {
                        const isReceipt = log.type === 'BR' || log.type === 'CR';
                        const isBank = log.type === 'BP' || log.type === 'BR';
                        
                        // Calculate total amount (sum of credits for receipts, sum of debits for payments, or just use absolute value of lines)
                        // A simple way is to sum all debits since Journal is balanced
                        const amount = log.lines.reduce((acc: number, line: any) => acc + Number(line.debit || 0), 0);

                        return (
                            <div key={log.id} className={`p-4 rounded-2xl border transition-all ${
                                !log.isViewed 
                                    ? 'bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-500/30 shadow-md shadow-indigo-500/5' 
                                    : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-700/50'
                            }`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg ${
                                            isReceipt ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                                        }`}>
                                            {isReceipt ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                {log.number}
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black tracking-wider uppercase">
                                                    {log.type}
                                                </span>
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                                {isBank ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                                                {isBank ? 'Bank' : 'Cash'} {isReceipt ? 'Receipt' : 'Payment'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-black ${isReceipt ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                            {isReceipt ? '+' : ''}{currencySymbol}{amount.toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium mt-1">
                                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                                            <User className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                            {log.createdBy?.fullName || 'System / Unknown'}
                                        </span>
                                    </div>
                                    {!log.isViewed && (
                                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(156, 163, 175, 0.3);
                    border-radius: 20px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(75, 85, 99, 0.4);
                }
            `}</style>
        </div>
    );
}
