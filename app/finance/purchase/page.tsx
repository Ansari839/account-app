"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PurchasePage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to Purchase Orders by default
        router.replace('/finance/purchase/orders');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );
}
