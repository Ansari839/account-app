"use client";

import React, { useEffect, useState, use } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { 
    Package, 
    ArrowLeft, 
    Pencil, 
    Trash2, 
    Layers, 
    Scale, 
    Tag, 
    Building2, 
    Boxes, 
    CheckCircle2, 
    XCircle, 
    Warehouse, 
    TrendingUp, 
    FileText,
    Loader2,
    Calendar,
    Hash,
    ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/context/NotificationContext';

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);
    const { showNotification } = useNotifications();

    const [product, setProduct] = useState<any>(null);
    const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [ledgerLoading, setLedgerLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'variants'>('overview');

    useEffect(() => {
        fetchProduct();
        fetchStockLedger();
    }, [id]);

    const fetchProduct = async () => {
        try {
            const res = await authenticatedFetch(`/api/inventory/products/${id}`);
            const json = await res.json();
            if (json.success && json.data) {
                setProduct(json.data);
            } else {
                showNotification('error', json.error || 'Failed to load product details.');
            }
        } catch (e: any) {
            console.error('Failed to load product:', e);
            showNotification('error', 'Network error loading product details.');
        } finally {
            setLoading(false);
        }
    };

    const fetchStockLedger = async () => {
        try {
            setLedgerLoading(true);
            const res = await authenticatedFetch(`/api/finance/reports/stock-ledger?productId=${id}`);
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                setLedgerEntries(json.data);
            }
        } catch (e) {
            console.warn('Could not load stock ledger:', e);
        } finally {
            setLedgerLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete product "${product?.name}" (${product?.code})?`)) return;

        try {
            const res = await authenticatedFetch(`/api/inventory/products/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (res.ok && json.success) {
                showNotification('success', 'Product deleted successfully.');
                router.push('/inventory/products');
            } else {
                showNotification('error', json.error || 'Failed to delete product.');
            }
        } catch (e) {
            showNotification('error', 'Error deleting product.');
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                    <p className="text-sm font-semibold text-slate-500 tracking-wide">Loading product details...</p>
                </div>
            </MainLayout>
        );
    }

    if (!product) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
                    <div className="p-4 rounded-full bg-rose-500/10 text-rose-500">
                        <ShieldAlert size={48} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white">Product Not Found</h2>
                    <p className="text-sm text-slate-500 max-w-md">
                        The requested product ID does not exist or has been removed.
                    </p>
                    <button 
                        onClick={() => router.push('/inventory/products')} 
                        className="mt-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all"
                    >
                        Back to Products
                    </button>
                </div>
            </MainLayout>
        );
    }

    // Calculate current stock balance from stock ledger
    const totalQtyIn = ledgerEntries.reduce((sum, e) => sum + (Number(e.qtyIn) || 0), 0);
    const totalQtyOut = ledgerEntries.reduce((sum, e) => sum + (Number(e.qtyOut) || 0), 0);
    const currentStockBalance = ledgerEntries.length > 0 
        ? (totalQtyIn - totalQtyOut) 
        : (Number(product.openingStock) || 0);

    // Group by warehouse
    const warehouseStockMap: { [whName: string]: number } = {};
    ledgerEntries.forEach(entry => {
        const whName = entry.warehouse?.name || 'Main Warehouse';
        const net = (Number(entry.qtyIn) || 0) - (Number(entry.qtyOut) || 0);
        warehouseStockMap[whName] = (warehouseStockMap[whName] || 0) + net;
    });

    return (
        <MainLayout>
            <div className="w-full max-w-[98%] 2xl:max-w-[1700px] mx-auto px-2 sm:px-4 space-y-6 pb-20 animate-in fade-in duration-300">
                
                {/* Top Action Bar */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => router.push('/inventory/products')}
                            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
                            title="Back to Products"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-indigo-500 bg-indigo-500/10 px-2.5 py-0.5 rounded-lg border border-indigo-500/20">
                                    {product.code || 'NO-CODE'}
                                </span>
                                {product.isService ? (
                                    <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-lg border border-purple-500/20">
                                        SERVICE / JOB WORK
                                    </span>
                                ) : (
                                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                                        PHYSICAL PRODUCT
                                    </span>
                                )}
                                {product.stage && (
                                    <span className="text-xs font-bold text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-lg border border-sky-500/20">
                                        STAGE: {product.stage}
                                    </span>
                                )}
                                {product.hsCode && (
                                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                                        HS: {product.hsCode}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1.5 flex items-center gap-3 tracking-tight">
                                <Package className="w-7 h-7 text-indigo-500" />
                                {product.name}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={() => router.push(`/inventory/products/${id}/edit`)}
                            className="flex-1 md:flex-none px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-sm transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2"
                        >
                            <Pencil size={15} /> Edit Product
                        </button>
                        <button
                            onClick={handleDelete}
                            className="p-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-colors shadow-sm"
                            title="Delete Product"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>

                {/* KPI Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Stock Balance Card */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Stock</span>
                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                                <Boxes size={18} />
                            </div>
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white">
                            {currentStockBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                            <span className="text-sm font-semibold text-slate-400 ml-2">
                                {product.baseUnit?.code || product.Unit?.code || 'Units'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-2 font-medium">
                            {product.isService ? 'Service / Non-inventoried item' : 'Total available across warehouses'}
                        </p>
                    </div>

                    {/* Unit & Measure */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Base Unit</span>
                            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                                <Scale size={18} />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {product.baseUnit?.name || product.Unit?.name || 'Standard'}
                        </div>
                        <p className="text-xs font-mono font-bold text-indigo-400 mt-2">
                            Symbol: {product.baseUnit?.code || product.Unit?.code || 'N/A'}
                        </p>
                    </div>

                    {/* Category & Classification */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Category</span>
                            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
                                <Tag size={18} />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white truncate">
                            {product.category?.name || product.Category?.name || 'Uncategorized'}
                        </div>
                        <p className="text-xs text-slate-500 mt-2 font-medium">
                            Stage: {product.stage || 'General'}
                        </p>
                    </div>

                    {/* HS Code */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">HS / Tariff Code</span>
                            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                                <Hash size={18} />
                            </div>
                        </div>
                        <div className="text-2xl font-mono font-black text-slate-900 dark:text-white">
                            {product.hsCode || 'Not Set'}
                        </div>
                        <p className="text-xs text-slate-500 mt-2 font-medium">
                            {product.hsCode ? 'FBR Tariff Classified' : 'No HS Code assigned'}
                        </p>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={cn(
                            "px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2",
                            activeTab === 'overview' 
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" 
                                : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                    >
                        <FileText size={16} /> Overview & Accounting
                    </button>
                    <button
                        onClick={() => setActiveTab('ledger')}
                        className={cn(
                            "px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2",
                            activeTab === 'ledger' 
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" 
                                : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                    >
                        <TrendingUp size={16} /> Stock Movements ({ledgerEntries.length})
                    </button>
                    {product.variants?.length > 0 && (
                        <button
                            onClick={() => setActiveTab('variants')}
                            className={cn(
                                "px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2",
                                activeTab === 'variants' 
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" 
                                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                            )}
                        >
                            <Layers size={16} /> Variants ({product.variants.length})
                        </button>
                    )}
                </div>

                {/* Tab 1: Overview & Configuration */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Capabilities & Operational Flags */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Boxes className="text-indigo-500" size={18} />
                                Operational Capabilities
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Can Be Sold</div>
                                    <div className="mt-1 flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white">
                                        {product.canBeSold ? (
                                            <><CheckCircle2 className="text-emerald-500" size={16} /> Yes (Sales Orders)</>
                                        ) : (
                                            <><XCircle className="text-slate-400" size={16} /> No</>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Can Be Purchased</div>
                                    <div className="mt-1 flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white">
                                        {product.canBePurchased ? (
                                            <><CheckCircle2 className="text-emerald-500" size={16} /> Yes (PO / GRN)</>
                                        ) : (
                                            <><XCircle className="text-slate-400" size={16} /> No</>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Is Manufactured</div>
                                    <div className="mt-1 flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white">
                                        {product.isManufactured ? (
                                            <><CheckCircle2 className="text-emerald-500" size={16} /> Yes (BOM / Production)</>
                                        ) : (
                                            <><XCircle className="text-slate-400" size={16} /> No</>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Service Mode</div>
                                    <div className="mt-1 flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white">
                                        {product.isService ? (
                                            <><CheckCircle2 className="text-purple-400" size={16} /> Service Item</>
                                        ) : (
                                            <><CheckCircle2 className="text-emerald-500" size={16} /> Physical Goods</>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Warehouse Breakdown */}
                            <div className="mt-6">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                                    <Warehouse size={14} /> Stock By Warehouse
                                </h4>
                                {Object.keys(warehouseStockMap).length > 0 ? (
                                    <div className="space-y-2">
                                        {Object.entries(warehouseStockMap).map(([wh, qty]) => (
                                            <div key={wh} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-sm">
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">{wh}</span>
                                                <span className="font-mono font-bold text-slate-900 dark:text-white">
                                                    {qty.toLocaleString()} {product.baseUnit?.code || ''}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 text-center text-xs text-slate-400">
                                        No warehouse stock movements recorded yet.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Chart of Accounts & Financial Linkages */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Building2 className="text-indigo-500" size={18} />
                                GL Accounting Linkages
                            </h3>
                            <div className="space-y-3">
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Inventory / Stock Account</div>
                                    <div className="mt-1 font-bold text-sm text-slate-900 dark:text-white">
                                        {product.inventoryAccount?.code ? (
                                            <span className="font-mono text-indigo-400 mr-2">{product.inventoryAccount.code}</span>
                                        ) : null}
                                        {product.inventoryAccount?.name || 'Default System Inventory Asset'}
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tax Code / Classification</div>
                                    <div className="mt-1 font-bold text-sm text-slate-900 dark:text-white">
                                        {product.taxCode?.name ? (
                                            <span className="text-emerald-400">{product.taxCode.name} ({Number(product.taxCode.rate || 0)}%)</span>
                                        ) : (
                                            <span className="text-slate-400">Standard Rate (No custom tax code)</span>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">System Record Timestamps</div>
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500 font-medium">
                                        <div>Created: {new Date(product.createdAt).toLocaleDateString()}</div>
                                        <div>Updated: {new Date(product.updatedAt).toLocaleDateString()}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 2: Stock Movements / Ledger */}
                {activeTab === 'ledger' && (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">Stock Movement Ledger</h3>
                                <p className="text-xs text-slate-400 mt-1">Audit trail of all receipts, issues, production records, and invoices</p>
                            </div>
                        </div>

                        {ledgerLoading ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-2">
                                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                                <span className="text-xs text-slate-400">Fetching stock transactions...</span>
                            </div>
                        ) : ledgerEntries.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 text-sm">
                                No stock ledger transactions recorded for this item yet.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black uppercase tracking-wider text-slate-400">
                                            <th className="py-3 px-4">Date</th>
                                            <th className="py-3 px-4">Type</th>
                                            <th className="py-3 px-4">Ref #</th>
                                            <th className="py-3 px-4">Warehouse</th>
                                            <th className="py-3 px-4 text-right">Inward</th>
                                            <th className="py-3 px-4 text-right">Outward</th>
                                            <th className="py-3 px-4 text-right">Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                                        {ledgerEntries.map((row, idx) => (
                                            <tr key={row.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                                                    {row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="font-bold text-xs px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                                        {row.refType || 'TRANSACTION'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-mono text-xs text-slate-500">
                                                    {row.refNo || row.refId || '-'}
                                                </td>
                                                <td className="py-3 px-4 text-slate-700 dark:text-slate-300 text-xs">
                                                    {row.warehouse?.name || 'Main Warehouse'}
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono font-bold text-emerald-500">
                                                    {Number(row.qtyIn) > 0 ? `+${Number(row.qtyIn).toLocaleString()}` : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono font-bold text-rose-500">
                                                    {Number(row.qtyOut) > 0 ? `-${Number(row.qtyOut).toLocaleString()}` : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono text-xs text-slate-400">
                                                    {Number(row.costRate) > 0 ? `Rs. ${Number(row.costRate).toLocaleString()}` : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 3: Variants */}
                {activeTab === 'variants' && product.variants?.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">Product Variants</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {product.variants.map((v: any) => (
                                <div key={v.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                                    <div className="font-bold text-slate-900 dark:text-white">{v.name}</div>
                                    <div className="text-xs font-mono text-slate-400 mt-1">SKU: {v.sku}</div>
                                    <div className="text-sm font-bold text-indigo-400 mt-2">Rs. {Number(v.price || 0).toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </MainLayout>
    );
}
