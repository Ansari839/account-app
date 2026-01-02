"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function PurchaseOrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form Data
    const [formData, setFormData] = useState<any>({
        supplierId: '',
        warehouseId: '',
        date: new Date().toISOString().split('T')[0],
        expectedDate: '',
        items: []
    });

    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);

    useEffect(() => {
        fetchOrders();
        fetchDropdowns();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch('/api/finance/purchase/orders');
            const json = await res.json();
            if (json.success) setOrders(json.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const fetchDropdowns = async () => {
        try {
            const [supRes, whRes, prodRes] = await Promise.all([
                authenticatedFetch('/api/finance/parties/suppliers'),
                authenticatedFetch('/api/inventory/warehouses'),
                authenticatedFetch('/api/inventory/products')
            ]);

            if (supRes.ok) setSuppliers((await supRes.json()).data);
            if (whRes.ok) setWarehouses((await whRes.json()).data);
            if (prodRes.ok) setProducts((await prodRes.json()).data);
        } catch (e) { console.error(e); }
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { productId: '', qty: 1, rate: 0, total: 0 }]
        });
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };

        // Auto-calc total
        if (field === 'qty' || field === 'rate') {
            newItems[index].total = newItems[index].qty * newItems[index].rate;
        }

        // Auto-fill rate from product if needed
        if (field === 'productId') {
            const prod = products.find(p => p.id === value);
            // newItems[index].rate = prod?.costPrice || 0; // If we had cost price
        }

        setFormData({ ...formData, items: newItems });
    };

    const removeItem = (index: number) => {
        const newItems = [...formData.items];
        newItems.splice(index, 1);
        setFormData({ ...formData, items: newItems });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await authenticatedFetch('/api/finance/purchase/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (res.ok) {
            setIsModalOpen(false);
            setFormData({ supplierId: '', warehouseId: '', date: new Date().toISOString().split('T')[0], items: [] });
            fetchOrders();
        } else {
            alert("Failed to create PO");
        }
    };

    const columns: Column<any>[] = [
        { header: 'PO #', accessor: 'poNo' },
        { header: 'Date', accessor: (row) => format(new Date(row.date), 'dd/MM/yyyy') },
        { header: 'Supplier', accessor: (row) => row.supplier?.name },
        { header: 'Warehouse', accessor: (row) => row.warehouse?.name },
        { header: 'Amount', accessor: (row) => row.totalAmount },
        {
            header: 'Status',
            accessor: (row) => (
                <span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'CLOSED' ? 'bg-green-100 text-green-700' :
                        row.status === 'OPEN' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                    }`}>
                    {row.status}
                </span>
            )
        },
        {
            header: 'Progress',
            accessor: (row) => {
                // Calculate simplistic progress
                // In real app, sum items
                return (
                    <div className="flex flex-col gap-1 text-[10px]">
                        <div className="flex justify-between">
                            <span>Rec:</span>
                            <span className="font-mono">--%</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Inv:</span>
                            <span className="font-mono">--%</span>
                        </div>
                    </div>
                );
            }
        },
        {
            header: 'Actions',
            accessor: (row) => (
                <button onClick={() => router.push(`/finance/purchase/orders/${row.id}`)} className="text-indigo-600 font-medium hover:underline">
                    View
                </button>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Purchase Orders</h1>
                    <p className="text-slate-500">Create and manage orders to suppliers.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold"
                >
                    + New Order
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <DataTable
                    data={orders}
                    columns={columns}
                    isLoading={loading}
                />
            </div>

            {/* CREATE MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-900 w-[900px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
                            <h2 className="text-xl font-bold">New Purchase Order</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* HEADER */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1">Supplier</label>
                                    <select
                                        className="w-full p-2 border rounded-lg dark:bg-slate-800"
                                        required
                                        value={formData.supplierId}
                                        onChange={e => setFormData({ ...formData, supplierId: e.target.value })}
                                    >
                                        <option value="">Select Supplier</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1">Warehouse</label>
                                    <select
                                        className="w-full p-2 border rounded-lg dark:bg-slate-800"
                                        required
                                        value={formData.warehouseId}
                                        onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}
                                    >
                                        <option value="">Select Warehouse</option>
                                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
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

                            {/* ITEMS */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-slate-700 dark:text-slate-300">Items</h3>
                                    <button type="button" onClick={addItem} className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1 rounded font-bold hover:bg-indigo-100">
                                        + Add Item
                                    </button>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                                        <tr>
                                            <th className="p-3">Product</th>
                                            <th className="p-3 w-32">Qty</th>
                                            <th className="p-3 w-32">Rate</th>
                                            <th className="p-3 w-32">Total</th>
                                            <th className="p-3 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {formData.items.map((item: any, i: number) => (
                                            <tr key={i}>
                                                <td className="p-2">
                                                    <select
                                                        className="w-full p-2 border rounded dark:bg-slate-800"
                                                        value={item.productId}
                                                        onChange={e => updateItem(i, 'productId', e.target.value)}
                                                        required
                                                    >
                                                        <option value="">Select Product</option>
                                                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        className="w-full p-2 border rounded dark:bg-slate-800"
                                                        value={item.qty}
                                                        onChange={e => updateItem(i, 'qty', parseFloat(e.target.value))}
                                                        min="1"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        className="w-full p-2 border rounded dark:bg-slate-800"
                                                        value={item.rate}
                                                        onChange={e => updateItem(i, 'rate', parseFloat(e.target.value))}
                                                        min="0"
                                                    />
                                                </td>
                                                <td className="p-2 font-mono text-right">
                                                    {item.total.toFixed(2)}
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button type="button" onClick={() => removeItem(i)} className="text-slate-400 hover:text-red-500">✕</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold">
                                        <tr>
                                            <td colSpan={3} className="p-3 text-right">Total Amount:</td>
                                            <td className="p-3 text-right">
                                                {formData.items.reduce((sum: number, item: any) => sum + (item.total || 0), 0).toFixed(2)}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:shadow-indigo-500/30">Save Order</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
