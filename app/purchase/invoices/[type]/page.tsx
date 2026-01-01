"use client"
import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import DataTable from '@/components/DataTable';
import { useParams } from 'next/navigation';
import { authenticatedFetch } from '@/lib/api-client';

export default function GenericPurchasePage() {
    const { type } = useParams();
    const typeStr = (type as string)?.toLowerCase();
    const moduleName = typeStr?.toUpperCase() || 'PURCHASE';

    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let apiPath = '';
        if (typeStr === 'order') apiPath = '/api/finance/purchase/orders';
        else if (typeStr === 'invoice') apiPath = '/api/finance/purchase/invoices';
        // else if (typeStr === 'return') apiPath = '/api/finance/purchase/returns';

        if (!apiPath) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        authenticatedFetch(apiPath)
            .then(res => res.json())
            .then(json => {
                if (json.success) setData(json.data);
                else console.error(json.error);
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, [typeStr]);

    const columns = [
        {
            header: 'Number',
            accessor: (v: any) => <span className="font-bold text-indigo-600">{v.poNo || v.invoiceNo || v.id}</span>
        },
        {
            header: 'Supplier',
            accessor: (v: any) => v.supplier?.name
        },
        {
            header: 'Date',
            accessor: (v: any) => new Date(v.date).toLocaleDateString()
        },
        {
            header: 'Total',
            accessor: (v: any) => <span className="font-mono font-bold">${parseFloat(v.totalAmount || v.total || '0').toLocaleString()}</span>,
            className: 'text-right'
        }
    ];

    if (typeStr === 'order') {
        columns.push({
            header: 'Status',
            accessor: (v: any) => <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full text-[10px] font-bold">{v.status || 'OPEN'}</span>
        } as any);
    }

    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Purchase {moduleName}</h1>
                        <p className="text-slate-500 mt-1">Manage your supplier {moduleName.toLowerCase()} documents.</p>
                    </div>
                    <button className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">
                        + Create {moduleName}
                    </button>
                </div>

                <DataTable
                    data={data}
                    columns={columns}
                    searchPlaceholder={`Search ${moduleName.toLowerCase()}s...`}
                    isLoading={isLoading}
                />
            </div>
        </MainLayout>
    );
}
