import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: React.ReactNode;
    icon: LucideIcon;
    color: string;
    change?: string;
    loading?: boolean;
}

export default function StatCard({ label, value, icon: Icon, color, change, loading }: StatCardProps) {
    return (
        <div className="group p-8 min-h-[160px] bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-3xl shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden cursor-default flex flex-col justify-between">
            {/* Animated glowing background circle */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/10 rounded-full -mr-10 -mt-10 group-hover:scale-[1.8] group-hover:bg-${color}-500/15 transition-transform duration-700 ease-out pointer-events-none`}></div>
            
            <div className="flex justify-between items-start relative z-10 mb-4">
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</p>
                <div className={`p-4 rounded-2xl bg-${color}-500/10 text-${color}-600 dark:text-${color}-400 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                    <Icon className="w-8 h-8" strokeWidth={2.5} />
                </div>
            </div>

            <div className="flex items-end justify-between relative z-10">
                {loading ? (
                    <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-xl"></div>
                ) : (
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{value}</h2>
                )}
                
                {change && (
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-sm ${change.startsWith('+') ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'}`}>
                        {change}
                    </span>
                )}
            </div>
        </div>
    );
}
