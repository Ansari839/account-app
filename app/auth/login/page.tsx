"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/context/NotificationContext';

export default function LoginPage() {
    const router = useRouter();
    const { showNotification } = useNotifications();
    const [email, setEmail] = useState('admin@antigravity.erp');
    const [password, setPassword] = useState('Admin@123');
    const [isLoading, setIsLoading] = useState(false);

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

                // Store companies for company selector
                const companies = json.data.companies || [];
                localStorage.setItem('companies', JSON.stringify(companies));

                if (companies.length === 1) {
                    // Single company — auto-select and go to dashboard
                    localStorage.setItem('activeCompanyId', companies[0].id);
                    router.push('/finance/dashboard');
                } else if (companies.length > 1) {
                    // Multiple companies — show company selector
                    router.push('/auth/select-company');
                } else {
                    // No companies assigned
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
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] animate-pulse delay-700"></div>

            <div className="w-full max-w-md space-y-8 relative z-10 animate-in fade-in zoom-in duration-700">
                <div className="text-center">
                    <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-indigo-500/40 mb-6 rotate-12 transition-transform hover:rotate-0 duration-500">
                        <span className="text-3xl font-black text-white">A</span>
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-white">Antigravity ERP</h1>
                    <p className="text-slate-400 mt-2 font-medium">Enter your credentials to access your console</p>
                </div>

                <form onSubmit={handleLogin} className="bg-white/10 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Work Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full mt-1.5 p-4 rounded-2xl bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-600"
                                placeholder="name@company.com"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full mt-1.5 p-4 rounded-2xl bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-600"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-1 text-sm">
                        <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-offset-[#0f172a]" />
                            Remember me
                        </label>
                        <a href="#" className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors">Forgot Password?</a>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? 'Authenticating...' : 'Sign In to Dashboard'}
                        {!isLoading && <span>→</span>}
                    </button>
                </form>

                <p className="text-center text-slate-500 text-sm">
                    New to Antigravity? <a href="#" className="text-white font-bold hover:underline">Contact System Admin</a>
                </p>
            </div>
        </div>
    );
}
