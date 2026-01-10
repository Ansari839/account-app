
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/api-client";
import MainLayout from "@/components/MainLayout";
import { ArrowLeft, Save, Trash2, Plus } from "lucide-react";

export default function CreatePurchaseReturnPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Master Data
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        supplierId: "",
        warehouseId: "",
        date: new Date().toISOString().split('T')[0],
        remarks: "",
        items: [] as any[]
    });

    useEffect(() => {
        fetchMasterData();
    }, []);

    const fetchMasterData = async () => {
        try {
            const [supRes, whRes, prodRes] = await Promise.all([
                authenticatedFetch("/api/finance/parties/suppliers"),
                authenticatedFetch("/api/inventory/warehouses"),
                authenticatedFetch("/api/inventory/products")
            ]);

            if (supRes.ok) {
                const json = await supRes.json();
                setSuppliers(json.data || []);
            }

            if (whRes.ok) {
                const json = await whRes.json();
                setWarehouses(json.data || []);
            }

            if (prodRes.ok) {
                const json = await prodRes.json();
                if (Array.isArray(json.data)) {
                    setProducts(json.data);
                } else if (json.data && Array.isArray(json.data.products)) {
                    setProducts(json.data.products); // Handle potential paginated structure
                } else {
                    setProducts(json.data || []);
                }
            }

        } catch (error) {
            console.error("Failed to fetch master data", error);
        }
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        // @ts-ignore
        const item = { ...newItems[index], [field]: value };

        if (field === 'productId') {
            const product = products.find(p => p.id === value);
            if (product) {
                // Determine rate (use purchasePrice or costPrice)
                item.rate = Number(product.purchasePrice || product.costPrice || 0);
            }
        }

        // Recalculate Total
        item.total = Number(item.qty || 0) * Number(item.rate || 0);

        newItems[index] = item;
        setFormData({ ...formData, items: newItems });
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { productId: "", qty: 1, rate: 0, total: 0 }]
        });
    };

    const removeItem = (index: number) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const handleSubmit = async () => {
        // Validate
        if (!formData.supplierId || !formData.warehouseId) {
            alert("Please select Supplier and Warehouse");
            return;
        }

        const validItems = formData.items.filter(i => i.productId && i.qty > 0);
        if (validItems.length === 0) {
            alert("Please add at least one valid item.");
            return;
        }

        setLoading(true);
        try {
            const res = await authenticatedFetch("/api/finance/purchase/returns", {
                method: "POST",
                body: JSON.stringify({
                    supplierId: formData.supplierId,
                    warehouseId: formData.warehouseId,
                    date: formData.date,
                    remarks: formData.remarks,
                    items: validItems.map(i => ({
                        productId: i.productId,
                        qty: Number(i.qty),
                        rate: Number(i.rate)
                    }))
                })
            });
            const json = await res.json();
            if (json.success) {
                router.push(`/finance/purchase/returns/${json.data.id}`);
            } else {
                alert(json.error || "Failed to create return");
            }
        } catch (error) {
            console.error("Submit error", error);
            alert("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const totalReturnAmount = formData.items.reduce((acc, item) => acc + (Number(item.qty || 0) * Number(item.rate || 0)), 0);

    return (
        <MainLayout>
            <div className="p-6 max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">New Purchase Return / Debit Note</h1>
                            <p className="text-slate-500 text-sm">Directly return items to supplier</p>
                        </div>
                    </div>
                </div>

                {/* Form Container */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Top Section: Supplier / Warehouse / Date */}
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Supplier */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Supplier</label>
                                <select
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                    value={formData.supplierId}
                                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                                >
                                    <option value="">Select Supplier</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            {/* Warehouse */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Warehouse</label>
                                <select
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                    value={formData.warehouseId}
                                    onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                                >
                                    <option value="">Select Warehouse</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>

                            {/* Date */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Return Date</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Remarks */}
                        <div className="mt-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Remarks / Reason</label>
                            <textarea
                                rows={2}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none"
                                placeholder="Enter reason for return..."
                                value={formData.remarks}
                                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="p-0">
                        <div className="px-6 py-3 border-b border-slate-100 flex justify-between items-center bg-white">
                            <h3 className="font-bold text-slate-700">Items</h3>
                            <button
                                onClick={addItem}
                                className="flex items-center gap-1 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                            >
                                <Plus size={14} /> Add Item
                            </button>
                        </div>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-3 w-[40%]">Product</th>
                                    <th className="px-6 py-3 w-[15%] text-right">Qty</th>
                                    <th className="px-6 py-3 w-[15%] text-right">Rate</th>
                                    <th className="px-6 py-3 w-[20%] text-right">Total</th>
                                    <th className="px-6 py-3 w-[10%]"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {formData.items.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                                            No items added yet. Click "Add Item" to start.
                                        </td>
                                    </tr>
                                )}
                                {formData.items.map((item, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-2">
                                            <select
                                                className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded px-2 py-1 outline-none"
                                                value={item.productId}
                                                onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                                            >
                                                <option value="">Select Product...</option>
                                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-6 py-2">
                                            <input
                                                type="number"
                                                className="w-full text-right bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded px-2 py-1 outline-none"
                                                placeholder="0"
                                                value={item.qty}
                                                onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-6 py-2">
                                            <input
                                                type="number"
                                                className="w-full text-right bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded px-2 py-1 outline-none"
                                                placeholder="0.00"
                                                value={item.rate}
                                                onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-6 py-2 text-right font-bold text-slate-700">
                                            {item.total.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-2 text-center">
                                            <button
                                                onClick={() => removeItem(idx)}
                                                className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-100">
                                <tr>
                                    <td colSpan={3} className="px-6 py-4 text-right font-bold text-slate-500 uppercase text-xs tracking-wider">Total Amount</td>
                                    <td className="px-6 py-4 text-right font-black text-xl text-slate-800">{totalReturnAmount.toLocaleString()}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSubmit}
                        disabled={loading || totalReturnAmount <= 0}
                        className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? 'Processing...' : (
                            <>
                                <Save size={18} />
                                Confirm Return
                            </>
                        )}
                    </button>
                </div>
            </div>
        </MainLayout>
    );
}
