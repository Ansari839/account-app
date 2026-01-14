
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { authenticatedFetch } from "@/lib/api-client";
import { Plus, Search, Eye, Edit, Trash2 } from "lucide-react";
import debounce from "lodash/debounce";
import DataTable, { Column } from "@/components/DataTable";

export default function PurchaseReturnsPage() {
    const router = useRouter();
    const [returns, setReturns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

    const fetchReturns = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
                search
            });
            const res = await authenticatedFetch(`/api/finance/purchase/returns?${params}`);
            const json = await res.json();
            if (json.success) {
                setReturns(json.data);
                setPagination(json.pagination);
            }
        } catch (error) {
            console.error("Failed to fetch returns", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReturns();
    }, [pagination.page, search]);

    const handleSearch = debounce((e: any) => {
        setSearch(e.target.value);
        setPagination({ ...pagination, page: 1 });
    }, 500);

    const columns: Column<any>[] = [
        { header: "Return No", accessor: "returnNo", className: "font-mono font-bold text-indigo-600" },
        { header: "Date", accessor: (row) => new Date(row.date).toLocaleDateString() },
        { header: "Supplier", accessor: (row) => row.supplier?.name },
        { header: "Warehouse", accessor: (row) => row.warehouse?.name },
        { header: "Invoice Ref", accessor: (row) => row.invoice?.invoiceNo, className: "font-mono text-xs" },
        { header: "Amount", accessor: (row) => row.totalAmount?.toLocaleString(), className: "text-right font-bold" },
        {
            header: "Actions",
            accessor: (row) => (
                <div className="flex gap-2 justify-center">
                    <button
                        onClick={() => router.push(`/finance/purchase/returns/${row.id}`)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 transition-colors"
                        title="View"
                    >
                        <Eye size={16} />
                    </button>
                    {/* Edit Button */}
                    <button
                        onClick={() => router.push(`/finance/purchase/returns/${row.id}/edit`)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-amber-600 transition-colors"
                        title="Edit"
                    >
                        <Edit size={16} />
                    </button>
                    {/* Delete Button */}
                    <button
                        onClick={() => handleDelete(row.id)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-red-600 transition-colors"
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            ),
            className: "w-24 text-center"
        }
    ];

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this Purchase Return? This will reverse stock and accounting entries.")) return;

        try {
            const res = await authenticatedFetch(`/api/finance/purchase/returns/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) {
                fetchReturns();
            } else {
                alert("Failed to delete: " + json.error);
            }
        } catch (err) {
            console.error("Delete Error", err);
            alert("An error occurred while deleting.");
        }
    };

    return (
        <MainLayout>
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-slate-800">Purchase Returns</h1>
                    <button
                        onClick={() => router.push("/finance/purchase/returns/new")}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
                    >
                        <Plus size={16} />
                        New Return
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by Return No, Supplier, or Invoice..."
                                onChange={handleSearch}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-sm text-slate-700 placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    <div className="p-4">
                        <DataTable
                            data={returns}
                            columns={columns}
                            isLoading={loading}
                            pagination={{
                                currentPage: pagination.page,
                                totalPages: pagination.totalPages,
                                onPageChange: (page) => setPagination({ ...pagination, page })
                            }}
                        />
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
