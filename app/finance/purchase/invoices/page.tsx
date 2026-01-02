"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import DataTable, { Column } from "@/components/DataTable";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

export default function PurchaseInvoicesPage() {
    const router = useRouter();

    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Settings
    const [isGrnMandatory, setIsGrnMandatory] = useState(false);

    // Form Data
    const [formData, setFormData] = useState<any>({
        sourceType: "PO", // PO | GRN | DIRECT
        sourceId: "",
        supplierId: "",
        warehouseId: "",
        date: new Date().toISOString().split("T")[0],
        dueDate: "",
        items: [],
    });

    const [sources, setSources] = useState<any[]>([]);
    const [selectedSource, setSelectedSource] = useState<any>(null);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);

    useEffect(() => {
        fetchInvoices();
        fetchSettings();
        fetchDropdowns();
    }, []);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch("/api/finance/purchase/invoices");
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
                const mandatory = json.data.INVENTORY_GRN_MANDATORY === "true";
                setIsGrnMandatory(mandatory);
                if (mandatory) {
                    setFormData((p: any) => ({ ...p, sourceType: "GRN" }));
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchDropdowns = async () => {
        try {
            const [supRes, whRes, prodRes] = await Promise.all([
                authenticatedFetch("/api/finance/parties/suppliers"),
                authenticatedFetch("/api/inventory/warehouses"),
                authenticatedFetch("/api/inventory/products"),
            ]);

            if (supRes.ok) setSuppliers((await supRes.json()).data || []);
            if (whRes.ok) setWarehouses((await whRes.json()).data || []);
            if (prodRes.ok) setProducts((await prodRes.json()).data || []);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchSources = async (type: string) => {
        try {
            const endpoint =
                type === "PO"
                    ? "/api/finance/purchase/orders?status=OPEN"
                    : "/api/finance/purchase/grn";

            const res = await authenticatedFetch(endpoint);
            const json = await res.json();
            if (json.success) setSources(json.data);
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

        if (formData.sourceType === "PO") {
            items = source.items.map((item: any) => {
                const available = item.qty - (item.invoicedQty || 0);
                return {
                    productId: item.productId,
                    productName: item.product?.name,
                    poItemId: item.id,
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
                grnItemId: item.id,
                poItemId: item.poItemId,
                qtyAvailable: item.qtyReceived,
                qty: item.qtyReceived,
                rate: item.poItem?.rate || 0,
                total: item.qtyReceived * (item.poItem?.rate || 0),
            }));
        }

        setFormData({
            ...formData,
            sourceId: id,
            supplierId: source.supplierId,
            items,
        });
    };

    const updateItem = (index: number, field: string, value: any) => {
        const items = [...formData.items];
        items[index] = { ...items[index], [field]: value };

        if (field === "qty" || field === "rate") {
            items[index].total = items[index].qty * items[index].rate;
        }

        setFormData({ ...formData, items });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            ...formData,
            poId: formData.sourceType === "PO" ? formData.sourceId : undefined,
            grnId: formData.sourceType === "GRN" ? formData.sourceId : undefined,
        };

        const res = await authenticatedFetch("/api/finance/purchase/invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (res.ok) {
            setIsModalOpen(false);
            setFormData({
                sourceType: isGrnMandatory ? "GRN" : "PO",
                sourceId: "",
                supplierId: "",
                date: new Date().toISOString().split("T")[0],
                items: [],
            });
            setSelectedSource(null);
            fetchInvoices();
        } else {
            alert("Failed to create invoice");
        }
    };

    const columns: Column<any>[] = [
        { header: "Inv #", accessor: "invoiceNo" },
        {
            header: "Date",
            accessor: (row) => format(new Date(row.date), "dd/MM/yyyy"),
        },
        { header: "Supplier", accessor: (row) => row.supplier?.name },
        {
            header: "Amount",
            accessor: (row) => row.totalAmount.toFixed(2),
        },
        {
            header: "Ref",
            accessor: (row) =>
                row.po
                    ? `PO: ${row.po.poNo}`
                    : row.grn
                        ? `GRN: ${row.grn.grnNo}`
                        : "-",
        },
    ];

    return (
        <MainLayout>
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Purchase Invoices</h1>
                    <p className="text-slate-500">
                        Manage bills to be paid to suppliers.
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold"
                >
                    + New Invoice
                </button>
            </div>

            <DataTable data={invoices} columns={columns} isLoading={loading} />

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-900 w-[900px] rounded-2xl shadow-2xl">
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* SOURCE */}
                            {formData.sourceType !== "DIRECT" && (
                                <>
                                    <div>
                                        <label className="font-bold">
                                            Select Reference
                                        </label>
                                        <select
                                            className="w-full p-2 border rounded"
                                            value={formData.sourceId}
                                            onChange={(e) =>
                                                handleSelectSource(
                                                    e.target.value
                                                )
                                            }
                                            required
                                        >
                                            <option value="">
                                                Select Reference
                                            </option>
                                            {sources.map((s) => (
                                                <option
                                                    key={s.id}
                                                    value={s.id}
                                                >
                                                    {formData.sourceType === "PO"
                                                        ? s.poNo
                                                        : s.grnNo}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="font-bold">
                                            Date
                                        </label>
                                        <input
                                            type="date"
                                            className="w-full p-2 border rounded"
                                            value={formData.date}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    date: e.target.value,
                                                })
                                            }
                                            required
                                        />
                                    </div>
                                </>
                            )}
                        </form>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
