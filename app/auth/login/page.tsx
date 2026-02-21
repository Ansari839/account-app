"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Mail,
    Lock,
    ArrowRight,
    Loader2,
    ShieldCheck,
    HelpCircle
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

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

                const companies = json.data.companies || [];
                localStorage.setItem('companies', JSON.stringify(companies));

                if (companies.length === 1) {
                    localStorage.setItem('activeCompanyId', companies[0].id);
                    router.push('/finance/dashboard');
                } else if (companies.length > 1) {
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
        <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Background Aesthetic Orbs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-accent/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>
            </div>

            <div className="w-full max-w-[440px] space-y-8 relative z-10 animate-in fade-in zoom-in duration-700">
                <div className="text-center space-y-3">
                    <div className="w-20 h-20 bg-primary rounded-[2.5rem] mx-auto flex items-center justify-center shadow-2xl shadow-primary/30 mb-6 rotate-12 transition-all hover:rotate-0 hover:scale-105 duration-500">
                        <span className="text-3xl font-black text-primary-foreground">A</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-foreground">
                        Antigravity <span className="text-primary/70">ERP</span>
                    </h1>
                    <p className="text-muted-foreground font-medium text-sm">
                        Enter your credentials to access your secure console
                    </p>
                </div>

                <div className="bg-card/40 backdrop-blur-2xl border border-border rounded-[2.5rem] p-8 md:p-10 shadow-2xl shadow-foreground/5 overflow-hidden relative">
                    {/* Decorative subtle line at top */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                    <Mail size={12} /> Work Email
                                </label>
                                <div className="relative group">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full p-4 rounded-2xl bg-muted/20 border border-border text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/30 font-medium text-sm"
                                        placeholder="name@company.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                    <Lock size={12} /> Password
                                </label>
                                <div className="relative group">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full p-4 rounded-2xl bg-muted/20 border border-border text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/30 font-medium text-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-1 text-xs">
                            <label className="flex items-center gap-2 text-muted-foreground cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-border bg-muted/20 text-primary focus:ring-primary/20 focus:ring-offset-background transition-colors"
                                />
                                <span className="font-bold group-hover:text-foreground transition-colors uppercase tracking-tight">Remember me</span>
                            </label>
                            <a href="#" className="text-primary font-bold hover:underline transition-all uppercase tracking-tight flex items-center gap-1">
                                <HelpCircle size={12} /> Forgot?
                            </a>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={cn(
                                "w-full py-4 bg-primary text-primary-foreground font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 group text-sm uppercase tracking-widest",
                                isLoading && "cursor-not-allowed"
                            )}
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <span>Sign In to Dashboard</span>
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="text-center space-y-4">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                        <ShieldCheck size={14} className="text-primary/60" />
                        Enterprise Grade Security Enabled
                    </div>
                    <p className="text-muted-foreground text-xs font-medium">
                        New to Antigravity? <a href="#" className="text-foreground font-black hover:underline transition-all underline-offset-4 decoration-primary/30">Contact System Admin</a>
                    </p>
                </div>
            </div>

            {/* Subtle Footer branding */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-muted-foreground/30 uppercase tracking-[0.3em] pointer-events-none">
                &copy; Antigravity Accounting 2026
            </div>
        </div>
    );
}
