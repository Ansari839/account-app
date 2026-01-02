"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function GRNPage() {
    const router = useRouter();
    const [grns, setGrns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form Data
    const [formData, setFormData] = useState<any>({
        poId: '',
        supplierId: '',
        warehouseId: '',
        date: new Date().toISOString().split('T')[0],
        items: []
    });

    const [pos, setPos] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [selectedPO, setSelectedPO] = useState<any>(null);

    useEffect(() => {
        fetchGRNs();
        fetchOpenPOs();
        fetchWarehouses();
    }, []);

    const fetchWarehouses = async () => {
        try {
            const res = await authenticatedFetch('/api/inventory/warehouses');
            const json = await res.json();
            if (json.success) setWarehouses(json.data);
        } catch (e) { console.error(e); }
    };

    const fetchGRNs = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch('/api/finance/purchase/grn');
            const json = await res.json();
            if (json.success) setGrns(json.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const fetchOpenPOs = async () => {
        try {
            const res = await authenticatedFetch('/api/finance/purchase/orders?status=OPEN');
            const json = await res.json();
            if (json.success) setPos(json.data);
        } catch (e) { console.error(e); }
    };

    const handleSelectPO = (poId: string) => {
        const po = pos.find(p => p.id === poId);
        if (!po) return;

        setSelectedPO(po);
        setFormData({
            ...formData,
            poId: po.id,
            supplierId: po.supplierId,
            warehouseId: po.warehouseId || '', // Inherit if available
            items: po.items.map((item: any) => ({
                productId: item.productId,
                productName: item.product?.name,
                poItemId: item.id,
                qtyOrdered: item.qty,
                qtyReceivedPrior: item.receivedQty || 0,
                qtyReceived: Math.max(0, item.qty - (item.receivedQty || 0)), // Default to remaining
                qtyRejected: 0
            }))
        });
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormData({ ...formData, items: newItems });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await authenticatedFetch('/api/finance/purchase/grn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (res.ok) {
            setIsModalOpen(false);
            setFormData({ poId: '', supplierId: '', warehouseId: '', date: new Date().toISOString().split('T')[0], items: [] });
            setSelectedPO(null);
            fetchGRNs();
            fetchOpenPOs(); // Refresh POs as status may change
        } else {
            const json = await res.json();
            alert(json.error || "Failed to create GRN");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this GRN? This will revert stock and PO fulfillment status.")) return;

        try {
            const res = await authenticatedFetch(`/api/finance/purchase/grn/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchGRNs();
                fetchOpenPOs();
            } else {
                const json = await res.json();
                alert(json.error || "Failed to delete GRN");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const columns: Column<any>[] = [
        { header: 'GRN #', accessor: 'grnNo' },
        { header: 'Date', accessor: (row) => format(new Date(row.date), 'dd/MM/yyyy') },
        { header: 'PO #', accessor: (row) => row.po?.poNo || '-' },
        { header: 'Supplier', accessor: (row) => row.supplier?.name },
        { header: 'Warehouse', accessor: (row) => row.warehouse?.name },
        {
            header: 'Items Rec.',
            accessor: (row) => row.items?.length || 0
        },
        {
            header: 'Actions',
            accessor: (row) => (
                <div className="flex gap-2">
                    <button
                        onClick={() => router.push(`/finance/purchase/grn/${row.id}`)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                        title="View/Print"
                    >
                        👁
                    </button>
                    <button
                        onClick={() => handleDelete(row.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        title="Delete"
                    >
                        ✕
                    </button>
                </div>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Goods Received Notes (GRN)</h1>
                    <p className="text-slate-500">Track inventory received against Purchase Orders.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold"
                >
                    + New GRN
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <DataTable
                    data={grns}
                    columns={columns}
                    isLoading={loading}
                />
            </div>

            {/* CREATE MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-900 w-[900px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
                            <h2 className="text-xl font-bold">New GRN</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* HEADER */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1">Select Purchase Order</label>
                                    <select
                                        className="w-full p-2 border rounded-lg dark:bg-slate-800"
                                        required
                                        value={formData.poId}
                                        onChange={e => handleSelectPO(e.target.value)}
                                    >
                                        <option value="">Select PO</option>
                                        {pos.map(p => <option key={p.id} value={p.id}>{p.poNo} - {p.supplier?.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1">Date</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-lg dark:bg-slate-800"
                                        required
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            {selectedPO && (
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Supplier</p>
                                        <p className="font-bold text-slate-700 dark:text-slate-200">{selectedPO.supplier?.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Select Warehouse</p>
                                        <select
                                            className="w-full p-2 border rounded-lg dark:bg-slate-800 bg-white font-bold"
                                            required
                                            value={formData.warehouseId}
                                            onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}
                                        >
                                            <option value="">Choose Warehouse</option>
                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* ITEMS */}
                            <div>
                                <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Receive Items</h3>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                                        <tr>
                                            <th className="p-3">Product</th>
                                            <th className="p-3">Ordered</th>
                                            <th className="p-3">Prev. Rec</th>
                                            <th className="p-3 w-32">Receive Now</th>
                                            <th className="p-3 w-32">Rejected</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {formData.items.map((item: any, i: number) => (
                                            <tr key={i} className={item.qtyReceived > 0 ? 'bg-indigo-50/10' : ''}>
                                                <td className="p-2">
                                                    <span className="font-medium">{item.productName}</span>
                                                </td>
                                                <td className="p-2 opacity-70">{item.qtyOrdered}</td>
                                                <td className="p-2 opacity-70">{item.qtyReceivedPrior}</td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        className="w-full p-2 border rounded dark:bg-slate-800 font-bold text-indigo-600"
                                                        value={item.qtyReceived}
                                                        onChange={e => updateItem(i, 'qtyReceived', parseFloat(e.target.value))}
                                                        min="0"
                                                        max={item.qtyOrdered - item.qtyReceivedPrior}
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        className="w-full p-2 border rounded dark:bg-slate-800 text-red-500"
                                                        value={item.qtyRejected}
                                                        onChange={e => updateItem(i, 'qtyRejected', parseFloat(e.target.value))}
                                                        min="0"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:shadow-indigo-500/30">Create GRN</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
