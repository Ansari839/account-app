"use client";

import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useNotifications } from '@/context/NotificationContext';

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

    const nameInitials = user?.fullName
        ? user.fullName.split(' ').map((n: string) => n[0]).join('')
        : 'AA';

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem('token');
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            localStorage.clear();
            window.location.href = '/auth/login';
        }
    };

    return (
        <header className="h-16 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-[#0f172a]/70 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-40">
            <div className="flex items-center gap-4">
                {/* Search Bar Stub */}
                <div className="relative group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">🔍</span>
                    <input
                        type="text"
                        placeholder="Global search (Alt + K)"
                        className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800/50 border-none rounded-full w-64 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-all active:scale-90"
                    title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                    {theme === 'light' ? '🌙' : '☀️'}
                </button>

                {/* Quick Actions */}
                <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors relative">
                    🔔
                    {notifications.length > 0 && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                    )}
                </button>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-xs font-bold text-slate-500">FY 2025</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>

                <div className="flex items-center gap-3 ml-2">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold truncate max-w-[120px]">{user?.fullName || 'Administrator'}</p>
                        <p className="text-[10px] text-slate-500 font-medium">Power User</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-500 transition-all active:scale-95 group relative"
                        title="Logout"
                    >
                        <span className="text-xl group-hover:hidden">
                            <img
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'Administrator')}&background=4f46e5&color=fff`}
                                alt="User"
                                className="w-full h-full object-cover"
                            />
                        </span>
                        <span className="hidden group-hover:block transition-all animate-in fade-in duration-200">
                            🚪
                        </span>
                    </button>
                </div>
            </div>
        </header>
    );
}
