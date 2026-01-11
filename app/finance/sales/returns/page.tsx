"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import DataTable, { Column } from "@/components/DataTable";
import Combobox from "@/components/Combobox";
import { format } from "date-fns";

export default function SalesReturnsPage() {
    const [returns, setReturns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [invoices, setInvoices] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [formData, setFormData] = useState<any>({
        invoiceId: "",
        date: new Date().toISOString().split("T")[0],
        remarks: "",
        items: [],
    });

    useEffect(() => {
        fetchReturns();
        fetchDropdowns();
    }, []);

    const fetchReturns = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch("/api/finance/sales/returns");
            const json = await res.json();
            if (json.success) setReturns(json.data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const fetchDropdowns = async () => {
        try {
            const [invRes, unitRes] = await Promise.all([
                authenticatedFetch("/api/finance/sales/invoices"),
                authenticatedFetch("/api/inventory/units"),
            ]);

            if (invRes.ok) setInvoices((await invRes.json()).data || []);
            if (unitRes.ok) setUnits((await unitRes.json()).data || []);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSelectInvoice = (id: string) => {
        const invoice = invoices.find(i => i.id === id);
        if (!invoice) return;

        const items = invoice.items.map((it: any) => ({
            productId: it.productId,
            productName: it.product?.name,
            unitId: it.unitId,
            qtyInvoiced: it.qty,
            qty: it.qty, // Default to full return
            rate: it.rate,
            total: it.total,
        }));

        setFormData({
            ...formData,
            invoiceId: id,
            items,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const res = await authenticatedFetch("/api/finance/sales/returns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });

        if (res.ok) {
            setIsModalOpen(false);
            setFormData({
                invoiceId: "",
                date: new Date().toISOString().split("T")[0],
                remarks: "",
                items: [],
            });
            fetchReturns();
        } else {
            const json = await res.json();
            alert(json.error || "Failed to create sales return");
        }
    };

    const columns: Column<any>[] = [
        { header: "Return #", accessor: "returnNo" },
        { header: "Date", accessor: (row) => format(new Date(row.date), "dd/MM/yyyy") },
        { header: "Customer", accessor: (row) => row.customer?.name },
        { header: "Ref Invoice", accessor: (row) => row.invoice?.invoiceNo || "-" },
        { header: "Amount", accessor: (row) => Number(row.totalAmount || 0).toFixed(2) },
        {
            header: "Actions",
            accessor: (row) => (
                <div className="flex gap-2">
                    <button className="p-1 text-slate-400 hover:text-indigo-600">👁</button>
                    <button className="p-1 text-slate-400 hover:text-red-600">🗑</button>
                </div>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Sales Returns</h2>
                    <p className="text-slate-500">Manage customer returns and reversals.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg"
                >
                    + New Return
                </button>
            </div>

            <DataTable data={returns} columns={columns} isLoading={loading} />

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-900 w-[800px] max-h-[90vh] overflow-y-auto rounded-2xl">
                        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-inherit">
                            <h2 className="text-xl font-bold">New Sales Return</h2>
                            <button onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-bold mb-1">Select Sales Invoice</label>
                                <Combobox
                                    options={invoices.map(i => ({ value: i.id, label: `${i.invoiceNo} - ${i.customer?.name}` }))}
                                    value={formData.invoiceId}
                                    onChange={(val) => handleSelectInvoice(val)}
                                    placeholder="Select Invoice..."
                                />
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold">Items to Return</h3>
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold">
                                        <tr>
                                            <th className="p-3 text-left">Product</th>
                                            <th className="p-3 w-32">Unit</th>
                                            <th className="p-3 text-right w-32">Invoiced</th>
                                            <th className="p-3 text-right w-32">Return Qty</th>
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
                                                <td className="p-2 text-right">{item.qtyInvoiced}</td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        className="w-full p-1.5 border rounded text-right dark:bg-slate-800"
                                                        value={item.qty}
                                                        onChange={(e) => {
                                                            const n = [...formData.items];
                                                            n[i].qty = parseFloat(e.target.value);
                                                            n[i].total = n[i].qty * n[i].rate;
                                                            setFormData({ ...formData, items: n });
                                                        }}
                                                        max={item.qtyInvoiced}
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
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold" disabled={formData.items.length === 0}>Create Return</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
