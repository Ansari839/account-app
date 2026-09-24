"use client";

import React, { useEffect, useState, use } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { Hammer, Package, AlertCircle, ArrowLeft, Loader2, DollarSign, Scissors, Layers } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ViewProductionExecutionPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);
    const [record, setRecord] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRecord();
    }, [id]);

    const fetchRecord = async () => {
        try {
            const res = await authenticatedFetch(`/api/finance/production/execution/${id}`);
            const json = await res.json();
            if (json.success) {
                setRecord(json.data);
            } else {
                alert(json.error);
                router.push('/finance/production/execution');
            }
        } catch (err) {
            console.error("Failed to load record:", err);
            router.push('/finance/production/execution');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                </div>
            </MainLayout>
        );
    }

    if (!record) return null;

    const rawMaterialCost = record.inputs.reduce((sum: number, item: any) => sum + Number(item.costValue), 0);
    const serviceCost = record.overheads.reduce((sum: number, item: any) => sum + Number(item.amount), 0);

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    <div className="relative z-10">
                        <button onClick={() => router.push('/finance/production/execution')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-500 mb-4 transition-colors font-medium">
                            <ArrowLeft size={16} /> Back to Executions
                        </button>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                            <Hammer className="w-8 h-8 text-indigo-500" />
                            Production Batch Details
                        </h1>
                        <div className="flex items-center gap-4 mt-3 text-sm text-slate-500 font-medium">
                            <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-600 dark:text-slate-300">
                                Date: {new Date(record.date).toLocaleDateString()}
                            </span>
                            <span className={`px-3 py-1 rounded-full ${record.status === 'COMPLETED' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'}`}>
                                {record.status}
                            </span>
                            {record.outputStage && (
                                <span className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 px-3 py-1 rounded-full">
                                    Stage: {record.outputStage}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Output Summary Card */}
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-8 shadow-inner shadow-indigo-500/5 relative overflow-hidden">
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="md:col-span-2">
                            <h3 className="text-xs font-bold text-indigo-400/80 uppercase tracking-widest mb-2">Output Product</h3>
                            <div className="text-3xl font-bold text-indigo-950 dark:text-indigo-50">{record.outputProduct?.name}</div>
                            <div className="text-sm text-indigo-800 dark:text-indigo-300 mt-2 font-medium flex items-center gap-2">
                                <Package size={16} />
                                {record.outputProduct?.category?.name || 'Uncategorized'} | {record.warehouse?.name || 'Main Warehouse'}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-indigo-400/80 uppercase tracking-widest mb-2">Quantity Produced</h3>
                            <div className="text-4xl font-light text-emerald-600 dark:text-emerald-400">
                                {record.outputQuantity} <span className="text-lg font-medium text-emerald-600/50 dark:text-emerald-400/50">{record.outputProduct?.baseUnit?.code}</span>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-indigo-400/80 uppercase tracking-widest mb-2">Cost Per Unit</h3>
                            <div className="text-4xl font-light text-amber-600 dark:text-amber-400">
                                {(Number(record.totalCost) / Number(record.outputQuantity)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Material & Services */}
                    <div className="lg:col-span-2 space-y-8">
                        
                        {/* Raw Materials Consumed */}
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Layers className="text-emerald-500" />
                                    Raw Materials Consumed
                                </h3>
                                <div className="text-lg font-bold text-emerald-500">
                                    Total: {rawMaterialCost.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-300">
                                        <tr>
                                            <th className="px-4 py-3 rounded-tl-xl">Material</th>
                                            <th className="px-4 py-3 text-right">Quantity</th>
                                            <th className="px-4 py-3 text-right">Cost Value</th>
                                            <th className="px-4 py-3 rounded-tr-xl text-center">Stage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {record.inputs.map((input: any) => (
                                            <tr key={input.id} className="border-b dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-200">
                                                    {input.product?.name}
                                                    {input.lotNumber && <div className="text-xs text-slate-400 mt-1">Lot: {input.lotNumber}</div>}
                                                </td>
                                                <td className="px-4 py-4 text-right font-medium">
                                                    {input.quantity} {input.product?.baseUnit?.code}
                                                </td>
                                                <td className="px-4 py-4 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                                                    {Number(input.costValue).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    {input.inputStage ? (
                                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs font-bold text-slate-500">{input.inputStage}</span>
                                                    ) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Services / Overheads */}
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Scissors className="text-amber-500" />
                                    Services & Overheads
                                </h3>
                                <div className="text-lg font-bold text-amber-500">
                                    Total: {serviceCost.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </div>
                            </div>

                            {record.overheads.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-300">
                                            <tr>
                                                <th className="px-4 py-3 rounded-tl-xl">Description</th>
                                                <th className="px-4 py-3 text-right">Service Item</th>
                                                <th className="px-4 py-3 text-right">Quantity</th>
                                                <th className="px-4 py-3 rounded-tr-xl text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {record.overheads.map((ov: any) => (
                                                <tr key={ov.id} className="border-b dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                    <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-200">
                                                        {ov.description}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-slate-500">
                                                        {ov.purchaseInvoiceItem?.product?.name || '-'}
                                                    </td>
                                                    <td className="px-4 py-4 text-right font-medium">
                                                        {ov.quantity ? `${ov.quantity} ${ov.unit?.code || ''}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-amber-600 dark:text-amber-400 font-medium">
                                                        {Number(ov.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-500 border border-slate-200 dark:border-slate-800 border-dashed rounded-xl">
                                    No services or overheads consumed for this batch.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Financial Summary */}
                    <div className="space-y-6">
                        <div className="bg-slate-950 rounded-[2rem] border border-slate-800 p-8 shadow-xl shadow-slate-900/50 text-white">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <DollarSign className="text-emerald-400" />
                                Financial Summary
                            </h3>
                            
                            <div className="space-y-4">
                                <div className="flex justify-between items-center py-3 border-b border-slate-800/50">
                                    <span className="text-slate-400 font-medium">Material Cost</span>
                                    <span className="font-bold">{rawMaterialCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                                <div className="flex justify-between items-center py-3 border-b border-slate-800/50">
                                    <span className="text-slate-400 font-medium">Overheads / Services</span>
                                    <span className="font-bold">{serviceCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                                <div className="flex justify-between items-center py-4 bg-slate-900/50 -mx-4 px-4 rounded-xl">
                                    <span className="text-slate-300 font-bold">Total Batch Cost</span>
                                    <span className="text-2xl font-black text-emerald-400">{Number(record.totalCost).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            </div>

                            <div className="mt-8 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="text-indigo-400 shrink-0 mt-0.5" size={18} />
                                <p className="text-xs text-indigo-200/70 font-medium leading-relaxed">
                                    This batch has been posted to the general ledger. The total batch cost has been debited to the inventory account of the output product, and respective materials have been credited.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </MainLayout>
    );
}
