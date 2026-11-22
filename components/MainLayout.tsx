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
        <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans antialiased print:block print:min-h-0 print:bg-white print:text-black">
            {/* Sidebar */}
            <div className="print:hidden">
                <Sidebar />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 print:block print:w-full">
                <div className="print:hidden">
                    <Header />
                </div>

                <main className="flex-1 p-6 md:p-10 overflow-y-auto print:p-0 print:m-0 print:overflow-visible print:w-full">
                    <div className="w-full space-y-8 print:space-y-0 print:w-full">
                        {children}
                    </div>
                </main>

                <footer className="p-4 border-t border-border/50 text-center text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold print:hidden">
                    &copy; 2026 Antigravity Accounting. Built for Excellence.
                </footer>
            </div>
        </div>
    );
}
