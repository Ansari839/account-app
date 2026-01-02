"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function PurchaseInvoicesPage() {
    const router = useRouter();
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Settings state
    const [isGrnMandatory, setIsGrnMandatory] = useState(false);

    // Form Data
    const [formData, setFormData] = useState<any>({
        sourceType: 'PO', // 'PO' or 'GRN'
        sourceId: '',
        supplierId: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: '',
        items: []
    });

    const [sources, setSources] = useState<any[]>([]); // POs or GRNs
    const [selectedSource, setSelectedSource] = useState<any>(null);

    useEffect(() => {
        fetchInvoices();
        fetchSettings();
    }, []);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch('/api/finance/purchase/invoices');
            const json = await res.json();
            if (json.success) setInvoices(json.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const fetchSettings = async () => {
        try {
            const res = await authenticatedFetch("/api/settings/inventory");
            const json = await res.json();
            if (json.success) {
                const mandatory = json.data.INVENTORY_GRN_MANDATORY === 'true';
                setIsGrnMandatory(mandatory);
                // If mandatory, default source type is GRN
                if (mandatory) setFormData(prev => ({ ...prev, sourceType: 'GRN' }));
            }
        } catch (e) { console.error(e); }
    };

    const fetchSources = async (type: string) => {
        try {
            // If type is PO, fetch Open POs
            // If type is GRN, fetch Unbilled GRNs
            const endpoint = type === 'PO'
                ? '/api/finance/purchase/orders?status=OPEN'
                : '/api/finance/purchase/grn'; // Should filter unbilled in real app

            const res = await authenticatedFetch(endpoint);
            const json = await res.json();
            if (json.success) setSources(json.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (isModalOpen) {
            fetchSources(formData.sourceType);
        }
    }, [isModalOpen, formData.sourceType]);

    const handleSelectSource = (id: string) => {
        const source = sources.find(s => s.id === id);
        if (!source) return;

        setSelectedSource(source);

        let items = [];
        if (formData.sourceType === 'PO') {
            items = source.items.map((item: any) => ({
                productId: item.productId,
                productName: item.product?.name,
                poItemId: item.id,
                qtyAvailable: item.qty - (item.invoicedQty || 0),
                qty: Math.max(0, item.qty - (item.invoicedQty || 0)),
                rate: item.rate,
                total: 0
            }));
        } else {
            // GRN logic
            items = source.items.map((item: any) => ({
                productId: item.productId,
                productName: item.product?.name,
                grnItemId: item.id,
                poItemId: item.poItemId,
                qtyAvailable: item.qtyReceived, // TODO: Subtract already invoiced if multiple PIs allowed per GRN
                qty: item.qtyReceived,
                rate: item.poItem?.rate || 0, // Fallback need cost price
                total: 0
            }));
        }

        // Calculate initial totals
        items.forEach(item => item.total = item.qty * item.rate);

        setFormData({
            ...formData,
            sourceId: id,
            supplierId: source.supplierId,
            items
        });
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };

        if (field === 'qty' || field === 'rate') {
            newItems[index].total = newItems[index].qty * newItems[index].rate;
        }

        setFormData({ ...formData, items: newItems });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            ...formData,
            poId: formData.sourceType === 'PO' ? formData.sourceId : undefined,
            grnId: formData.sourceType === 'GRN' ? formData.sourceId : undefined,
        };

        const res = await authenticatedFetch('/api/finance/purchase/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            setIsModalOpen(false);
            setFormData({
                sourceType: isGrnMandatory ? 'GRN' : 'PO',
                sourceId: '',
                supplierId: '',
                date: new Date().toISOString().split('T')[0],
                items: []
            });
            setSelectedSource(null);
            fetchInvoices();
        } else {
            alert("Failed to create Invoice");
        }
    };

    const columns: Column<any>[] = [
        { header: 'Inv #', accessor: 'invoiceNo' },
        { header: 'Date', accessor: (row) => format(new Date(row.date), 'dd/MM/yyyy') },
        { header: 'Supplier', accessor: (row) => row.supplier?.name },
        { header: 'Amount', accessor: (row) => row.totalAmount.toFixed(2) },
        { header: 'Ref', accessor: (row) => row.po ? `PO: ${row.po.poNo}` : row.grn ? `GRN: ${row.grn.grnNo}` : '-' },
        {
            header: 'Actions',
            accessor: (row) => (
                <button className="text-indigo-600 font-medium hover:underline">
                    View
                </button>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Purchase Invoices</h1>
                    <p className="text-slate-500">Manage bills to be paid to suppliers.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold"
                >
                    + New Invoice
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <DataTable
                    data={invoices}
                    columns={columns}
                    isLoading={loading}
                />
            </div>

            {/* CREATE MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-900 w-[900px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
                            <h2 className="text-xl font-bold">New Purchase Invoice</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* HEADER */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <div className="flex gap-4 mb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="sourceType"
                                                value="PO"
                                                checked={formData.sourceType === 'PO'}
                                                onChange={() => setFormData({ ...formData, sourceType: 'PO', sourceId: '', items: [] })}
                                                disabled={isGrnMandatory}
                                                className="accent-indigo-600"
                                            />
                                            <span className={isGrnMandatory ? 'text-slate-400' : ''}>From Purchase Order</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="sourceType"
                                                value="GRN"
                                                checked={formData.sourceType === 'GRN'}
                                                onChange={() => setFormData({ ...formData, sourceType: 'GRN', sourceId: '', items: [] })}
                                                className="accent-indigo-600"
                                            />
                                            <span>From GRN</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold mb-1">
                                        Select {formData.sourceType === 'PO' ? 'Purchase Order' : 'GRN'}
                                    </label>
                                    <select
                                        className="w-full p-2 border rounded-lg dark:bg-slate-800"
                                        required
                                        value={formData.sourceId}
                                        onChange={e => handleSelectSource(e.target.value)}
                                    >
                                        <option value="">Select Reference</option>
                                        {sources.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {formData.sourceType === 'PO' ? s.poNo : s.grnNo} - {s.supplier?.name}
                                            </option>
                                        ))}
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
                            {formData.items.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Invoice Items</h3>
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                                            <tr>
                                                <th className="p-3">Product</th>
                                                <th className="p-3">Qty Avail</th>
                                                <th className="p-3 w-32">Qty Billed</th>
                                                <th className="p-3 w-32">Rate</th>
                                                <th className="p-3 w-32">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                            {formData.items.map((item: any, i: number) => (
                                                <tr key={i}>
                                                    <td className="p-2">
                                                        <span className="font-medium">{item.productName}</span>
                                                    </td>
                                                    <td className="p-2 opacity-70">{item.qtyAvailable}</td>
                                                    <td className="p-2">
                                                        <input
                                                            type="number"
                                                            className="w-full p-2 border rounded dark:bg-slate-800"
                                                            value={item.qty}
                                                            onChange={e => updateItem(i, 'qty', parseFloat(e.target.value))}
                                                            max={item.qtyAvailable}
                                                            min="0"
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <input
                                                            type="number"
                                                            className="w-full p-2 border rounded dark:bg-slate-800"
                                                            value={item.rate}
                                                            onChange={e => updateItem(i, 'rate', parseFloat(e.target.value))}
                                                        />
                                                    </td>
                                                    <td className="p-2 font-mono text-right">
                                                        {item.total.toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold">
                                            <tr>
                                                <td colSpan={4} className="p-3 text-right">Total Amount:</td>
                                                <td className="p-3 text-right">
                                                    {formData.items.reduce((sum: number, item: any) => sum + (item.total || 0), 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:shadow-indigo-500/30">Create Invoice</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
