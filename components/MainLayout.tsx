"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem('token');
        const isLoggedIn = localStorage.getItem('isLoggedIn');

        if (!token || isLoggedIn !== 'true') {
            router.push('/auth/login');
        }
    }, [router]);

    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans antialiased">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <Header />

                <main className="flex-1 p-6 md:p-10 overflow-y-auto">
                    <div className="w-full space-y-8">
                        {children}
                    </div>
                </main>

                <footer className="p-4 border-t border-border/50 text-center text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold">
                    &copy; 2026 Antigravity Accounting. Built for Excellence.
                </footer>
            </div>
        </div>
    );
}
