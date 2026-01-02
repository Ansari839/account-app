"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VouchersRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/finance/vouchers/journal');
    }, [router]);

    return (
        <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
}
