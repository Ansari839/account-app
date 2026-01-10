"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import Combobox from '@/components/Combobox';
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
        date: new Date().toISOString().split('T')[0],
        expectedDate: '',
        items: []
    });
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

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
            const [accRes, whRes, prodRes] = await Promise.all([
                authenticatedFetch('/api/accounts?type=LIABILITY&isPosting=true'), // Fetch Accounts Payable (Posting Only)
                authenticatedFetch('/api/inventory/warehouses'),
                authenticatedFetch('/api/inventory/products')
            ]);

            if (accRes.ok) {
                const response = await accRes.json();
                const accounts = response.accounts || response.data || [];
                setSuppliers(accounts);
            }
            if (whRes.ok) setWarehouses((await whRes.json()).data);
            if (prodRes.ok) setProducts((await prodRes.json()).data);
        } catch (e) { console.error(e); }
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { productId: '', qty: 1, rate: '', total: 0 }]
        });
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        let finalValue = value;

        if (field === 'qty' || field === 'rate') {
            finalValue = value === '' ? 0 : (typeof value === 'string' ? parseFloat(value) : value);
            if (isNaN(finalValue)) finalValue = 0;
        }

        newItems[index] = { ...newItems[index], [field]: finalValue };

        // Auto-calc total
        const q = Number(newItems[index].qty || 0);
        const r = Number(newItems[index].rate || 0);
        newItems[index].total = q * r;

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
        const url = isEditing ? `/api/finance/purchase/orders/${editingId}` : '/api/finance/purchase/orders';
        const method = isEditing ? 'PUT' : 'POST';

        const res = await authenticatedFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (res.ok) {
            setIsModalOpen(false);
            setIsEditing(false);
            setEditingId(null);
            setFormData({ supplierId: '', date: new Date().toISOString().split('T')[0], items: [] });
            fetchOrders();
        } else {
            const json = await res.json();
            alert(json.error || "Failed to save PO");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this PO?')) return;
        const res = await authenticatedFetch(`/api/finance/purchase/orders/${id}`, { method: 'DELETE' });
        if (res.ok) fetchOrders();
        else {
            const json = await res.json();
            alert(json.error || "Failed to delete");
        }
    };

    const openEdit = (order: any) => {
        setIsEditing(true);
        setEditingId(order.id);
        setFormData({
            supplierId: order.supplierId,
            date: format(new Date(order.date), 'yyyy-MM-dd'),
            expectedDate: order.expectedDate ? format(new Date(order.expectedDate), 'yyyy-MM-dd') : '',
            items: order.items.map((it: any) => ({
                id: it.id,
                productId: it.productId,
                qty: Number(it.qty),
                rate: Number(it.rate),
                total: Number(it.total),
                receivedQty: Number(it.receivedQty),
                invoicedQty: Number(it.invoicedQty)
            }))
        });
        setIsModalOpen(true);
    };

    const supplierOptions = suppliers.map(s => ({
        value: s.id,
        label: `${s.code} - ${s.name}`
    }));

    const columns: Column<any>[] = [
        { header: 'PO #', accessor: 'poNo' },
        { header: 'Date', accessor: (row) => format(new Date(row.date), 'dd/MM/yyyy') },
        { header: 'Supplier', accessor: (row) => row.supplier?.name },
        { header: 'Amount', accessor: (row) => Number(row.totalAmount).toLocaleString() },
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
                const totalQty = row.items.reduce((sum: number, it: any) => sum + Number(it.qty), 0);
                const recQty = row.items.reduce((sum: number, it: any) => sum + Number(it.receivedQty || 0), 0);
                const invQty = row.items.reduce((sum: number, it: any) => sum + Number(it.invoicedQty || 0), 0);

                const recPerc = totalQty > 0 ? Math.round((recQty / totalQty) * 100) : 0;
                const invPerc = totalQty > 0 ? Math.round((invQty / totalQty) * 100) : 0;

                return (
                    <div className="flex flex-col gap-1.5 w-24">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex justify-between text-[9px] uppercase font-bold text-slate-400">
                                <span>Rec</span>
                                <span>{recPerc}%</span>
                            </div>
                            <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${recPerc}%` }}></div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <div className="flex justify-between text-[9px] uppercase font-bold text-slate-400">
                                <span>Inv</span>
                                <span>{invPerc}%</span>
                            </div>
                            <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${invPerc}%` }}></div>
                            </div>
                        </div>
                    </div>
                );
            }
        },
        {
            header: 'Actions',
            accessor: (row) => (
                <div className="flex gap-2">
                    <button onClick={() => router.push(`/finance/purchase/orders/${row.id}`)} className="text-indigo-600 hover:text-indigo-800 p-1" title="View Detail">
                        👁
                    </button>
                    <button onClick={() => openEdit(row)} className="text-amber-600 hover:text-amber-800 p-1" title="Edit">
                        ✎
                    </button>
                    <button onClick={() => handleDelete(row.id)} className="text-rose-600 hover:text-rose-800 p-1" title="Delete">
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-slate-600 dark:text-slate-400">Account (Payable)</label>
                                    <Combobox
                                        options={supplierOptions}
                                        value={formData.supplierId}
                                        onChange={(val) => setFormData({ ...formData, supplierId: val })}
                                        placeholder="Select Account..."
                                        className="w-full"
                                        disabled={isEditing}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-slate-600 dark:text-slate-400">Order Date</label>
                                        <input
                                            type="date"
                                            className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl dark:bg-slate-800/50 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                            required
                                            value={formData.date}
                                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-slate-600 dark:text-slate-400">Exp. Delivery</label>
                                        <input
                                            type="date"
                                            className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl dark:bg-slate-800/50 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                            value={formData.expectedDate}
                                            onChange={e => setFormData({ ...formData, expectedDate: e.target.value })}
                                        />
                                    </div>
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
                                                        className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded dark:bg-slate-800"
                                                        value={item.qty === 0 ? '' : item.qty}
                                                        onChange={e => updateItem(i, 'qty', e.target.value)}
                                                        placeholder="0"
                                                        min="1"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded dark:bg-slate-800"
                                                        value={item.rate === 0 ? '' : item.rate}
                                                        onChange={e => updateItem(i, 'rate', e.target.value)}
                                                        placeholder="0.00"
                                                        min="0"
                                                    />
                                                </td>
                                                <td className="p-2 font-mono text-right font-bold text-slate-600">
                                                    {(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
