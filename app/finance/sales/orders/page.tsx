"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import DataTable, { Column } from "@/components/DataTable";
import Combobox from "@/components/Combobox";
import { format } from "date-fns";

export default function SalesOrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [customers, setCustomers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState("");
    const [formData, setFormData] = useState<any>({
        orderNo: `SO-${Date.now()}`,
        customerId: "",
        warehouseId: "",
        date: new Date().toISOString().split("T")[0],
        expectedDate: "",
        items: [],
    });

    useEffect(() => {
        fetchOrders();
        fetchDropdowns();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch("/api/finance/sales/orders");
            const json = await res.json();
            if (json.success) setOrders(json.data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const fetchDropdowns = async () => {
        try {
            const [custRes, accRes, whRes, prodRes, unitRes] = await Promise.all([
                authenticatedFetch("/api/finance/parties/customers"),
                authenticatedFetch('/api/accounts?type=ASSET&isPosting=true'),
                authenticatedFetch("/api/inventory/warehouses"),
                authenticatedFetch("/api/inventory/products"),
                authenticatedFetch("/api/inventory/units"),
            ]);

            const custs = custRes.ok ? (await custRes.json()).data || [] : [];
            const accs = accRes.ok ? (await accRes.json()).accounts || [] : [];

            // Combine and unique by ID
            const combined = [...custs];
            const existingIds = new Set(custs.map((c: any) => c.id));

            accs.forEach((a: any) => {
                if (!existingIds.has(a.id)) {
                    combined.push(a);
                    existingIds.add(a.id);
                }
            });

            if (custRes.ok) setCustomers(combined);
            if (whRes.ok) setWarehouses((await whRes.json()).data || []);
            if (prodRes.ok) setProducts((await prodRes.json()).data || []);
            if (unitRes.ok) setUnits((await unitRes.json()).data || []);
        } catch (e) {
            console.error(e);
        }
    };

    const handleAddItem = () => {
        setFormData({
            ...formData,
            items: [
                ...formData.items,
                { productId: "", unitId: "", qty: 1, rate: 0, total: 0 }
            ]
        });
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...formData.items];
        newItems.splice(index, 1);
        setFormData({ ...formData, items: newItems });
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        const item = { ...newItems[index], [field]: value };

        if (field === "productId") {
            const prod = products.find(p => p.id === value);
            item.rate = Number(prod?.sellingPrice || 0);
            item.unitId = prod?.baseUnitId || "";
        }

        item.total = Number(item.qty || 0) * Number(item.rate || 0);
        newItems[index] = item;
        setFormData({ ...formData, items: newItems });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const url = isEditing ? `/api/finance/sales/orders/${editId}` : "/api/finance/sales/orders";
        const method = isEditing ? "PUT" : "POST";

        const res = await authenticatedFetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });

        if (res.ok) {
            setIsModalOpen(false);
            setIsEditing(false);
            setEditId("");
            setFormData({
                orderNo: `SO-${Date.now()}`,
                customerId: "",
                warehouseId: "",
                date: new Date().toISOString().split("T")[0],
                expectedDate: "",
                items: [],
            });
            fetchOrders();
        } else {
            const json = await res.json();
            alert(json.error || "Failed to save order");
        }
    };

    const columns: Column<any>[] = [
        { header: "Order #", accessor: "orderNo" },
        { header: "Date", accessor: (row) => format(new Date(row.date), "dd/MM/yyyy") },
        { header: "Customer", accessor: (row) => row.customer?.name },
        { header: "Amount", accessor: (row) => Number(row.totalAmount || 0).toFixed(2) },
        {
            header: "Status",
            accessor: (row) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.status === 'CLOSED' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {row.status || 'OPEN'}
                </span>
            )
        },
        {
            header: "Actions",
            accessor: (row) => (
                <div className="flex gap-2">
                    <button className="p-1 text-slate-400 hover:text-indigo-600">👁</button>
                    <button className="p-1 text-slate-400 hover:text-amber-600">📝</button>
                </div>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Sales Orders</h2>
                    <p className="text-slate-500">Track and manage customer orders.</p>
                </div>
                <button
                    onClick={() => {
                        setIsEditing(false);
                        setFormData({
                            orderNo: `SO-${Date.now()}`,
                            customerId: "",
                            warehouseId: "",
                            date: new Date().toISOString().split("T")[0],
                            expectedDate: "",
                            items: [],
                        });
                        setIsModalOpen(true);
                    }}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg"
                >
                    + New Order
                </button>
            </div>

            <DataTable data={orders} columns={columns} isLoading={loading} />

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-900 w-[800px] max-h-[90vh] overflow-y-auto rounded-2xl">
                        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-inherit">
                            <h2 className="text-xl font-bold">New Sales Order</h2>
                            <button onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1">Customer</label>
                                    <Combobox
                                        options={customers.map(c => ({
                                            value: c.id,
                                            label: c.code ? `(${c.code}) ${c.name}` : c.name
                                        }))}
                                        value={formData.customerId}
                                        onChange={(val) => setFormData({ ...formData, customerId: val })}
                                        placeholder="Select Customer..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1">Warehouse</label>
                                    <select
                                        className="w-full p-2 border rounded-lg dark:bg-slate-800"
                                        value={formData.warehouseId}
                                        onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Warehouse</option>
                                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1">Date</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-lg dark:bg-slate-800"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1">Expected Date</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-lg dark:bg-slate-800"
                                        value={formData.expectedDate}
                                        onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold">Order Items</h3>
                                    <button type="button" onClick={handleAddItem} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">+ Add Item</button>
                                </div>
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold">
                                        <tr>
                                            <th className="p-3 text-left">Product</th>
                                            <th className="p-3 w-32">Unit</th>
                                            <th className="p-3 text-right w-32">Qty</th>
                                            <th className="p-3 text-right w-40">Rate</th>
                                            <th className="p-3 text-right w-40">Total</th>
                                            <th className="p-3 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {formData.items.map((item: any, i: number) => (
                                            <tr key={i}>
                                                <td className="p-2">
                                                    <select
                                                        className="w-full p-1.5 border rounded dark:bg-slate-800"
                                                        value={item.productId}
                                                        onChange={(e) => updateItem(i, "productId", e.target.value)}
                                                        required
                                                    >
                                                        <option value="">Select Product</option>
                                                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-2">
                                                    <select
                                                        className="w-full p-1.5 border rounded dark:bg-slate-800"
                                                        value={item.unitId}
                                                        onChange={(e) => updateItem(i, "unitId", e.target.value)}
                                                    >
                                                        <option value="">Unit</option>
                                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-2">
                                                    <input type="number" className="w-full p-1.5 border rounded text-right dark:bg-slate-800" value={item.qty} onChange={(e) => updateItem(i, "qty", parseFloat(e.target.value))} required />
                                                </td>
                                                <td className="p-2">
                                                    <input type="number" className="w-full p-1.5 border rounded text-right dark:bg-slate-800" value={item.rate} onChange={(e) => updateItem(i, "rate", parseFloat(e.target.value))} required />
                                                </td>
                                                <td className="p-2 text-right">{(item.total || 0).toFixed(2)}</td>
                                                <td className="p-2 text-center">
                                                    <button type="button" onClick={() => handleRemoveItem(i)} className="text-red-500">✕</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">Create Order</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
