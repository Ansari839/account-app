
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation"; // Correct import for App Router
import MainLayout from "@/components/MainLayout";
import { ArrowLeft, Printer } from "lucide-react";

export default function PurchaseReturnDetailPage() {
    // Correctly unwrap params using React.use() for newer Next.js or just standard params usage
    // In Client Components, useParams() hook is best
    const params = useParams();
    const id = params?.id as string;

    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetchReturn();
        }
    }, [id]);

    const fetchReturn = async () => {
        try {
            const res = await fetch(`/api/finance/purchase/returns/${id}`);
            const json = await res.json();
            if (json.success) {
                setData(json.data);
            } else {
                alert(json.error);
                router.push("/finance/purchase/returns");
            }
        } catch (error) {
            console.error("Failed to fetch return", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <MainLayout><div>Loading...</div></MainLayout>;
    if (!data) return <MainLayout><div>Return not found.</div></MainLayout>;

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
                            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                                {data.returnNo}
                                <span className="text-sm font-medium bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                                    RETURN
                                </span>
                            </h1>
                            <p className="text-slate-500 text-sm">Created on {new Date(data.createdAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 font-medium text-sm shadow-sm transition-all">
                        <Printer size={16} /> Print
                    </button>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Supplier Details</h3>
                        <p className="font-bold text-slate-800 text-lg mb-1">{data.supplier?.name}</p>
                        <p className="text-slate-500 text-sm">{data.supplier?.code}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Reference Info</h3>
                        <div className="space-y-3">
                            <div>
                                <p className="text-xs text-slate-500 mb-0.5">Original Invoice</p>
                                <p className="font-mono font-medium text-indigo-600">{data.invoice?.invoiceNo}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-0.5">Warehouse</p>
                                <p className="font-medium text-slate-700">{data.warehouse?.name}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Summary</h3>
                        <div>
                            <p className="text-xs text-slate-500 mb-0.5">Total Return Amount</p>
                            <p className="text-2xl font-bold text-rose-600">{Number(data.totalAmount).toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-bold text-slate-800">Returned Items</h3>
                    </div>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                            <tr>
                                <th className="px-6 py-3">Product</th>
                                <th className="px-6 py-3 text-right">Qty</th>
                                <th className="px-6 py-3 text-right">Rate</th>
                                <th className="px-6 py-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.items?.map((item: any) => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-700">{item.product?.name}</td>
                                    <td className="px-6 py-4 text-right font-mono text-slate-600">{item.qty}</td>
                                    <td className="px-6 py-4 text-right font-mono text-slate-600">{item.rate}</td>
                                    <td className="px-6 py-4 text-right font-bold font-mono text-slate-800">{item.total}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold text-slate-700">
                            <tr>
                                <td className="px-6 py-3 text-right" colSpan={3}>Total</td>
                                <td className="px-6 py-3 text-right">{Number(data.totalAmount).toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </MainLayout>
    );
}
