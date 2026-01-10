'use client';

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import {
    BookOpen, Plus, Search, ChevronDown,
    ChevronRight, Folder, FileText,
    MoreVertical, Edit3, Trash2,
    PieChart, Layers, Info
} from 'lucide-react';

interface Account {
    id: string;
    code: string;
    name: string;
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | 'INCOME';
    description: string | null;
    parentId: string | null;
    openingBalance?: number | string;
    openingBalanceType?: 'DR' | 'CR';
    isPosting: boolean;
    children?: Account[];
    _count?: { children: number };
}

export default function ChartOfAccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [showModal, setShowModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [formData, setFormData] = useState({
        id: '',
        code: '',
        name: '',
        type: 'EXPENSE' as any,
        description: '',
        parentId: '',
        isPosting: true,
        openingBalance: '0',
        openingBalanceType: 'DR' as 'DR' | 'CR'
    });

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/accounts', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAccounts(data.accounts);
            }
        } catch (err) {
            console.error('Fetch accounts failed');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchSuggestedCode = async () => {
            if (!formData.parentId || editingAccount) return;
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/accounts?suggestCode=true&parentId=${formData.parentId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.nextCode) {
                        setFormData(prev => ({ ...prev, code: data.nextCode }));
                    }
                }
            } catch (err) {
                console.error('Fetch suggested code failed');
            }
        };
        fetchSuggestedCode();
    }, [formData.parentId, editingAccount]);

    const buildTree = (list: Account[], parentId: string | null = null): Account[] => {
        return list
            .filter(a => a.parentId === parentId)
            .map(a => ({ ...a, children: buildTree(list, a.id) }));
    };

    const toggleExpand = (id: string) => {
        const next = new Set(expandedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedIds(next);
    };

    const handleSaveAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const method = editingAccount ? 'PATCH' : 'POST';
            const res = await fetch('/api/accounts', {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                setShowModal(false);
                fetchAccounts();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to save account');
            }
        } catch (err) {
            console.error('Save account error:', err);
        }
    };

    const handleDeleteAccount = async (id: string) => {
        if (!confirm('Are you sure you want to delete this account? This will check for children and transactions.')) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/accounts?id=${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchAccounts();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete account');
            }
        } catch (err) {
            console.error('Delete account error:', err);
        }
    };

    const tree = buildTree(accounts);

    const renderNode = (node: Account, depth: number = 0) => {
        const isExpanded = expandedIds.has(node.id);
        const hasChildren = node.children && node.children.length > 0;

        return (
            <div key={node.id} className="select-none">
                <div
                    className={`flex items-center group py-3 px-4 rounded-xl transition-all ${depth === 0 ? 'bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 mb-2 shadow-sm' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                        }`}
                    style={{ marginLeft: `${depth * 24}px` }}
                >
                    <button
                        onClick={() => hasChildren && toggleExpand(node.id)}
                        className={`p-1 rounded-lg transition-colors ${hasChildren ? 'text-slate-400 hover:text-white' : 'text-transparent cursor-default'}`}
                    >
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>

                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 ${node.type === 'ASSET' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        node.type === 'LIABILITY' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            node.type === 'REVENUE' || node.type === 'INCOME' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                        {hasChildren ? <Folder size={18} /> : <FileText size={18} />}
                    </div>

                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <span className="text-slate-900 dark:text-white font-bold">{node.name}</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800">
                                {node.code}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{node.type}</p>
                    </div>

                    <div className="mr-4">
                        {node.isPosting ? (
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                Posting
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">
                                Group
                            </span>
                        )}
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                        <button
                            onClick={() => {
                                setEditingAccount(node);
                                setFormData({
                                    id: node.id,
                                    code: node.code,
                                    name: node.name,
                                    type: node.type,
                                    description: node.description || '',
                                    parentId: node.parentId || '',
                                    isPosting: node.isPosting,
                                    openingBalance: node.openingBalance?.toString() || '0',
                                    openingBalanceType: node.openingBalanceType || 'DR' as any
                                });
                                setShowModal(true);
                            }}
                            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 hover:text-blue-400 transition-all font-bold"
                        >
                            <Edit3 size={16} />
                        </button>
                        <button
                            onClick={() => {
                                setEditingAccount(null);
                                setFormData({
                                    id: '',
                                    code: '',
                                    name: '',
                                    type: node.type,
                                    description: '',
                                    parentId: node.id,
                                    isPosting: true,
                                    openingBalance: '0',
                                    openingBalanceType: 'DR'
                                });
                                setShowModal(true);
                            }}
                            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 hover:text-emerald-400 transition-all font-bold"
                        >
                            <Plus size={16} />
                        </button>
                        <button
                            onClick={() => handleDeleteAccount(node.id)}
                            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 hover:text-red-400 transition-all font-bold"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
                {isExpanded && hasChildren && (
                    <div className="animate-in slide-in-from-top-1 duration-200">
                        {node.children!.map(child => renderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                            Chart of Accounts
                        </h1>
                        <p className="text-slate-500 mt-1 uppercase text-[10px] font-bold tracking-widest">Financial Structure & Hierarchy</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2">
                            <Layers size={16} />
                            Full Expand
                        </button>
                        <button
                            onClick={() => {
                                setEditingAccount(null);
                                setFormData({ id: '', code: '', name: '', type: 'ASSET', description: '', parentId: '', isPosting: true, openingBalance: '0', openingBalanceType: 'DR' });
                                setShowModal(true);
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all flex items-center gap-2"
                        >
                            <Plus size={18} />
                            New Account
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search by name, code or type..."
                                className="w-full bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Accounts</p>
                            <p className="text-2xl font-bold">{accounts.length}</p>
                        </div>
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                            <PieChart size={20} className="text-indigo-500" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900/40 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800/60 shadow-sm min-h-[400px]">
                    {loading ? (
                        <div className="h-[300px] flex flex-col items-center justify-center">
                            <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-4" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Loading Hierarchy...</p>
                        </div>
                    ) : tree.length === 0 ? (
                        <div className="h-[300px] flex flex-col items-center justify-center opacity-40">
                            <BookOpen size={40} className="text-slate-400 mb-4" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No accounts found</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {tree.map(node => renderNode(node))}
                        </div>
                    )}
                </div>

                {/* Info Card */}
                <div className="bg-slate-900/40 border border-slate-800/60 p-8 rounded-[2.5rem] flex items-start gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                        <Info size={24} />
                    </div>
                    <div>
                        <h4 className="text-white font-black uppercase tracking-tight mb-2">Hierarchy Management</h4>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed">
                            Use the Chart of Accounts to define your financial reporting structure. Parent accounts act as headers (aggregators), while child accounts are used for direct transaction entries.
                        </p>
                    </div>
                </div>
                {/* Management Modal */}
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                        <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                                <h3 className="text-xl font-bold">{editingAccount ? 'Edit Account' : 'New Account'}</h3>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Manage Financial Structure</p>
                            </div>
                            <form onSubmit={handleSaveAccount} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Account Code</label>
                                        <input
                                            required
                                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                            value={formData.code}
                                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                                            placeholder="e.g. 1000"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Type</label>
                                        <select
                                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-black uppercase tracking-widest"
                                            value={formData.type}
                                            onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                        >
                                            <option value="ASSET">Asset</option>
                                            <option value="LIABILITY">Liability</option>
                                            <option value="EQUITY">Equity</option>
                                            <option value="REVENUE">Revenue</option>
                                            <option value="EXPENSE">Expense</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Account Name</label>
                                    <input
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Cash in Hand"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Parent Account</label>
                                    <select
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                        value={formData.parentId}
                                        onChange={e => {
                                            const pid = e.target.value;
                                            const parent = accounts.find(a => a.id === pid);
                                            setFormData({
                                                ...formData,
                                                parentId: pid,
                                                type: parent ? parent.type : formData.type
                                            });
                                        }}
                                    >
                                        <option value="">Root Account (No Parent)</option>
                                        {accounts.filter(a => a.id !== formData.id).map(a => (
                                            <option key={a.id} value={a.id}>({a.code}) {a.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-4 pt-2">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                className="peer sr-only"
                                                checked={formData.isPosting}
                                                onChange={e => setFormData({ ...formData, isPosting: e.target.checked })}
                                            />
                                            <div className="w-10 h-6 bg-slate-200 dark:bg-slate-800 rounded-full peer-checked:bg-indigo-600 transition-colors"></div>
                                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Is Posting Account?</p>
                                            <p className="text-[10px] text-slate-500">Allow transactions to be posted to this account</p>
                                        </div>
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Opening Balance</label>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={formData.openingBalance}
                                            onChange={e => setFormData({ ...formData, openingBalance: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Balance Type</label>
                                        <select
                                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-[10px] font-black uppercase tracking-widest"
                                            value={formData.openingBalanceType}
                                            onChange={e => setFormData({ ...formData, openingBalanceType: e.target.value as any })}
                                        >
                                            <option value="DR">Debit (DR)</option>
                                            <option value="CR">Credit (CR)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Description</label>
                                    <textarea
                                        rows={2}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-widest text-[10px] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                                    >
                                        {editingAccount ? 'Update Account' : 'Create Account'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
