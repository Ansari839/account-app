'use client';

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import {
    BookOpen, Plus, Search, ChevronDown,
    ChevronRight, Folder, FileText,
    Edit3, Trash2, PieChart, Layers, Info, X as CloseIcon,
    Sparkles, CheckCircle2, AlertCircle
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
    const [seeding, setSeeding] = useState(false);
    const [seedResult, setSeedResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
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

    // Handle ESC key to close modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowModal(false);
            }
        };
        if (showModal) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal]);

    const getAuthHeaders = () => ({
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'x-company-id': localStorage.getItem('activeCompanyId') || '',
    });

    const fetchAccounts = async () => {
        try {
            const res = await fetch('/api/accounts', { headers: getAuthHeaders() });
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

    const handleSeedCOA = async () => {
        if (!confirm('Yeh action standard Pakistani Chart of Accounts seed karega.\n\nPehle se moujood accounts update NAHI honge (idempotent).\n\nContinue?')) return;
        setSeeding(true);
        setSeedResult(null);
        try {
            const res = await fetch('/api/finance/coa/seed', {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (data.success) {
                setSeedResult({ type: 'success', message: `✓ ${data.data.created} accounts created, ${data.data.skipped} already existed` });
                fetchAccounts();
                setExpandedIds(new Set()); // reset expand state
            } else {
                setSeedResult({ type: 'error', message: data.error || 'Seed failed' });
            }
        } catch (err) {
            setSeedResult({ type: 'error', message: 'Network error. Please try again.' });
        } finally {
            setSeeding(false);
            setTimeout(() => setSeedResult(null), 6000);
        }
    };

    useEffect(() => {
        const fetchSuggestedCode = async () => {
            if (!formData.parentId || editingAccount) return;
            try {
                const res = await fetch(`/api/accounts?suggestCode=true&parentId=${formData.parentId}`, {
                    headers: getAuthHeaders()
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

    const toggleAllExpand = () => {
        if (expandedIds.size > accounts.length / 2) {
            setExpandedIds(new Set());
        } else {
            setExpandedIds(new Set(accounts.map(a => a.id)));
        }
    };

    const handleSaveAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const method = editingAccount ? 'PATCH' : 'POST';
            const res = await fetch('/api/accounts', {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
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
            const res = await fetch(`/api/accounts?id=${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
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

    const getFilteredAccounts = () => {
        if (!searchTerm) return accounts;

        const term = searchTerm.toLowerCase();
        const matches = accounts.filter(a =>
            a.name.toLowerCase().includes(term) ||
            a.code.toLowerCase().includes(term) ||
            a.type.toLowerCase().includes(term)
        );

        const resultIds = new Set<string>();
        matches.forEach(match => {
            resultIds.add(match.id);
            // Add all parents
            let parentId = match.parentId;
            while (parentId) {
                const parent = accounts.find(a => a.id === parentId);
                if (parent && !resultIds.has(parentId)) {
                    resultIds.add(parentId);
                    parentId = parent.parentId;
                } else {
                    break;
                }
            }
        });

        return accounts.filter(a => resultIds.has(a.id));
    };

    const filteredAccounts = getFilteredAccounts();
    const tree = buildTree(filteredAccounts);

    useEffect(() => {
        if (searchTerm) {
            setExpandedIds(new Set(filteredAccounts.map(a => a.id)));
        }
    }, [searchTerm, accounts]);

    const renderNode = (node: Account, depth: number = 0) => {
        const isExpanded = expandedIds.has(node.id);
        const hasChildren = node.children && node.children.length > 0;

        return (
            <div key={node.id} className="select-none">
                <div
                    className={`flex items-center group py-3 px-4 rounded-xl transition-all ${depth === 0 ? 'bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 mb-2' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                        }`}
                    style={{ marginLeft: `${depth * 24}px` }}
                >
                    <button
                        onClick={() => hasChildren && toggleExpand(node.id)}
                        className={`p-1 rounded-lg transition-colors ${hasChildren ? 'text-slate-400 hover:text-slate-900 dark:hover:text-white' : 'text-transparent cursor-default'}`}
                    >
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>

                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 ${node.type === 'ASSET' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                        node.type === 'LIABILITY' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                            node.type === 'REVENUE' || node.type === 'INCOME' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                                'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}>
                        {hasChildren ? <Folder size={18} /> : <FileText size={18} />}
                    </div>

                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <span className="text-slate-900 dark:text-white font-bold">{node.name}</span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800">
                                {node.code}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{node.type}</p>
                    </div>

                    <div className="mr-4">
                        {node.isPosting ? (
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/20">
                                Posting
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
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
                            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 shadow-sm transition-all font-bold"
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
                            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-500 dark:hover:text-emerald-400 shadow-sm transition-all font-bold"
                        >
                            <Plus size={16} />
                        </button>
                        <button
                            onClick={() => handleDeleteAccount(node.id)}
                            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 shadow-sm transition-all font-bold"
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
                        <button
                            onClick={toggleAllExpand}
                            className="px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                        >
                            <Layers size={16} />
                            {expandedIds.size > accounts.length / 2 ? 'Collapse All' : 'Full Expand'}
                        </button>
                        {accounts.length === 0 && (
                            <button
                                onClick={handleSeedCOA}
                                disabled={seeding}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {seeding ? (
                                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Seeding...</>
                                ) : (
                                    <><Sparkles size={16} /> Auto Seed COA</>
                                )}
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setEditingAccount(null);
                                setFormData({ id: '', code: '', name: '', type: 'ASSET', description: '', parentId: '', isPosting: true, openingBalance: '0', openingBalanceType: 'DR' });
                                setShowModal(true);
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all flex items-center gap-2"
                        >
                            <Plus size={18} strokeWidth={3} />
                            New Account
                        </button>
                    </div>
                </div>

                {/* Seed Result Toast */}
                {seedResult && (
                    <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border text-sm font-bold animate-in slide-in-from-top-2 duration-300 ${
                        seedResult.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
                    }`}>
                        {seedResult.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        {seedResult.message}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search by name, code or type..."
                                className="w-full bg-white dark:bg-slate-900/40 shadow-sm border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-400 dark:text-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Accounts</p>
                            <p className="text-2xl font-bold dark:text-white">{accounts.length}</p>
                        </div>
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                            <PieChart size={20} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900/40 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm min-h-[400px]">
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
                <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] flex items-start gap-6 shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-indigo-500 dark:text-slate-400 flex-shrink-0">
                        <Info size={24} />
                    </div>
                    <div>
                        <h4 className="text-slate-900 dark:text-white font-black uppercase tracking-tight mb-2">Hierarchy Management</h4>
                        <p className="text-slate-600 dark:text-slate-500 text-sm font-medium leading-relaxed">
                            Use the Chart of Accounts to define your financial reporting structure. Parent accounts act as headers (aggregators), while child accounts are used for direct transaction entries.
                        </p>
                    </div>
                </div>

                {/* Management Modal */}
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop - no onClick handler to prevent accidental close */}
                        <div className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm" />
                        
                        <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white">{editingAccount ? 'Edit Account' : 'New Account'}</h3>
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Manage Financial Structure</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all">
                                    <CloseIcon size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleSaveAccount} className="p-6 space-y-5">
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Account Code</label>
                                        <input
                                            required
                                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 font-mono transition-all placeholder:text-slate-400"
                                            value={formData.code}
                                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                                            placeholder="e.g. 1000"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Type</label>
                                        <select
                                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-xs font-black uppercase tracking-widest transition-all"
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
                                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Account Name</label>
                                    <input
                                        required
                                        className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-slate-400"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Cash in Hand"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Parent Account</label>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm font-bold transition-all"
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
                                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-sm"></div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-900 dark:text-slate-300">Is Posting Account?</p>
                                            <p className="text-[10px] text-slate-500">Allow transactions to be posted to this account</p>
                                        </div>
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Opening Balance</label>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-slate-400"
                                            value={formData.openingBalance}
                                            onChange={e => setFormData({ ...formData, openingBalance: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Balance Type</label>
                                        <select
                                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-[10px] font-black uppercase tracking-widest transition-all"
                                            value={formData.openingBalanceType}
                                            onChange={e => setFormData({ ...formData, openingBalanceType: e.target.value as any })}
                                        >
                                            <option value="DR">Debit (DR)</option>
                                            <option value="CR">Credit (CR)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Description</label>
                                    <textarea
                                        rows={2}
                                        className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm transition-all placeholder:text-slate-400"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Optional description"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
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
