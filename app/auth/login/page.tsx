"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Mail,
    Lock,
    ArrowRight,
    Loader2,
    ShieldCheck,
    HelpCircle,
    User
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { useCompany } from '@/context/CompanyContext';
import { cn } from '@/lib/utils';

export default function LoginPage() {
    const router = useRouter();
    const { showNotification } = useNotifications();
    const { clearCompany } = useCompany();
    const [email, setEmail] = useState('admin@antigravity.erp');
    const [password, setPassword] = useState('Admin@123');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Force clear any stale company context state if the user visits the login page
        clearCompany();
    }, [clearCompany]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const json = await res.json();

            if (json.success) {
                showNotification('success', 'Welcome back!');
                localStorage.setItem('token', json.data.token);
                localStorage.setItem('user', JSON.stringify(json.data.user));
                localStorage.setItem('isLoggedIn', 'true');

                const companies = json.data.companies || [];
                localStorage.setItem('companies', JSON.stringify(companies));

                if (companies.length > 0) {
                    router.push('/auth/select-company');
                } else {
                    showNotification('error', 'No company assigned to your account. Contact admin.');
                }
            } else {
                showNotification('error', json.error || 'Invalid email or password');
            }
        } catch (err: any) {
            showNotification('error', 'Login server unreachable. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 flex font-sans transition-colors duration-500">
            {/* Left Side: Branding Panel (Hidden on Mobile) */}
            <div className="hidden lg:flex w-[55%] relative overflow-hidden bg-slate-950 flex-col justify-between p-16">
                {/* Abstract Background Elements */}
                <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-indigo-600/30 rounded-full blur-[150px] mix-blend-screen animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-fuchsia-600/20 rounded-full blur-[150px] mix-blend-screen animate-pulse delay-1000"></div>
                
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/50">
                        <span className="text-2xl font-black text-white">A</span>
                    </div>
                    <span className="text-2xl font-black tracking-tight text-white">
                        Antigravity <span className="text-indigo-400">ERP</span>
                    </span>
                </div>

                <div className="relative z-10 space-y-6 max-w-xl">
                    <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight">
                        Financial clarity, <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-fuchsia-400">
                            engineered for scale.
                        </span>
                    </h1>
                    <p className="text-lg text-slate-400 font-medium leading-relaxed">
                        The unified operating system for your business. Manage multi-company accounts, intelligent vouchers, and real-time ledgers in one secure console.
                    </p>
                    
                    <div className="flex items-center gap-6 pt-8">
                        <div className="flex -space-x-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className={`w-12 h-12 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center shadow-lg`}>
                                    <User size={16} className="text-slate-400" />
                                </div>
                            ))}
                        </div>
                        <div className="text-sm">
                            <div className="text-white font-bold">Trusted by 10,000+ users</div>
                            <div className="text-slate-500">Enterprise grade security</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side: Auth Form */}
            <div className="w-full lg:w-[45%] flex flex-col items-center justify-center p-8 sm:p-12 lg:p-16 relative bg-slate-50 dark:bg-slate-950">
                <div className="w-full max-w-md space-y-10 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    
                    {/* Mobile Branding Header */}
                    <div className="lg:hidden text-center space-y-4 mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[2rem] mx-auto flex items-center justify-center shadow-xl shadow-indigo-500/30">
                            <span className="text-3xl font-black text-white">A</span>
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                            Antigravity <span className="text-indigo-500">ERP</span>
                        </h1>
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                            Welcome back
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                            Enter your credentials to access your console
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                                    Work Email
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full pl-11 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-medium text-sm shadow-sm"
                                        placeholder="name@company.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                                    Password
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full pl-11 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-medium text-sm shadow-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="w-4.5 h-4.5 rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-indigo-500 focus:ring-indigo-500/30 focus:ring-offset-0 transition-colors"
                                />
                                <span className="font-bold group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Remember me</span>
                            </label>
                            <a href="#" className="text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                                Forgot password?
                            </a>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={cn(
                                "w-full py-4.5 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-indigo-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 flex items-center justify-center gap-3 group text-sm uppercase tracking-widest mt-4",
                                isLoading && "cursor-not-allowed hover:-translate-y-0"
                            )}
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <span>Sign In to Console</span>
                                    <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="pt-10 mt-10 border-t border-slate-200 dark:border-slate-800 text-center space-y-4">
                        <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">
                            <ShieldCheck size={16} className="text-emerald-500" />
                            End-to-End Encrypted
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-6 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] pointer-events-none">
                    &copy; Antigravity Accounting 2026
                </div>
            </div>
        </div>
    );
}
