"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SalesPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to Sales Invoices by default
        router.replace('/finance/sales/invoices');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p className="text-slate-500 font-medium animate-pulse">Loading Sales Dashboard...</p>
            </div>
        </div>
    );
}
