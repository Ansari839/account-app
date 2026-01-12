"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import Combobox from '@/components/Combobox';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function GRNPage() {
    const router = useRouter();
    const [grns, setGrns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState("");

    // Form Data
    const [formData, setFormData] = useState<any>({
        poId: '',
        supplierId: '',
        warehouseId: '',
        date: new Date().toISOString().split('T')[0],
        items: []
    });

    const [pos, setPos] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [selectedPO, setSelectedPO] = useState<any>(null);

    useEffect(() => {
        fetchGRNs();
        fetchOpenPOs();
        fetchDropdowns();
    }, []);

    const fetchDropdowns = async () => {
        try {
            const [supRes, accRes, whRes, prodRes, unitRes] = await Promise.all([
                authenticatedFetch('/api/finance/parties/suppliers'),
                authenticatedFetch('/api/accounts?type=LIABILITY&isPosting=true'),
                authenticatedFetch('/api/inventory/warehouses'),
                authenticatedFetch('/api/inventory/products'),
                authenticatedFetch('/api/inventory/units'),
            ]);

            const sups = supRes.ok ? (await supRes.json()).data || [] : [];
            const accs = accRes.ok ? (await accRes.json()).accounts || [] : [];

            // Combine and unique by ID
            const combined = [...sups];
            const existingIds = new Set(sups.map((s: any) => s.id));

            accs.forEach((a: any) => {
                if (!existingIds.has(a.id)) {
                    combined.push(a);
                    existingIds.add(a.id);
                }
            });

            if (supRes.ok) setSuppliers(combined);
            if (whRes.ok) setWarehouses((await whRes.json()).data || []);
            if (prodRes.ok) setProducts((await prodRes.json()).data || []);
            if (unitRes.ok) setUnits((await unitRes.json()).data || []);
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
                unitId: item.unitId,
                poItemId: item.id,
                qtyOrdered: item.qty,
                qtyReceivedPrior: item.receivedQty || 0,
                qtyReceived: Math.max(0, item.qty - (item.receivedQty || 0)), // Default to remaining
                qtyRejected: 0,
                rate: item.rate
            }))
        });
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { productId: '', unitId: '', qtyReceived: 1, qtyRejected: 0 }]
        });
    };

    const removeItem = (index: number) => {
        const newItems = [...formData.items];
        newItems.splice(index, 1);
        setFormData({ ...formData, items: newItems });
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];

        // Handle numeric conversion and NaN safety
        let refinedValue = value;
        if (field === "qtyReceived" || field === "qtyRejected") {
            refinedValue = isNaN(value) ? 0 : value;
        }

        newItems[index] = { ...newItems[index], [field]: refinedValue };
        setFormData({ ...formData, items: newItems });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Over-fulfillment check
        const overFullfilled = formData.items.some((it: any) => it.qtyReceived > (it.qtyOrdered - (it.qtyReceivedPrior || 0)));
        if (overFullfilled) {
            if (!confirm("Received quantity exceeds PO order. An 'Addendum PO' will be automatically created for the excess. Proceed?")) {
                return;
            }
        }

        const url = isEditing ? `/api/finance/purchase/grn/${editId}` : '/api/finance/purchase/grn';
        const method = isEditing ? 'PUT' : 'POST';

        const res = await authenticatedFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (res.ok) {
            setIsModalOpen(false);
            setIsEditing(false);
            setEditId("");
            setFormData({
                poId: '',
                supplierId: '',
                warehouseId: '',
                date: new Date().toISOString().split('T')[0],
                items: []
            });
            setSelectedPO(null);
            fetchGRNs();
            fetchOpenPOs(); // Refresh POs as status may change
        } else {
            const json = await res.json();
            alert(json.error || "Failed to save GRN");
        }
    };

    const handleEdit = async (grn: any) => {
        setIsEditing(true);
        setEditId(grn.id);

        const items = grn.items.map((it: any) => ({
            productId: it.productId,
            productName: it.product?.name,
            unitId: it.unitId,
            poItemId: it.poItemId,
            qtyOrdered: it.poItem?.qty || 999999,
            qtyReceivedPrior: (it.poItem?.receivedQty || 0) - (it.qtyReceived || 0),
            qtyReceived: Number(it.qtyReceived || 0),
            qtyRejected: Number(it.qtyRejected || 0),
            rate: Number(it.rate || 0)
        }));

        setFormData({
            poId: grn.poId || '',
            supplierId: grn.supplierId,
            warehouseId: grn.warehouseId,
            date: grn.date.split('T')[0],
            items
        });
        setIsModalOpen(true);
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
            header: 'Status',
            accessor: (row) => row.invoices?.length > 0
                ? <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">BILLED</span>
                : <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-xs font-bold">UNBILLED</span>
        },
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
                        onClick={() => handleEdit(row)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-100"
                        title="Edit"
                    >
                        📝
                    </button>
                    <button
                        onClick={() => handleDelete(row.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        title="Delete"
                    >
                        🗑
                    </button>
                </div>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                        {isEditing ? "Edit GRN" : "Goods Received Notes"}
                    </h2>
                    <p className="text-slate-500">Track inventory received against Purchase Orders.</p>
                </div>
                <button
                    onClick={() => {
                        setIsEditing(false);
                        setEditId("");
                        setFormData({
                            poId: '',
                            supplierId: '',
                            warehouseId: '',
                            date: new Date().toISOString().split('T')[0],
                            items: []
                        });
                        setSelectedPO(null); // Clear selected PO when opening for new GRN
                        setIsModalOpen(true);
                    }}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                    <span className="text-xl">+</span> New GRN
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
                            <h2 className="text-xl font-bold">{isEditing ? "Edit GRN" : "New GRN"}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* HEADER */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1">Select Purchase Order</label>
                                    <select
                                        className="w-full p-2 border rounded-lg dark:bg-slate-800"
                                        value={formData.poId}
                                        onChange={(e) => handleSelectPO(e.target.value)}
                                        disabled={isEditing}
                                    >
                                        <option value="">Direct GRN (No PO)</option>
                                        {pos.map(p => <option key={p.id} value={p.id}>{p.poNo} - {p.supplier?.name}</option>)}
                                    </select>
                                </div>
                                {!formData.poId && (
                                    <div>
                                        <label className="block text-sm font-bold mb-1">Supplier</label>
                                        <Combobox
                                            options={suppliers.map(s => ({
                                                value: s.id,
                                                label: s.code ? `(${s.code}) ${s.name}` : s.name
                                            }))}
                                            value={formData.supplierId}
                                            onChange={(val) => setFormData({ ...formData, supplierId: val })}
                                            placeholder="Select Supplier..."
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-bold mb-1">Warehouse</label>
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

                            {!selectedPO && (
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
                            )}

                            {selectedPO && (
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">PO Details</p>
                                    <p className="font-bold text-slate-700 dark:text-slate-200">{selectedPO.poNo} - {selectedPO.supplier?.name}</p>
                                </div>
                            )}

                            {/* ITEMS */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-slate-700 dark:text-slate-300">Receive Items</h3>
                                    {!formData.poId && (
                                        <button type="button" onClick={addItem} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded font-bold hover:bg-indigo-100">
                                            + Add Item
                                        </button>
                                    )}
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                                        <tr>
                                            <th className="p-3">Product</th>
                                            <th className="p-3 w-32">Unit</th>
                                            {formData.poId && <th className="p-3">Ordered</th>}
                                            {formData.poId && <th className="p-3">Prev. Rec</th>}
                                            <th className="p-3 w-32">Receive Now</th>
                                            <th className="p-3 w-32">Rejected</th>
                                            {!formData.poId && <th className="p-3 w-10"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {formData.items.map((item: any, i: number) => (
                                            <tr key={i} className={item.qtyReceived > 0 ? 'bg-indigo-50/10' : ''}>
                                                <td className="p-2">
                                                    {formData.poId ? (
                                                        <span className="font-medium">{item.productName}</span>
                                                    ) : (
                                                        <select
                                                            className="w-full p-2 border rounded dark:bg-slate-800"
                                                            value={item.productId}
                                                            onChange={e => updateItem(i, 'productId', e.target.value)}
                                                            required
                                                        >
                                                            <option value="">Select Product</option>
                                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="p-2">
                                                    <select
                                                        className="w-full p-2 border rounded dark:bg-slate-800"
                                                        value={item.unitId}
                                                        onChange={e => updateItem(i, 'unitId', e.target.value)}
                                                    >
                                                        <option value="">Unit</option>
                                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                    </select>
                                                </td>
                                                {formData.poId && <td className="p-2 opacity-70">{item.qtyOrdered}</td>}
                                                {formData.poId && <td className="p-2 opacity-70">{item.qtyReceivedPrior}</td>}
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        className="w-full p-2 border rounded dark:bg-slate-800 font-bold text-indigo-600"
                                                        value={item.qtyReceived || 0}
                                                        onChange={e => updateItem(i, 'qtyReceived', parseFloat(e.target.value) || 0)}
                                                        min="0"
                                                        max={formData.poId ? (item.qtyOrdered - item.qtyReceivedPrior) : undefined}
                                                    />
                                                </td>
                                                {!formData.poId && (
                                                    <td className="p-2">
                                                        <input
                                                            type="number"
                                                            className="w-full p-2 border rounded dark:bg-slate-800"
                                                            value={item.rate || 0}
                                                            onChange={e => updateItem(i, 'rate', parseFloat(e.target.value) || 0)}
                                                            min="0"
                                                        />
                                                    </td>
                                                )}
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        className="w-full p-2 border rounded dark:bg-slate-800 text-red-500"
                                                        value={item.qtyRejected || 0}
                                                        onChange={e => updateItem(i, 'qtyRejected', parseFloat(e.target.value) || 0)}
                                                        min="0"
                                                    />
                                                </td>
                                                {!formData.poId && (
                                                    <td className="p-2 text-center">
                                                        <button type="button" onClick={() => removeItem(i)} className="text-slate-400 hover:text-red-500">✕</button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:shadow-indigo-500/30">
                                    {isEditing ? "Save Changes" : "Create GRN"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
