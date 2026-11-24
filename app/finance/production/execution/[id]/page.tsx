"use client";

import React, { useEffect, useState, use } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { Hammer, Package, AlertCircle, ArrowLeft, Loader2, DollarSign, Scissors, Layers, FileText, CheckCircle2, Clock, X, Sparkles, Eye, Edit2, Trash2, History } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ViewProductionExecutionPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);
    const [record, setRecord] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Stock settlement modal state
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [selectedAccrualForStock, setSelectedAccrualForStock] = useState<any>(null);
    const [stockSettleProductId, setStockSettleProductId] = useState("");
    const [stockSettleQty, setStockSettleQty] = useState<number | string>("");
    const [stockSettleRate, setStockSettleRate] = useState<number | string>("");
    const [stockSettleWarehouseId, setStockSettleWarehouseId] = useState("");
    const [stockSettleDate, setStockSettleDate] = useState(new Date().toISOString().split("T")[0]);
    const [stockSettleRemarks, setStockSettleRemarks] = useState("");
    const [isStockSettling, setIsStockSettling] = useState(false);

    // Settlements CRUD state (View / Edit / Delete)
    const [settlements, setSettlements] = useState<any[]>([]);
    const [viewingSettlement, setViewingSettlement] = useState<any>(null);
    const [editingSettlement, setEditingSettlement] = useState<any>(null);
    const [editQty, setEditQty] = useState<number | string>("");
    const [editRate, setEditRate] = useState<number | string>("");
    const [editWarehouseId, setEditWarehouseId] = useState("");
    const [editProductId, setEditProductId] = useState("");
    const [editDate, setEditDate] = useState("");
    const [editRemarks, setEditRemarks] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [isReverting, setIsReverting] = useState(false);

    const parsedSpecs = React.useMemo(() => {
        if (!record) return null;
        const rawBatchNo = record.batchNo || '';
        const bracketIdx = rawBatchNo.indexOf('[');
        const cleanBatchNo = record.cleanBatchNo || (bracketIdx !== -1 ? rawBatchNo.substring(0, bracketIdx).trim() : rawBatchNo.trim());
        const rawSpecs = bracketIdx !== -1 ? rawBatchNo.substring(bracketIdx) : '';
        const content = rawSpecs.replace(/^\[+|\]+$/g, '').trim();
        const parts = content ? content.split('|').map((p: string) => p.trim()) : [];

        let outputUnit = record.outputUom || record.outputProduct?.baseUnit?.code || 'Units';
        let cutSize: string | null = record.cutSize ? String(record.cutSize) : null;
        let cutUnit: string = record.cutUnit || 'MTR';
        let pieceWeightKg: string | null = record.pieceWeightKg ? String(record.pieceWeightKg) : null;
        let netWeightKg: number | null = record.netWeightKg || null;

        for (const part of parts) {
            const uomMatch = part.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/i);
            if (uomMatch && !part.toLowerCase().includes('cut') && !part.toLowerCase().includes('unit') && !part.toLowerCase().includes('net')) {
                outputUnit = uomMatch[2].toUpperCase();
            }
            const cutMatch = part.match(/cut:\s*([\d.]+)\s*([A-Za-z]+)(?:\/pc)?/i);
            if (cutMatch) {
                cutSize = cutMatch[1];
                cutUnit = cutMatch[2].toUpperCase();
            }
            const unitMatch = part.match(/unit:\s*([\d.]+)\s*([A-Za-z]+)(?:\/pc)?/i);
            if (unitMatch) {
                pieceWeightKg = unitMatch[1];
            }
            const netMatch = part.match(/net:\s*([\d.]+)\s*KG/i);
            if (netMatch) {
                netWeightKg = parseFloat(netMatch[1]);
            }
        }

        if (content.toUpperCase().includes('PCS')) {
            outputUnit = 'PCS';
        }

        return {
            cleanBatchNo,
            rawSpecs,
            outputUnit,
            cutSize,
            cutUnit,
            pieceWeightKg,
            netWeightKg
        };
    }, [record]);

    useEffect(() => {
        fetchRecord();
        fetchSettlements();
        authenticatedFetch("/api/inventory/warehouses")
            .then(r => r.json())
            .then(j => {
                if (j.success && j.data) {
                    setWarehouses(j.data);
                    if (j.data.length > 0) setStockSettleWarehouseId(j.data[0].id);
                }
            })
            .catch(console.error);

        authenticatedFetch("/api/inventory/products")
            .then(r => r.json())
            .then(j => {
                if (j.success && j.data) {
                    setProducts(j.data);
                }
            })
            .catch(console.error);
    }, [id]);

    const fetchSettlements = async () => {
        try {
            const res = await authenticatedFetch(`/api/finance/production/accruals/settlements?productionId=${id}`);
            const json = await res.json();
            if (json.success) {
                setSettlements(json.data || []);
            }
        } catch (e) {
            console.error("Failed to fetch settlements", e);
        }
    };

    const handleRevertSettlement = async (settlement: any) => {
        const sId = settlement.settlementId || settlement.id;
        const accNo = settlement.accrualNo || "accrual";
        if (!confirm(`Are you sure you want to revert/delete settlement for ${accNo}?\n\nThis will:\n• Restore the deducted physical stock to the warehouse\n• Delete the General Ledger Journal Entry\n• Revert the accrual status back to PENDING BILL`)) {
            return;
        }

        try {
            setIsReverting(true);
            const res = await authenticatedFetch(`/api/finance/production/accruals/settlements/${sId}`, {
                method: "DELETE"
            });
            const json = await res.json();
            if (json.success) {
                alert(json.message || "Settlement reverted successfully.");
                fetchRecord();
                fetchSettlements();
            } else {
                alert(json.error || "Failed to revert settlement.");
            }
        } catch (e: any) {
            alert(e.message || "Error occurred while reverting settlement.");
        } finally {
            setIsReverting(false);
        }
    };

    const openEditSettlementModal = (settlement: any) => {
        setEditingSettlement(settlement);
        setEditQty(settlement.qty || "");
        setEditRate(settlement.rate || "");
        setEditWarehouseId(settlement.warehouseId || (warehouses[0]?.id || ""));
        setEditProductId(settlement.productId || "");
        setEditDate(settlement.settlementDate || new Date().toISOString().split("T")[0]);
        setEditRemarks(settlement.remarks || "");
    };

    const handleSaveEditSettlement = async () => {
        if (!editingSettlement) return;
        const q = Number(editQty);
        const r = Number(editRate);
        if (q <= 0) {
            alert("Please enter a valid quantity greater than zero.");
            return;
        }

        try {
            setIsSavingEdit(true);
            const sId = editingSettlement.settlementId || editingSettlement.id;
            const res = await authenticatedFetch(`/api/finance/production/accruals/settlements/${sId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    qty: q,
                    rate: r,
                    productId: editProductId,
                    warehouseId: editWarehouseId,
                    settlementDate: editDate,
                    remarks: editRemarks
                })
            });
            const json = await res.json();
            if (json.success) {
                alert("Settlement updated successfully!");
                setEditingSettlement(null);
                fetchRecord();
                fetchSettlements();
            } else {
                alert(json.error || "Failed to update settlement.");
            }
        } catch (e: any) {
            alert(e.message || "Error saving settlement.");
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleSingleStockSettle = async () => {
        if (!selectedAccrualForStock) return;
        if (!stockSettleWarehouseId) {
            alert("Please select a target warehouse to deduct physical stock from.");
            return;
        }
        if (!stockSettleProductId) {
            alert("Please select a product/yarn from stock to deduct.");
            return;
        }

        try {
            setIsStockSettling(true);
            const res = await authenticatedFetch("/api/finance/production/accruals/settle-stock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    warehouseId: stockSettleWarehouseId,
                    date: stockSettleDate,
                    remarks: stockSettleRemarks || `Settled from stock for ${selectedAccrualForStock.accrualNo}`,
                    items: [
                        {
                            accrualId: selectedAccrualForStock.id,
                            productId: stockSettleProductId,
                            qty: Number(stockSettleQty) || Number(selectedAccrualForStock.qty),
                            rate: Number(stockSettleRate) || Number(selectedAccrualForStock.rate),
                            warehouseId: stockSettleWarehouseId
                        }
                    ]
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || "Accrual settled successfully against stock!");
                setSelectedAccrualForStock(null);
                fetchRecord();
            } else {
                alert(data.error || "Failed to settle accrual against stock.");
            }
        } catch (e: any) {
            alert(e.message || "Error occurred while settling stock.");
        } finally {
            setIsStockSettling(false);
        }
    };

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
            <div className="w-full max-w-[98%] 2xl:max-w-[1700px] mx-auto px-2 sm:px-4 space-y-8 animate-in fade-in duration-500 pb-20">
                
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
                    <div className="relative z-10 flex items-center gap-3">
                        <button 
                            onClick={() => router.push(`/finance/production/execution/${id}/edit`)}
                            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 text-xs uppercase tracking-wider hover:-translate-y-0.5"
                        >
                            <Edit2 size={15} />
                            Edit Batch
                        </button>
                    </div>
                </div>

                {/* Output Summary Card */}
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-6 sm:p-8 shadow-inner shadow-indigo-500/5 relative overflow-hidden">
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-6 sm:gap-8 items-start">
                        <div className="md:col-span-2 space-y-2">
                            <h3 className="text-xs font-bold text-indigo-400/80 uppercase tracking-widest">Output Product</h3>
                            <div className="text-3xl font-black text-indigo-950 dark:text-indigo-50">{record.outputProduct?.name}</div>
                            <div className="text-sm text-indigo-800 dark:text-indigo-300 font-medium flex items-center gap-2">
                                <Package size={16} />
                                <span>{record.outputProduct?.category?.name || 'Uncategorized'}</span>
                                <span>•</span>
                                <span>{record.warehouse?.name || 'Main Warehouse'}</span>
                            </div>
                            {parsedSpecs && (
                                <div className="pt-2 flex flex-wrap items-center gap-2">
                                    {parsedSpecs.cleanBatchNo && (
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300">
                                            <FileText size={13} className="text-indigo-500" />
                                            <span>Batch #{parsedSpecs.cleanBatchNo}</span>
                                        </div>
                                    )}
                                    {parsedSpecs.cutSize && (
                                        <span className="px-2.5 py-1 rounded-xl bg-white/70 dark:bg-slate-800/80 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-xs">
                                            Cut: {parsedSpecs.cutSize} {parsedSpecs.cutUnit}/PC
                                        </span>
                                    )}
                                    {parsedSpecs.pieceWeightKg && (
                                        <span className="px-2.5 py-1 rounded-xl bg-white/70 dark:bg-slate-800/80 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-xs">
                                            Piece Wt: {parseFloat(parsedSpecs.pieceWeightKg).toFixed(4)} KG
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-indigo-400/80 uppercase tracking-widest mb-2">Quantity Produced</h3>
                            <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400 flex items-baseline gap-2">
                                <span>{Number(record.outputQuantity).toLocaleString()}</span>
                                <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{parsedSpecs?.outputUnit || record.outputProduct?.baseUnit?.code || 'Units'}</span>
                            </div>
                            {parsedSpecs?.netWeightKg && parsedSpecs.outputUnit !== "KG" && (
                                <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">
                                    <span>Export Fabric Weight:</span>
                                    <span className="font-extrabold text-emerald-800 dark:text-emerald-200">{parsedSpecs.netWeightKg.toLocaleString()} KG</span>
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-indigo-400/80 uppercase tracking-widest mb-2">Cost Per Unit</h3>
                            <div className="text-4xl font-black text-amber-600 dark:text-amber-400 flex items-baseline gap-1.5">
                                <span className="text-xl font-normal text-amber-600/70 dark:text-amber-400/70">Rs.</span>
                                <span>{(Number(record.totalCost) / Number(record.outputQuantity)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 3})}</span>
                                <span className="text-sm font-bold text-amber-600/80 dark:text-amber-400/80">/{parsedSpecs?.outputUnit || 'Unit'}</span>
                            </div>
                            {parsedSpecs?.netWeightKg && parsedSpecs.netWeightKg > 0 && parsedSpecs.outputUnit !== "KG" && (
                                <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
                                    <span>Cost / KG:</span>
                                    <span className="font-extrabold text-amber-800 dark:text-amber-200">
                                        Rs. {(Number(record.totalCost) / parsedSpecs.netWeightKg).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} / KG
                                    </span>
                                </div>
                            )}
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
                                            <th className="px-4 py-3 text-right">Rate</th>
                                            <th className="px-4 py-3 text-right">Cost Value</th>
                                            <th className="px-4 py-3 rounded-tr-xl text-center">Stage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {record.inputs.map((input: any) => (
                                            <React.Fragment key={input.id}>
                                                <tr className="border-b dark:border-slate-800 last:border-0 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                    <td className="px-4 py-4 font-bold text-slate-900 dark:text-slate-100 align-middle">
                                                        {input.product?.name}
                                                        {input.lotNumber && <div className="text-xs font-normal text-slate-400 mt-1">Lot: {input.lotNumber}</div>}
                                                    </td>
                                                    <td className="px-4 py-4 text-right font-medium align-middle">
                                                        {input.quantity} {input.product?.baseUnit?.code}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-slate-500 font-medium align-middle">
                                                        {(Number(input.costValue) / Number(input.quantity || 1)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-emerald-600 dark:text-emerald-400 font-bold align-middle">
                                                        {Number(input.costValue).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                    </td>
                                                    <td className="px-4 py-4 text-center align-middle">
                                                        {input.inputStage ? (
                                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs font-bold text-slate-500">{input.inputStage}</span>
                                                        ) : '-'}
                                                    </td>
                                                </tr>
                                                {input.hierarchy?.materials?.map((mat: any, idx: number) => (
                                                    <tr key={`mat-${input.id}-${idx}`} className="border-b dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50">
                                                        <td className="px-4 py-3 pl-8 text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                                            <span className="text-slate-300 dark:text-slate-600">└─</span>
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 uppercase tracking-wider">Material</span>
                                                            {mat.name}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                                                            {mat.quantity.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})} {mat.unit}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-sm text-slate-500">
                                                            {(mat.cost / (mat.quantity || 1)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                                                            {mat.cost.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-sm text-slate-500">
                                                            {mat.stage}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {input.hierarchy?.services?.map((svc: any, idx: number) => (
                                                    <tr key={`svc-${input.id}-${idx}`} className="border-b dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50">
                                                        <td className="px-4 py-3 pl-8 text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                                            <span className="text-slate-300 dark:text-slate-600">└─</span>
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-500/10 uppercase tracking-wider">Service</span>
                                                            {svc.name}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                                                            {svc.quantity ? `${svc.quantity.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})} ${svc.unit}` : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-sm text-slate-500">
                                                            {svc.quantity ? (svc.cost / svc.quantity).toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                                                            {svc.cost.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-sm text-slate-500">
                                                            -
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
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

                        {/* Production Accruals & Unbilled Liabilities (PAC) */}
                        {record.accruals && record.accruals.length > 0 && (
                            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-amber-500/20 dark:border-amber-500/30 p-8 shadow-sm">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <Clock className="text-amber-500" />
                                            Accrued Liabilities & Unbilled Purchases (PAC)
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Pending liabilities booked to GL (Accrued Expenses). Ready for FIFO Purchase Invoice settlement.
                                        </p>
                                    </div>
                                    <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 w-fit">
                                        {record.accruals.length} Accrual(s) Booked
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-300">
                                            <tr>
                                                <th className="px-4 py-3 rounded-tl-xl">Accrual #</th>
                                                <th className="px-4 py-3">Stage / Service</th>
                                                <th className="px-4 py-3">Product / Supplier</th>
                                                <th className="px-4 py-3 text-right">Quantity</th>
                                                <th className="px-4 py-3 text-right">Est. Rate</th>
                                                <th className="px-4 py-3 text-right">Accrued Amount</th>
                                                <th className="px-4 py-3 text-center">Status</th>
                                                <th className="px-4 py-3 text-center rounded-tr-xl">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {record.accruals.map((acc: any) => {
                                                let stageBadge = "🎨 FINISH";
                                                if (acc.stage === "RAW" || acc.serviceType === "RAW_YARN") stageBadge = "🧶 RAW YARN";
                                                else if (acc.stage === "GREY" || acc.serviceType === "WEAVING" || acc.serviceType === "KNITTING") stageBadge = `🧵 ${acc.serviceType || 'WEAVING'}`;

                                                const isPending = acc.status === "PENDING";
                                                return (
                                                    <tr key={acc.id} className="border-b dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                        <td className="px-4 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                            {acc.accrualNo}
                                                        </td>
                                                        <td className="px-4 py-4 font-bold text-xs text-slate-700 dark:text-slate-300">
                                                            <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                                {stageBadge}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="font-semibold text-slate-900 dark:text-slate-100">{acc.Product?.name || 'Raw Material / Service'}</div>
                                                            <div className="text-xs text-slate-400">{acc.Supplier?.name || 'Pending Vendor Assignment'}</div>
                                                            {acc.billRef && (
                                                                <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                                    <span>Bill Ref: {acc.billRef}</span>
                                                                    {acc.billDate && <span>({acc.billDate})</span>}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4 text-right font-medium">
                                                            {Number(acc.qty).toLocaleString()} {acc.Unit?.code || 'KG'}
                                                        </td>
                                                        <td className="px-4 py-4 text-right text-slate-500 font-medium">
                                                            Rs. {Number(acc.rate).toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-4 text-right text-amber-600 dark:text-amber-400 font-bold">
                                                            Rs. {Number(acc.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            {isPending ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                                                    <Clock size={11} /> PENDING BILL
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                                                    <CheckCircle2 size={11} /> BILLED
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            {(() => {
                                                                const linkedSettlement = settlements.find(s => s.accrualId === acc.id || s.accrualNo === acc.accrualNo);
                                                                return (
                                                                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                                                                        {/* If Pending or Partial, allow settling remaining */}
                                                                        {(isPending || acc.status === "PARTIALLY_BILLED") && (
                                                                            <>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setSelectedAccrualForStock(acc);
                                                                                        setStockSettleProductId(acc.productId || (products[0]?.id || ""));
                                                                                        const rem = Math.max(0, Number(acc.qty) - Number(acc.billedQty || 0));
                                                                                        setStockSettleQty(rem > 0 ? rem : acc.qty);
                                                                                        setStockSettleRate(acc.rate || "");
                                                                                        if (warehouses.length > 0 && !stockSettleWarehouseId) {
                                                                                            setStockSettleWarehouseId(warehouses[0].id);
                                                                                        }
                                                                                    }}
                                                                                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 transition-all shadow-sm"
                                                                                    title="Settle against physical warehouse stock"
                                                                                >
                                                                                    <Package size={12} />
                                                                                    <span>Settle Stock</span>
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => router.push(`/finance/purchase/invoices/new?sourceType=PRODUCTION&accrualId=${acc.id}`)}
                                                                                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1 transition-all shadow-sm"
                                                                                    title="Bill in Purchase Invoice"
                                                                                >
                                                                                    <DollarSign size={12} />
                                                                                    <span>Bill Vendor</span>
                                                                                </button>
                                                                            </>
                                                                        )}

                                                                        {/* If Settled (Billed or Partially Billed), allow CRUD: View, Edit, Revert */}
                                                                        {linkedSettlement && (
                                                                            <>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setViewingSettlement(linkedSettlement)}
                                                                                    className="px-2 py-1 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 transition-all shadow-sm"
                                                                                    title="View Settlement & GL Voucher"
                                                                                >
                                                                                    <Eye size={12} />
                                                                                    <span>View</span>
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => openEditSettlementModal(linkedSettlement)}
                                                                                    className="px-2 py-1 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1 transition-all shadow-sm"
                                                                                    title="Edit Settlement (Qty / Rate / Warehouse)"
                                                                                >
                                                                                    <Edit2 size={12} />
                                                                                    <span>Edit</span>
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={isReverting}
                                                                                    onClick={() => handleRevertSettlement(linkedSettlement)}
                                                                                    className="px-2 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1 transition-all shadow-sm disabled:opacity-50"
                                                                                    title="Revert / Delete Settlement (Restores stock to warehouse & returns to Pending)"
                                                                                >
                                                                                    <Trash2 size={12} />
                                                                                    <span>Revert</span>
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                        {!isPending && !linkedSettlement && (
                                                                            <span className="text-xs text-slate-400 font-semibold italic">Settled in Invoice</span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
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
                                <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs font-mono">
                                    <div className="flex justify-between items-center text-slate-400">
                                        <span>Unit Cost ({parsedSpecs?.outputUnit || 'Unit'}):</span>
                                        <span className="font-bold text-amber-400">
                                            Rs. {(Number(record.totalCost) / Number(record.outputQuantity)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 3})}
                                        </span>
                                    </div>
                                    {parsedSpecs?.netWeightKg && parsedSpecs.outputUnit !== "KG" && (
                                        <div className="flex justify-between items-center text-slate-400">
                                            <span>Fabric Weight Cost:</span>
                                            <span className="font-bold text-emerald-400">
                                                Rs. {(Number(record.totalCost) / parsedSpecs.netWeightKg).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} / KG
                                            </span>
                                        </div>
                                    )}
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

            {/* Settle Single Accrual Against Warehouse Stock Modal */}
            {selectedAccrualForStock && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black">
                                    <Package size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                        Settle Accrual from Stock
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Accrual #{selectedAccrualForStock.accrualNo} • {selectedAccrualForStock.stage || 'STAGE'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedAccrualForStock(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            {/* Accrual Details Card */}
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-bold uppercase">Product / Material:</span>
                                    <span className="font-black text-slate-900 dark:text-white">{selectedAccrualForStock.Product?.name || 'Raw Material'}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-bold uppercase">Pending Quantity:</span>
                                    <span className="font-black text-emerald-600 dark:text-emerald-400">{Number(selectedAccrualForStock.qty).toLocaleString()} {selectedAccrualForStock.Unit?.code || 'KG'}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-bold uppercase">Total Booked Value:</span>
                                    <span className="font-black text-slate-900 dark:text-white">Rs. {Number(selectedAccrualForStock.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            {/* Inputs */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Physical Stock Item to Deduct (Change Yarn / Material) *
                                    </label>
                                    <select
                                        value={stockSettleProductId}
                                        onChange={(e) => {
                                            setStockSettleProductId(e.target.value);
                                            const p = products.find(prod => prod.id === e.target.value);
                                            if (p && (p.purchasePrice || p.standardCost)) {
                                                setStockSettleRate(p.purchasePrice || p.standardCost);
                                            }
                                        }}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value="">Select Yarn / Material from Stock...</option>
                                        {products
                                            .slice()
                                            .sort((a, b) => {
                                                const isYarn = selectedAccrualForStock.stage === "RAW" || selectedAccrualForStock.serviceType === "RAW_YARN";
                                                if (isYarn) {
                                                    const aY = a.name.includes('YARN') || a.name.includes('DTY') || a.name.includes('FDY');
                                                    const bY = b.name.includes('YARN') || b.name.includes('DTY') || b.name.includes('FDY');
                                                    if (aY && !bY) return -1;
                                                    if (!aY && bY) return 1;
                                                }
                                                return a.name.localeCompare(b.name);
                                            })
                                            .map((p: any) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({p.code}){p.hsCode ? ` • HS: ${p.hsCode}` : ''}
                                                </option>
                                            ))
                                        }
                                    </select>
                                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                                        ✓ Physical stock of this selected product will be deducted from your warehouse.
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                            Settle Quantity ({selectedAccrualForStock.Unit?.code || 'KG'}) *
                                        </label>
                                        <input
                                            type="number"
                                            value={stockSettleQty}
                                            onChange={(e) => setStockSettleQty(e.target.value)}
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                            Stock Cost Rate (PKR) *
                                        </label>
                                        <input
                                            type="number"
                                            value={stockSettleRate}
                                            onChange={(e) => setStockSettleRate(e.target.value)}
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Target Warehouse (Physical Stock Deduction) *
                                    </label>
                                    <select
                                        value={stockSettleWarehouseId}
                                        onChange={(e) => setStockSettleWarehouseId(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value="">Choose Warehouse...</option>
                                        {warehouses.map((w: any) => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Settlement Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={stockSettleDate}
                                        onChange={(e) => setStockSettleDate(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Remarks (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={stockSettleRemarks}
                                        onChange={(e) => setStockSettleRemarks(e.target.value)}
                                        placeholder="e.g. Settle accrual against warehouse stock..."
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            {/* Accounting Note */}
                            <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300">
                                <p className="font-bold flex items-center gap-1">
                                    <CheckCircle2 size={13} className="shrink-0" />
                                    <span>Automatic Stock & GL Accounting:</span>
                                </p>
                                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                                    Stock will be issued (<code className="font-mono">StockLedger Out</code>) from the selected warehouse, and general ledger will debit <code className="font-mono">Accrued Liabilities (2130)</code> and credit <code className="font-mono">Raw Material Inventory (1310)</code>.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                disabled={isStockSettling}
                                onClick={() => setSelectedAccrualForStock(null)}
                                className="px-4 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs uppercase tracking-wider"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isStockSettling || !stockSettleWarehouseId}
                                onClick={handleSingleStockSettle}
                                className="px-5 py-2.5 rounded-xl font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/20 transition-all text-xs uppercase tracking-wider flex items-center gap-2"
                            >
                                {isStockSettling ? (
                                    <>
                                        <Sparkles size={14} className="animate-spin" />
                                        <span>Settling...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={14} />
                                        <span>Confirm Stock Settlement</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Settlement Modal */}
            {viewingSettlement && (
                <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black">
                                    <Eye size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                        Settlement Details
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Accrual #{viewingSettlement.accrualNo} • {viewingSettlement.settlementType === 'STOCK' ? 'Warehouse Stock Deduction' : 'Vendor Bill'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewingSettlement(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            {/* Summary Card */}
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 space-y-2.5">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-bold uppercase">Product / Material:</span>
                                    <span className="font-black text-slate-900 dark:text-white">{viewingSettlement.productName}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-bold uppercase">Deduction Warehouse:</span>
                                    <span className="font-black text-slate-900 dark:text-white">{viewingSettlement.warehouseName}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-bold uppercase">Settled Quantity:</span>
                                    <span className="font-black text-emerald-600 dark:text-emerald-400">{Number(viewingSettlement.qty).toLocaleString()} KG</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-bold uppercase">Settlement Cost Rate:</span>
                                    <span className="font-black text-slate-900 dark:text-white">Rs. {Number(viewingSettlement.rate).toFixed(2)} / KG</span>
                                </div>
                                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                                    <span className="text-slate-500 font-black uppercase">Total Settlement Value:</span>
                                    <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">Rs. {Number(viewingSettlement.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-bold uppercase">Settlement Date:</span>
                                    <span className="font-mono text-slate-700 dark:text-slate-300">{viewingSettlement.settlementDate}</span>
                                </div>
                                {viewingSettlement.remarks && (
                                    <div className="text-xs pt-1 border-t border-slate-200 dark:border-slate-700 text-slate-500">
                                        <span className="font-bold">Remarks:</span> {viewingSettlement.remarks}
                                    </div>
                                )}
                            </div>

                            {/* Accounting Journal Entry (GL) */}
                            {viewingSettlement.journalEntry ? (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <FileText size={14} className="text-indigo-500" />
                                            General Ledger Voucher
                                        </span>
                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                                            {viewingSettlement.journalEntry.number}
                                        </span>
                                    </div>

                                    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase font-black text-[10px]">
                                                <tr>
                                                    <th className="p-2.5">Account</th>
                                                    <th className="p-2.5 text-right">Debit (PKR)</th>
                                                    <th className="p-2.5 text-right">Credit (PKR)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {viewingSettlement.journalEntry.lines.map((l: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                        <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                                                            <div>{l.accountName}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">{l.accountCode}</div>
                                                        </td>
                                                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                            {l.debit > 0 ? Number(l.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                                        </td>
                                                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                            {l.credit > 0 ? Number(l.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400 italic text-center py-2">
                                    No direct GL journal entry (Cleared via Purchase Invoice).
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <button
                                type="button"
                                disabled={isReverting}
                                onClick={() => {
                                    setViewingSettlement(null);
                                    handleRevertSettlement(viewingSettlement);
                                }}
                                className="px-4 py-2 rounded-xl font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 transition-colors text-xs uppercase tracking-wider flex items-center gap-1.5"
                            >
                                <Trash2 size={14} />
                                <span>Revert Settlement</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewingSettlement(null)}
                                className="px-5 py-2.5 rounded-xl font-black text-white bg-slate-800 hover:bg-slate-700 transition-all text-xs uppercase tracking-wider"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Settlement Modal */}
            {editingSettlement && (
                <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black">
                                    <Edit2 size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                        Edit Settlement
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Accrual #{editingSettlement.accrualNo} • Modify quantity, rate or warehouse
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingSettlement(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Physical Product / Material *
                                </label>
                                <select
                                    value={editProductId}
                                    onChange={(e) => setEditProductId(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    {products.map((p: any) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.code}){p.hsCode ? ` • HS: ${p.hsCode}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Settled Quantity (KG) *
                                    </label>
                                    <input
                                        type="number"
                                        value={editQty}
                                        onChange={(e) => setEditQty(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Stock Cost Rate (PKR) *
                                    </label>
                                    <input
                                        type="number"
                                        value={editRate}
                                        onChange={(e) => setEditRate(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Deduction Warehouse *
                                    </label>
                                    <select
                                        value={editWarehouseId}
                                        onChange={(e) => setEditWarehouseId(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                                    >
                                        {warehouses.map((w: any) => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Settlement Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={editDate}
                                        onChange={(e) => setEditDate(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Remarks / Notes
                                </label>
                                <input
                                    type="text"
                                    value={editRemarks}
                                    onChange={(e) => setEditRemarks(e.target.value)}
                                    placeholder="Optional settlement note..."
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
                                <p className="font-bold flex items-center gap-1">
                                    <Sparkles size={13} className="shrink-0" />
                                    <span>Syncs Warehouse & Accounting:</span>
                                </p>
                                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                                    Updating will adjust the physical inventory deduction (<code className="font-mono">StockLedger</code>), recalibrate the General Ledger entry, and recalculate unbilled accrual balances.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                disabled={isSavingEdit}
                                onClick={() => setEditingSettlement(null)}
                                className="px-4 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs uppercase tracking-wider"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isSavingEdit}
                                onClick={handleSaveEditSettlement}
                                className="px-5 py-2.5 rounded-xl font-black text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-md shadow-amber-500/20 transition-all text-xs uppercase tracking-wider flex items-center gap-2"
                            >
                                {isSavingEdit ? (
                                    <>
                                        <Sparkles size={14} className="animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={14} />
                                        <span>Save Changes</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
