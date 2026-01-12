"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import DataTable, { Column } from "@/components/DataTable";
import Combobox from "@/components/Combobox";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

export default function SalesInvoicesPage() {
    const router = useRouter();

    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [sources, setSources] = useState<any[]>([]);
    const [selectedSource, setSelectedSource] = useState<any>(null);
    const [customers, setCustomers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [isDoMandatory, setIsDoMandatory] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState("");
    const [formData, setFormData] = useState<any>({
        sourceType: "SO", // SO | DO | DIRECT
        sourceId: "",
        customerId: "",
        warehouseId: "",
        date: new Date().toISOString().split("T")[0],
        dueDate: "",
        items: [],
    });

    useEffect(() => {
        fetchInvoices();
        fetchSettings();
        fetchDropdowns();
    }, []);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch("/api/finance/sales/invoices");
            const json = await res.json();
            if (json.success) setInvoices(json.data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const fetchSettings = async () => {
        try {
            const res = await authenticatedFetch("/api/settings/inventory");
            const json = await res.json();
            if (json.success) {
                const mandatory = json.data.DO_MANDATORY === "true";
                setIsDoMandatory(mandatory);
                if (mandatory) {
                    setFormData((p: any) => ({ ...p, sourceType: "DO" }));
                }
            }
        } catch (e) {
            console.error(e);
        }
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

    const fetchSources = async (type: string) => {
        try {
            const endpoint =
                type === "SO"
                    ? "/api/finance/sales/orders"
                    : "/api/finance/sales/delivery-notes";

            const res = await authenticatedFetch(endpoint);
            const json = await res.json();
            if (json.success) {
                let data = json.data;
                if (type === "DO") {
                    // Filter out already billed DOs
                    data = data.filter((d: any) => !d.invoices || d.invoices.length === 0);
                }
                setSources(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (isModalOpen && formData.sourceType !== "DIRECT") {
            fetchSources(formData.sourceType);
        }
    }, [isModalOpen, formData.sourceType]);

    const handleSelectSource = (id: string) => {
        const source = sources.find((s) => s.id === id);
        if (!source) return;

        setSelectedSource(source);

        let items: any[] = [];

        if (formData.sourceType === "SO") {
            items = source.items.map((item: any) => {
                const available = item.qty - (item.invoicedQty || 0);
                return {
                    productId: item.productId,
                    productName: item.product?.name,
                    unitId: item.unitId,
                    soItemId: item.id,
                    qtyAvailable: available,
                    qty: Math.max(0, available),
                    rate: item.rate,
                    total: available * item.rate,
                };
            });
        } else {
            items = source.items.map((item: any) => ({
                productId: item.productId,
                productName: item.product?.name,
                unitId: item.unitId,
                doItemId: item.id,
                soItemId: item.soItemId,
                qtyAvailable: item.qty,
                qty: item.qty,
                rate: item.soItem?.rate || 0,
                total: item.qty * (item.soItem?.rate || 0),
            }));
        }

        setFormData({
            ...formData,
            sourceId: id,
            customerId: source.customerId,
            warehouseId: source.warehouseId || "",
            items,
        });
    };

    const handleAddItem = () => {
        setFormData({
            ...formData,
            items: [
                ...formData.items,
                { productId: "", productName: "", unitId: "", qty: 1, rate: 0, total: 0 }
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

        // Ensure numeric fields are numbers
        let refinedValue = value;
        if (field === "qty" || field === "rate") {
            refinedValue = isNaN(value) ? 0 : value;
        }

        const item = { ...newItems[index], [field]: refinedValue };

        if (field === "productId") {
            const prod = products.find(p => p.id === value);
            item.productName = prod?.name || "";
            item.rate = Number(prod?.sellingPrice || 0);
            item.unitId = prod?.baseUnitId || "";
        }

        item.total = Number(item.qty || 0) * Number(item.rate || 0);
        newItems[index] = item;
        setFormData({ ...formData, items: newItems });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            ...formData,
            orderId: formData.sourceType === "SO" ? formData.sourceId : undefined,
            doId: formData.sourceType === "DO" ? formData.sourceId : undefined,
        };

        const url = isEditing ? `/api/finance/sales/invoices/${editId}` : "/api/finance/sales/invoices";
        const method = isEditing ? "PUT" : "POST";

        const res = await authenticatedFetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (res.ok) {
            setIsModalOpen(false);
            setIsEditing(false);
            setEditId("");
            setFormData({
                sourceType: isDoMandatory ? "DO" : "SO",
                sourceId: "",
                customerId: "",
                warehouseId: "",
                date: new Date().toISOString().split("T")[0],
                dueDate: "",
                items: [],
            });
            setSelectedSource(null);
            fetchInvoices();
        } else {
            const json = await res.json();
            alert(json.error || "Failed to save invoice");
        }
    };

    const handleEdit = async (invoice: any) => {
        setIsEditing(true);
        setEditId(invoice.id);

        // Map items to fit form structure
        const items = invoice.items.map((it: any) => ({
            productId: it.productId,
            productName: it.product?.name,
            unitId: it.unitId,
            soItemId: it.soItemId,
            doItemId: it.doItemId,
            qtyAvailable: 999999, // Hack for edit mode
            qty: Number(it.qty || 0),
            rate: Number(it.rate || 0),
            total: Number(it.total || 0),
        }));

        setFormData({
            sourceType: invoice.orderId ? "SO" : invoice.doId ? "DO" : "DIRECT",
            sourceId: invoice.orderId || invoice.doId || "",
            customerId: invoice.customerId,
            warehouseId: invoice.warehouseId || "",
            date: invoice.date.split("T")[0],
            dueDate: invoice.dueDate ? invoice.dueDate.split("T")[0] : "",
            items,
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this invoice? Linked journal entries and stock will be reverted.")) return;

        try {
            const res = await authenticatedFetch(`/api/finance/sales/invoices/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchInvoices();
            } else {
                const json = await res.json();
                alert(json.error || "Failed to delete invoice");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const columns: Column<any>[] = [
        { header: "Inv #", accessor: "invoiceNo" },
        {
            header: "Date",
            accessor: (row) => format(new Date(row.date), "dd/MM/yyyy"),
        },
        { header: "Customer", accessor: (row) => row.customer?.name },
        {
            header: "Amount",
            accessor: (row) => Number(row.totalAmount || 0).toFixed(2),
        },
        {
            header: "Ref",
            accessor: (row) =>
                row.order
                    ? `SO: ${row.order.orderNo}`
                    : row.do
                        ? `DN: ${row.do.doNo}`
                        : "-",
        },
        {
            header: "Actions",
            accessor: (row) => (
                <div className="flex gap-2">
                    <button
                        onClick={() => router.push(`/finance/sales/invoices/${row.id}`)}
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
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                        {isEditing ? "Edit Sales Invoice" : "Sales Invoices"}
                    </h2>
                    <p className="text-slate-500">
                        Manage billings and receivables from customers.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setIsEditing(false);
                        setEditId("");
                        setFormData({
                            sourceType: isDoMandatory ? "DO" : "SO",
                            sourceId: "",
                            customerId: "",
                            warehouseId: "",
                            date: new Date().toISOString().split("T")[0],
                            dueDate: "",
                            items: [],
                        });
                        setIsModalOpen(true);
                    }}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                    <span className="text-xl">+</span> Add Invoice
                </button>
            </div>

            <DataTable data={invoices} columns={columns} isLoading={loading} />

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-900 w-[900px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
                            <h2 className="text-xl font-bold">{isEditing ? "Edit Sales Invoice" : "New Sales Invoice"}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* SOURCE TYPE SELECTION */}
                            <div>
                                <label className="block text-sm font-bold mb-2">Invoice Source</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="sourceType"
                                            value="SO"
                                            checked={formData.sourceType === "SO"}
                                            onChange={() => setFormData({ ...formData, sourceType: "SO", sourceId: "", items: [] })}
                                            disabled={isDoMandatory}
                                            className="accent-indigo-600"
                                        />
                                        <span className={isDoMandatory ? "text-slate-400" : ""}>From Sales Order</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="sourceType"
                                            value="DO"
                                            checked={formData.sourceType === "DO"}
                                            onChange={() => setFormData({ ...formData, sourceType: "DO", sourceId: "", items: [] })}
                                            className="accent-indigo-600"
                                        />
                                        <span>From Delivery Note</span>
                                    </label>
                                    {!isDoMandatory && (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="sourceType"
                                                value="DIRECT"
                                                checked={formData.sourceType === "DIRECT"}
                                                onChange={() => setFormData({ ...formData, sourceType: "DIRECT", sourceId: "", items: [] })}
                                                className="accent-indigo-600"
                                            />
                                            <span>Direct Invoice</span>
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* SOURCE SELECTION */}
                            {formData.sourceType !== "DIRECT" ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold mb-1">
                                            Select {formData.sourceType === "SO" ? "Sales Order" : "Delivery Note"}
                                        </label>
                                        <Combobox
                                            options={sources.map(s => ({
                                                value: s.id,
                                                label: `${formData.sourceType === "SO" ? s.orderNo : s.doNo} - ${s.customer?.name || "Unknown"} (${s.customer?.code || ""})`
                                            }))}
                                            value={formData.sourceId}
                                            onChange={(val) => handleSelectSource(val)}
                                            placeholder={`Select ${formData.sourceType}...`}
                                            disabled={isEditing}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1">Date</label>
                                        <input
                                            type="date"
                                            className="w-full p-2 border rounded-lg dark:bg-slate-800"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold mb-1">Customer / Receivable Account</label>
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
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold mb-1">Due Date</label>
                                            <input
                                                type="date"
                                                className="w-full p-2 border rounded-lg dark:bg-slate-800"
                                                value={formData.dueDate}
                                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ITEMS TABLE */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-slate-700 dark:text-slate-300">Invoice Items</h3>
                                    {formData.sourceType === "DIRECT" && (
                                        <button
                                            type="button"
                                            onClick={handleAddItem}
                                            className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold hover:bg-emerald-200"
                                        >
                                            + Add Item
                                        </button>
                                    )}
                                </div>
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold">
                                        <tr>
                                            <th className="p-3 text-left">Product</th>
                                            <th className="p-3 w-32">Unit</th>
                                            {formData.sourceType !== "DIRECT" && <th className="p-3 text-right">Aval. Qty</th>}
                                            <th className="p-3 text-right w-32">Qty</th>
                                            <th className="p-3 text-right w-40">Rate</th>
                                            <th className="p-3 text-right w-40">Total</th>
                                            {formData.sourceType === "DIRECT" && <th className="p-3 w-10"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {formData.items.map((item: any, i: number) => (
                                            <tr key={i}>
                                                <td className="p-2">
                                                    {formData.sourceType === "DIRECT" ? (
                                                        <select
                                                            className="w-full p-1.5 border rounded dark:bg-slate-800"
                                                            value={item.productId}
                                                            onChange={(e) => updateItem(i, "productId", e.target.value)}
                                                            required
                                                        >
                                                            <option value="">Select Product</option>
                                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                        </select>
                                                    ) : item.productName}
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
                                                {formData.sourceType !== "DIRECT" && (
                                                    <td className="p-2 text-right opacity-70">{item.qtyAvailable}</td>
                                                )}
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        className="w-full p-1.5 border rounded text-right dark:bg-slate-800"
                                                        value={item.qty || 0}
                                                        onChange={(e) => updateItem(i, "qty", parseFloat(e.target.value) || 0)}
                                                        max={formData.sourceType !== "DIRECT" && !isEditing ? item.qtyAvailable : undefined}
                                                        min="0"
                                                        required
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        className="w-full p-1.5 border rounded text-right dark:bg-slate-800"
                                                        value={item.rate || 0}
                                                        onChange={(e) => updateItem(i, "rate", parseFloat(e.target.value) || 0)}
                                                        required
                                                    />
                                                </td>
                                                <td className="p-2 text-right font-mono">{(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                {formData.sourceType === "DIRECT" && (
                                                    <td className="p-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(i)}
                                                            className="text-red-500 hover:text-red-700"
                                                        >
                                                            ✕
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold">
                                        <tr>
                                            <td colSpan={formData.sourceType === "DIRECT" ? 4 : 5} className="p-3 text-right text-slate-500 uppercase text-[10px] tracking-widest font-black">Total Amount:</td>
                                            <td className="p-3 text-right font-black text-indigo-600 text-lg">
                                                {formData.items.reduce((sum: number, item: any) => sum + (item.total || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            {formData.sourceType === "DIRECT" && <td></td>}
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* ACTIONS */}
                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:shadow-indigo-500/30"
                                    disabled={formData.items.length === 0}
                                >
                                    {isEditing ? "Save Changes" : "Create Invoice"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
