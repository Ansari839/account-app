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
        <div className="flex min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 font-[Inter,sans-serif]">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <Header />

                <main className="flex-1 p-8 overflow-y-auto">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {children}
                    </div>
                </main>

                <footer className="p-4 border-t border-slate-200/50 dark:border-slate-800/50 text-center text-xs text-slate-400">
                    &copy; 2025 Antigravity Accounting. All rights reserved. Built for Excellence.
                </footer>
            </div>
        </div>
    );
}
