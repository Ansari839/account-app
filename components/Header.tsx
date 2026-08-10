"use client";

import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useNotifications } from '@/context/NotificationContext';
import { useCompany } from '@/context/CompanyContext';
import { Search, Moon, Sun, Bell, LogOut } from 'lucide-react';

export default function Header() {
    const { theme, toggleTheme } = useTheme();
    const { notifications } = useNotifications();
    const [user, setUser] = React.useState<any>(null);

    React.useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);
    const { clearCompany } = useCompany();

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem('token');
            await fetch('/api/auth/clear-session', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (error) {
            console.error('Logout failed:', error);
        }
        
        clearCompany(); // Reset CompanyContext state
        
        localStorage.clear();
        window.location.href = '/auth/login';
    };

    return (
        <header className="h-20 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-40 transition-all duration-300 shadow-sm">
            <div className="flex items-center gap-6">
                {/* Search Bar */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" strokeWidth={2.5} />
                    <input
                        type="text"
                        placeholder="Global search"
                        className="pl-12 pr-16 py-2.5 bg-slate-100/80 dark:bg-slate-800/50 border border-transparent focus:border-indigo-500/30 rounded-2xl w-72 text-sm focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 pointer-events-none">
                        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 shadow-sm">Alt</kbd>
                        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 shadow-sm">K</kbd>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-5">
                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-lg text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all active:scale-95"
                    title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                    {theme === 'light' ? <Moon className="w-5 h-5" strokeWidth={2.5} /> : <Sun className="w-5 h-5" strokeWidth={2.5} />}
                </button>

                {/* Notifications */}
                <button className="relative p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-lg text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-all active:scale-95">
                    <Bell className="w-5 h-5" strokeWidth={2.5} />
                    {notifications.length > 0 && (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></span>
                    )}
                </button>

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>

                {/* FY Badge */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 shadow-sm hover:shadow-md hover:bg-emerald-500/10 transition-all cursor-default">
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 tracking-wider">FY 2025</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                </div>

                {/* User Profile */}
                <div className="flex items-center gap-3 ml-2 group cursor-pointer p-1.5 rounded-2xl hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-all">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[120px]">{user?.fullName || 'Administrator'}</p>
                        <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold tracking-widest uppercase">Power User</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-11 h-11 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden relative transition-all active:scale-95 shadow-sm group-hover:border-rose-500/50"
                        title="Logout"
                    >
                        <div className="absolute inset-0 bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                            <LogOut className="w-5 h-5" strokeWidth={2.5} />
                        </div>
                        <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'Administrator')}&background=4f46e5&color=fff&bold=true`}
                            alt="User"
                            className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-300"
                        />
                    </button>
                </div>
            </div>
        </header>
    );
}
