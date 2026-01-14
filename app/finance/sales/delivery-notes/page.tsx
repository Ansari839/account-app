"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import DataTable, { Column } from "@/components/DataTable";
import Combobox from "@/components/Combobox";
import { format } from "date-fns";

export default function DeliveryNotesPage() {
    const [dns, setDns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [orders, setOrders] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [formData, setFormData] = useState<any>({
        doNo: `DN-${Date.now()}`,
        orderId: "",
        customerId: "",
        warehouseId: "",
        date: new Date().toISOString().split("T")[0],
        remarks: "",
        items: [],
    });

    useEffect(() => {
        fetchDNS();
        fetchDropdowns();
    }, []);

    const fetchDNS = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch("/api/finance/sales/delivery-notes");
            const json = await res.json();
            if (json.success) setDns(json.data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const fetchDropdowns = async () => {
        try {
            const [soRes, custRes, accRes, whRes, unitRes] = await Promise.all([
                authenticatedFetch("/api/finance/sales/orders?status=OPEN"),
                authenticatedFetch("/api/finance/parties/customers"),
                authenticatedFetch('/api/accounts?type=ASSET&isPosting=true'),
                authenticatedFetch("/api/inventory/warehouses"),
                authenticatedFetch("/api/inventory/units"),
            ]);

            if (soRes.ok) setOrders((await soRes.json()).data || []);

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

            setCustomers(combined);

            if (whRes.ok) setWarehouses((await whRes.json()).data || []);
            if (unitRes.ok) setUnits((await unitRes.json()).data || []);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSelectOrder = (id: string) => {
        const order = orders.find(o => o.id === id);
        if (!order) return;

        const items = order.items.map((it: any) => ({
            productId: it.productId,
            productName: it.product?.name,
            unitId: it.unitId,
            orderItemId: it.id,
            qtyOrdered: it.qty,
            qtyShipped: it.qty, // Default to full qty
        }));

        setFormData({
            ...formData,
            orderId: id,
            customerId: order.customerId,
            warehouseId: order.warehouseId || "",
            items,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const res = await authenticatedFetch("/api/finance/sales/delivery-notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });

        if (res.ok) {
            setIsModalOpen(false);
            setFormData({
                doNo: `DN-${Date.now()}`,
                orderId: "",
                customerId: "",
                warehouseId: "",
                date: new Date().toISOString().split("T")[0],
                remarks: "",
                items: [],
            });
            fetchDNS();
        } else {
            const json = await res.json();
            alert(json.error || "Failed to create delivery note");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this delivery note? Stock will be reverted.")) return;

        try {
            const res = await authenticatedFetch(`/api/finance/sales/delivery-notes/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchDNS();
            } else {
                const json = await res.json();
                alert(json.error || "Failed to delete delivery note");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const columns: Column<any>[] = [
        { header: "DN #", accessor: "doNo" },
        { header: "Date", accessor: (row) => format(new Date(row.date), "dd/MM/yyyy") },
        { header: "Customer", accessor: (row) => row.customer?.name },
        { header: "Ref Order", accessor: (row) => row.order?.orderNo || "-" },
        { header: "Warehouse", accessor: (row) => row.warehouse?.name },
        {
            header: "Status",
            accessor: (row) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.invoices?.length > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                    {row.invoices?.length > 0 ? 'INVOICED' : 'PENDING'}
                </span>
            )
        },
        {
            header: "Actions",
            accessor: (row) => (
                <div className="flex gap-2">
                    <button
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                        title="View"
                    >
                        👁
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
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Delivery Notes</h2>
                    <p className="text-slate-500">Manage goods dispatch and stock delivery.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg"
                >
                    + New Delivery Note
                </button>
            </div>

            <DataTable data={dns} columns={columns} isLoading={loading} />

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-900 w-[800px] max-h-[90vh] overflow-y-auto rounded-2xl">
                        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-inherit">
                            <h2 className="text-xl font-bold">New Delivery Note</h2>
                            <button onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1">Select Sales Order</label>
                                    <Combobox
                                        options={orders.map(o => ({ value: o.id, label: `${o.orderNo} - ${o.customer?.name} (${o.customer?.code || ''})` }))}
                                        value={formData.orderId}
                                        onChange={(val) => handleSelectOrder(val)}
                                        placeholder="Select Order..."
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold mb-1">Customer / Account</label>
                                    <Combobox
                                        options={customers.map(c => ({
                                            value: c.id,
                                            label: c.code ? `(${c.code}) ${c.name}` : c.name
                                        }))}
                                        value={formData.customerId}
                                        onChange={(val) => setFormData({ ...formData, customerId: val })}
                                        placeholder="Select Customer..."
                                        disabled={!!formData.orderId}
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

                            <div className="space-y-4">
                                <h3 className="font-bold">Items to Ship</h3>
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold">
                                        <tr>
                                            <th className="p-3 text-left">Product</th>
                                            <th className="p-3 w-32">Unit</th>
                                            <th className="p-3 text-right w-32">Ordered</th>
                                            <th className="p-3 text-right w-32">To Ship</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {formData.items.map((item: any, i: number) => (
                                            <tr key={i}>
                                                <td className="p-2">{item.productName}</td>
                                                <td className="p-2">
                                                    <select
                                                        className="w-full p-1.5 border rounded dark:bg-slate-800"
                                                        value={item.unitId}
                                                        onChange={(e) => {
                                                            const n = [...formData.items];
                                                            n[i].unitId = e.target.value;
                                                            setFormData({ ...formData, items: n });
                                                        }}
                                                    >
                                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-2 text-right">{item.qtyOrdered}</td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        className="w-full p-1.5 border rounded text-right dark:bg-slate-800"
                                                        value={item.qtyShipped}
                                                        onChange={(e) => {
                                                            const n = [...formData.items];
                                                            n[i].qtyShipped = parseFloat(e.target.value);
                                                            setFormData({ ...formData, items: n });
                                                        }}
                                                        max={item.qtyOrdered}
                                                        required
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold" disabled={formData.items.length === 0}>Create Delivery Note</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
