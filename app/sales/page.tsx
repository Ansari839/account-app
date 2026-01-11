"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacySalesRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/finance/sales/invoices');
    }, [router]);

    return null;
}
