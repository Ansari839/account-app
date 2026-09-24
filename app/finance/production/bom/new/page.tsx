"use client";

import React, { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/api-client";
import { Save, X, Plus, Trash2, Box, Loader2 } from "lucide-react";
import Combobox from "@/components/Combobox";

export default function NewBOMPage() {
    const router = useRouter();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        outputProductId: "",
        outputQuantity: 1,
        inputs: [{ id: Date.now().toString(), productId: "", quantity: 1 }]
    });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await authenticatedFetch("/api/inventory/products");
            const json = await res.json();
            if (json.success) {
                setProducts(json.data);
            }
        } catch (error) {
            console.error("Failed to fetch products", error);
        } finally {
            setLoading(false);
        }
    };

    const addInput = () => {
        setFormData({
            ...formData,
            inputs: [...formData.inputs, { id: Date.now().toString(), productId: "", quantity: 1 }]
        });
    };

    const removeInput = (id: string) => {
        setFormData({
            ...formData,
            inputs: formData.inputs.filter(item => item.id !== id)
        });
    };

    const updateInput = (id: string, field: string, value: any) => {
        setFormData({
            ...formData,
            inputs: formData.inputs.map(item => item.id === id ? { ...item, [field]: value } : item)
        });
    };

    const handleSave = async () => {
        if (!formData.name || !formData.outputProductId || formData.inputs.some(i => !i.productId)) {
            alert("Please fill all required fields.");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: formData.name,
                outputProductId: formData.outputProductId,
                outputQuantity: Number(formData.outputQuantity),
                inputs: formData.inputs.map(i => ({
                    productId: i.productId,
                    quantity: Number(i.quantity)
                }))
            };

            const res = await authenticatedFetch("/api/finance/production/bom", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            if (json.success) {
                router.push("/finance/production/bom");
            } else {
                alert(json.error || "Failed to save BOM");
            }
        } catch (error) {
            console.error("Save error:", error);
            alert("Failed to save BOM");
        } finally {
            setSaving(false);
        }
    };

    const productOptions = products.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }));

    return (
        <MainLayout>
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden border border-slate-800">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    <div className="relative z-10">
                        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                            Create BOM Template
                        </h1>
                        <p className="text-slate-400 mt-1 font-medium">Define a new recipe for manufacturing</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm space-y-8">
                    {/* Basic Details */}
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">Formula Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Recipe Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Denim Fabric 75/72 Production"
                                    className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                />
                            </div>
                            
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Output Product (Finished Good)</label>
                                <Combobox
                                    options={productOptions}
                                    value={formData.outputProductId}
                                    onChange={(val) => setFormData({ ...formData, outputProductId: val })}
                                    placeholder="Select output product..."
                                    searchPlaceholder="Search products..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                                />
                            </div>

                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Output Quantity</label>
                                <input
                                    type="number"
                                    value={formData.outputQuantity}
                                    onChange={e => setFormData({ ...formData, outputQuantity: parseFloat(e.target.value) })}
                                    min="0.01"
                                    step="any"
                                    className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Inputs */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-black text-slate-900 dark:text-white">Raw Materials (Inputs)</h2>
                            <button 
                                onClick={addInput}
                                className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg font-bold hover:bg-indigo-100 transition-colors text-sm"
                            >
                                <Plus size={16} /> Add Material
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {formData.inputs.map((input, index) => (
                                <div key={input.id} className="grid grid-cols-12 gap-4 items-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                    <div className="col-span-1 flex justify-center">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 text-xs">
                                            {index + 1}
                                        </div>
                                    </div>
                                    <div className="col-span-7">
                                        <Combobox
                                            options={productOptions}
                                            value={input.productId}
                                            onChange={(val) => updateInput(input.id, 'productId', val)}
                                            placeholder="Select raw material..."
                                            searchPlaceholder="Search materials..."
                                            className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                                            position={formData.inputs.length > 2 && index >= formData.inputs.length - 2 ? 'top' : 'bottom'}
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <input
                                            type="number"
                                            value={input.quantity}
                                            onChange={e => updateInput(input.id, 'quantity', parseFloat(e.target.value))}
                                            placeholder="Qty"
                                            min="0"
                                            step="any"
                                            className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-center"
                                        />
                                    </div>
                                    <div className="col-span-1 flex justify-center">
                                        <button 
                                            onClick={() => removeInput(input.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {formData.inputs.length === 0 && (
                                <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                                    <p className="text-slate-500 font-medium">No raw materials added. Click "Add Material" to define inputs.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-4">
                    <button 
                        onClick={() => router.back()}
                        className="px-6 py-3 font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/30"
                    >
                        {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                        {saving ? "Saving..." : "Save Template"}
                    </button>
                </div>
            </div>
        </MainLayout>
    );
}
