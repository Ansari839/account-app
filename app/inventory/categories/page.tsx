"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import DataTable, { Column } from '@/components/DataTable';
import { useRouter } from 'next/navigation';

interface Category {
    id: string;
    name: string;
    parentId?: string;
    parent?: { name: string };
    _count?: { products: number };
}

export default function CategoriesPage() {
    const router = useRouter();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', parentId: '' });

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch('/api/inventory/categories');
            const json = await res.json();
            if (json.success) setCategories(json.data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const url = editingId
            ? `/api/inventory/categories/${editingId}`
            : '/api/inventory/categories';

        const method = editingId ? 'PUT' : 'POST';

        const res = await authenticatedFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (res.ok) {
            setIsModalOpen(false);
            setEditingId(null);
            setFormData({ name: '', parentId: '' });
            fetchCategories();
        } else {
            alert("Failed to save category");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        const res = await authenticatedFetch(`/api/inventory/categories/${id}`, { method: 'DELETE' });
        if (res.ok) fetchCategories();
        else alert("Failed to delete. Ensure no products exist in this category.");
    };

    const openEdit = (cat: Category) => {
        setEditingId(cat.id);
        setFormData({ name: cat.name, parentId: cat.parentId || '' });
        setIsModalOpen(true);
    };

    const columns: Column<Category>[] = [
        { header: 'Name', accessor: 'name' },
        { header: 'Parent Category', accessor: (row: any) => row.parent?.name || '-' },
        {
            header: 'Actions',
            accessor: (row: any) => (
                <div className="flex gap-2">
                    <button onClick={() => openEdit(row)} className="text-blue-500 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(row.id)} className="text-red-500 hover:underline">Delete</button>
                </div>
            )
        }
    ];

    return (
        <MainLayout>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Categories</h1>
                <button
                    onClick={() => { setEditingId(null); setFormData({ name: '', parentId: '' }); setIsModalOpen(true); }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                >
                    + New Category
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <DataTable
                    data={categories}
                    columns={columns}
                    isLoading={loading}
                />
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl w-96">
                        <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit Category' : 'New Category'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2 border rounded dark:bg-slate-800"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Parent Category</label>
                                <select
                                    className="w-full p-2 border rounded dark:bg-slate-800"
                                    value={formData.parentId}
                                    onChange={e => setFormData({ ...formData, parentId: e.target.value })}
                                >
                                    <option value="">None</option>
                                    {categories.filter(c => c.id !== editingId).map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
