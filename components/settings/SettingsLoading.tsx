import React from 'react';
import { Loader2 } from 'lucide-react';

interface SettingsLoadingProps {
    title?: string;
    description?: string;
}

export default function SettingsLoading({ 
    title = "Loading settings...", 
    description = "Please wait while we retrieve configuration data" 
}: SettingsLoadingProps) {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-16 rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-300 min-h-[380px]">
            <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Loader2 size={28} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 blur-xl animate-pulse -z-10" />
            </div>
            <div className="space-y-1.5">
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                    {title}
                </h4>
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 max-w-sm">
                    {description}
                </p>
            </div>
        </div>
    );
}
