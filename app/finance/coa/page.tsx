"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';

interface Account {
    id: string;
    code: string;
    name: string;
    type: string;
    isPosting: boolean;
    level: number;
    parentId: string | null;
    children?: Account[];
}

export default function COAPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        id: '',
        name: '',
        type: 'ASSET',
        parentId: '',
        isPosting: true,
        openingBalance: 0,
        openingBalanceType: 'DR'
    });

    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    const toggleNode = (id: string) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedNodes(newExpanded);
    };

    const expandAll = () => {
        const allIds = new Set<string>();
        const traverse = (items: Account[]) => {
            items.forEach(item => {
                if (item.children && item.children.length > 0) {
                    allIds.add(item.id);
                    traverse(item.children);
                }
            });
        };
        traverse(accounts);
        setExpandedNodes(allIds);
    };

    const collapseAll = () => setExpandedNodes(new Set());

    const fetchAccounts = () => {
        setIsLoading(true);
        authenticatedFetch('/api/finance/coa')
            .then(res => res.json())
            .then(json => {
                if (json.success) setAccounts(json.data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Fetch error:', err);
                setIsLoading(false);
            });
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleSubmit = async (e: React.FormEvent, isEdit = false) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const url = isEdit ? `/api/finance/coa/${formData.id}` : '/api/finance/coa';
            const method = isEdit ? 'PATCH' : 'POST';

            const res = await authenticatedFetch(url, {
                method,
                body: JSON.stringify({
                    name: formData.name,
                    type: formData.type,
                    isPosting: formData.isPosting,
                    parentId: formData.parentId || null,
                    openingBalance: parseFloat(formData.openingBalance.toString()) || 0,
                    openingBalanceType: formData.openingBalanceType
                })
            });
            const json = await res.json();

            if (!json.success) throw new Error(json.error || 'Operation failed');

            setIsCreateModalOpen(false);
            setIsEditModalOpen(false);
            setFormData({ id: '', name: '', type: 'ASSET', parentId: '', isPosting: true, openingBalance: 0, openingBalanceType: 'DR' });
            fetchAccounts();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this account?')) return;

        try {
            const res = await authenticatedFetch(`/api/finance/coa/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Failed to delete');
            fetchAccounts();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const openCreateModal = (parent?: any) => {
        setFormData({
            id: '',
            name: '',
            type: parent ? parent.type : 'ASSET',
            parentId: parent ? parent.id : '',
            isPosting: true,
            openingBalance: 0,
            openingBalanceType: 'DR'
        });
        setError(null);
        setIsCreateModalOpen(true);
    };

    const openEditModal = (acc: any) => {
        setFormData({
            id: acc.id,
            name: acc.name,
            type: acc.type,
            parentId: acc.parentId || '',
            isPosting: acc.isPosting,
            openingBalance: acc.openingBalance || 0,
            openingBalanceType: acc.openingBalanceType || 'DR'
        });
        setError(null);
        setIsEditModalOpen(true);
    };

    const getAccountColor = (type: string) => {
        switch (type) {
            case 'ASSET': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'LIABILITY': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 'EQUITY': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            case 'INCOME': return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
            case 'EXPENSE': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
            default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
        }
    };

    const AccountNode = ({ acc }: { acc: any }) => {
        const isExpanded = expandedNodes.has(acc.id);
        const hasChildren = acc.children && acc.children.length > 0;

        return (
            <div className="select-none">
                <div
                    className={`group relative flex items-center justify-between py-3 px-4 mb-2 rounded-2xl bg-[#0f172a] hover:bg-[#1e293b] border border-slate-800/50 hover:border-slate-700/50 transition-all duration-300 shadow-sm ${acc.level === 0 ? 'mt-4 first:mt-0 ring-1 ring-slate-800/30' : ''}`}
                    style={{ marginLeft: `${acc.level * 32}px` }}
                >
                    <div className="flex items-center gap-4">
                        <div className="flex items-center w-6">
                            {hasChildren ? (
                                <button
                                    onClick={() => toggleNode(acc.id)}
                                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-700/50 transition-colors text-slate-500"
                                >
                                    <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                    </span>
                                </button>
                            ) : null}
                        </div>

                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${acc.isPosting ? 'bg-slate-800/50' : 'bg-indigo-600/10 border border-indigo-500/20'}`}>
                            {acc.isPosting ? (
                                <span className="text-xl">📄</span>
                            ) : (
                                <span className="text-xl">📁</span>
                            )}
                        </div>

                        <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                                <span className={`text-sm font-bold tracking-wide ${acc.isPosting ? 'text-slate-200' : 'text-white uppercase'}`}>
                                    {acc.name}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-slate-400">
                                    {acc.code}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded-md border ${getAccountColor(acc.type)}`}>
                                    {acc.type}
                                </span>
                                {!acc.isPosting && (
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Summary Group</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {acc.isPosting && (acc.openingBalance !== undefined && acc.openingBalance !== null && Number(acc.openingBalance) !== 0) && (
                            <div className="text-right mr-2 hidden sm:block">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Opening</div>
                                <div className={`text-xs font-mono font-bold ${acc.openingBalanceType === 'DR' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {Number(acc.openingBalance).toLocaleString()} {acc.openingBalanceType}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pr-2">
                            <button
                                onClick={() => openEditModal(acc)}
                                className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all"
                                title="Edit Account"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" /></svg>
                            </button>

                            {!acc.isPosting && (
                                <button
                                    onClick={() => openCreateModal(acc)}
                                    className="p-2.5 text-emerald-500 hover:text-white hover:bg-emerald-500/20 rounded-xl transition-all"
                                    title="Add Sub-Account"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                                </button>
                            )}

                            <button
                                onClick={() => handleDelete(acc.id)}
                                className="p-2.5 text-rose-500 hover:text-white hover:bg-rose-500/20 rounded-xl transition-all"
                                title="Delete Account"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></svg>
                            </button>
                        </div>
                    </div>
                </div>

                {isExpanded && hasChildren && (
                    <div className="relative">
                        {/* More subtle connecting line */}
                        <div
                            className="absolute border-l border-slate-800/50 left-[51px] top-[-8px] bottom-2"
                            style={{ marginLeft: `${acc.level * 32}px` }}
                        />
                        {acc.children?.map((child: any) => (
                            <AccountNode key={child.id} acc={child} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderFlatGroups = (items: Account[]): any[] => {
        const list: any[] = [];
        const traverse = (data: Account[]) => {
            data.forEach(item => {
                if (!item.isPosting) {
                    list.push(item);
                    if (item.children) traverse(item.children);
                }
            });
        };
        traverse(items);
        return list;
    };

    const Modal = ({ isOpen, onClose, title, isEdit = false }: any) => {
        if (!isOpen) return null;
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#020617]/90 backdrop-blur-md animate-in fade-in duration-300">
                <div className="w-full max-w-xl bg-[#0f172a] rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-800/80 animate-in zoom-in-95 duration-400">
                    <div className="p-10 pb-4">
                        <h2 className="text-3xl font-bold text-white tracking-tight">{isEdit ? 'Edit Account' : 'New Account'}</h2>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">Manage Financial Structure</p>
                    </div>

                    <form onSubmit={(e) => handleSubmit(e, isEdit)} className="p-10 pt-6 space-y-6">
                        {error && (
                            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs font-bold flex items-center gap-2 mb-4">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Account Code</label>
                                <div className="w-full px-5 py-3.5 bg-[#020617] border border-slate-800 rounded-2xl text-slate-300 font-mono font-bold text-sm shadow-inner opacity-80 cursor-not-allowed">
                                    {formData.id ? (accounts.find(a => a.id === formData.id)?.code || 'AUTO') : 'AUTO GEN'}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Type</label>
                                <select
                                    disabled={isEdit}
                                    className="w-full px-5 py-3.5 bg-[#020617] border border-slate-800 rounded-2xl text-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all appearance-none disabled:opacity-50"
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="ASSET">ASSET</option>
                                    <option value="LIABILITY">LIABILITY</option>
                                    <option value="EQUITY">EQUITY</option>
                                    <option value="INCOME">REVENUE</option>
                                    <option value="EXPENSE">EXPENSES</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Account Name</label>
                            <input
                                required
                                type="text"
                                className="w-full px-5 py-3.5 bg-[#020617] border border-slate-800 rounded-2xl text-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-600 transition-all"
                                placeholder="e.g. Cash In Hand"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Parent Account</label>
                            <select
                                className="w-full px-5 py-3.5 bg-[#020617] border border-slate-800 rounded-2xl text-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                                value={formData.parentId}
                                onChange={e => setFormData({ ...formData, parentId: e.target.value })}
                            >
                                <option value="">None (Top Level Root)</option>
                                {renderFlatGroups(accounts).filter(a => a.id !== formData.id).map(a => (
                                    <option key={a.id} value={a.id}>({a.code}) {a.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-4 p-5 bg-[#020617]/50 border border-slate-800/50 rounded-[2rem]">
                            <div className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={formData.isPosting}
                                    onChange={e => setFormData({ ...formData, isPosting: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-white">Posting Account</span>
                                <span className="text-[10px] text-slate-500 font-medium">Allow journal vouchers and entries.</span>
                            </div>
                        </div>

                        {formData.isPosting && (
                            <div className="grid grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-300">
                                <div className="col-span-2 space-y-2">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Opening Balance</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full px-5 py-3.5 bg-[#020617] border border-slate-800 rounded-2xl text-emerald-400 font-mono font-bold text-lg outline-none focus:ring-2 focus:ring-emerald-500/40 placeholder:text-slate-700"
                                        placeholder="0.00"
                                        value={formData.openingBalance}
                                        onChange={e => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Nature</label>
                                    <select
                                        className="w-full px-5 py-3.5 bg-[#020617] border border-slate-800 rounded-2xl text-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
                                        value={formData.openingBalanceType}
                                        onChange={e => setFormData({ ...formData, openingBalanceType: e.target.value as any })}
                                    >
                                        <option value="DR">DR</option>
                                        <option value="CR">CR</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="pt-8 flex gap-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-4 bg-transparent border border-slate-800 text-slate-400 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800/30 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-2 px-10 py-4 bg-indigo-600 text-white text-xs font-black uppercase tracking-[0.15em] rounded-2xl shadow-xl shadow-indigo-500/20 hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isSubmitting ? 'PROCESSING...' : (isEdit ? 'SAVE CHANGES' : 'CREATE ACCOUNT')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    const handleSetupDefault = async () => {
        if (!confirm('This will create a standard Chart of Accounts structure. Continue?')) return;
        setIsLoading(true);
        try {
            const res = await authenticatedFetch('/api/finance/coa/setup', { method: 'POST' });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Setup failed');
            fetchAccounts();
        } catch (err: any) {
            alert(err.message);
            setIsLoading(false);
        }
    };

    const [searchTerm, setSearchTerm] = useState('');

    const filterAccounts = (items: Account[]): Account[] => {
        if (!searchTerm) return items;

        return items.map(item => {
            const matches =
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.type.toLowerCase().includes(searchTerm.toLowerCase());

            const filteredChildren = item.children ? filterAccounts(item.children) : [];
            const hasMatchingChildren = filteredChildren.length > 0;

            if (matches || hasMatchingChildren) {
                return { ...item, children: filteredChildren };
            }
            return null;
        }).filter((item): item is Account => item !== null);
    };

    const filteredAccounts = filterAccounts(accounts);

    return (
        <MainLayout>
            <div className="min-h-screen bg-[#020617] text-slate-300 p-8 space-y-10 animate-in fade-in duration-1000">
                <div className="flex items-end justify-between border-b border-slate-800 pb-10">
                    <div>
                        <h1 className="text-5xl font-black text-white tracking-tighter">Accounts</h1>
                        <p className="text-slate-500 mt-3 font-medium text-lg">Centralize your organization's financial hierarchy.</p>
                    </div>

                    <div className="flex flex-col items-end gap-6">
                        <div className="flex items-center gap-4">
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-500 transition-colors">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search by name, code or type..."
                                    className="w-80 pl-12 pr-6 py-3.5 bg-[#0f172a] border border-slate-800 rounded-2xl text-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-600 transition-all shadow-xl"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="flex bg-[#0f172a] p-1.5 rounded-2xl border border-slate-800 shadow-xl">
                                <button
                                    onClick={expandAll}
                                    className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                                >
                                    Expand
                                </button>
                                <button
                                    onClick={collapseAll}
                                    className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                                >
                                    Collapse
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {accounts.length === 0 && !isLoading && (
                                <button
                                    onClick={handleSetupDefault}
                                    className="px-8 py-3.5 bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 font-bold rounded-2xl hover:bg-emerald-600/20 transition-all flex items-center gap-2 group"
                                >
                                    <span className="group-hover:scale-125 transition-transform">⚡</span>
                                    <span>Setup Hierarchy</span>
                                </button>
                            )}

                            <button
                                onClick={() => openCreateModal()}
                                className="px-8 py-3.5 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-2xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all ring-1 ring-white/10"
                            >
                                + New Account
                            </button>
                        </div>
                    </div>
                </div>

                <div className="relative">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-40 gap-6">
                            <div className="w-16 h-16 border-[6px] border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin shadow-2xl" />
                            <p className="text-xs font-black text-slate-600 animate-pulse uppercase tracking-[0.4em]">Optimizing Structure</p>
                        </div>
                    ) : accounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-48 text-center bg-[#0f172a]/30 border-2 border-dashed border-slate-800/50 rounded-[3rem]">
                            <div className="w-24 h-24 bg-indigo-500/5 rounded-full flex items-center justify-center text-5xl mb-8 border border-indigo-500/10 shadow-2xl">🏛️</div>
                            <h3 className="text-3xl font-bold text-white tracking-tight">Financial Void Detected</h3>
                            <p className="text-slate-500 mt-4 max-w-md mx-auto text-lg leading-relaxed">Establish your standard ERP hierarchy or architect a custom chart of accounts.</p>

                            <div className="flex gap-6 mt-12">
                                <button
                                    onClick={handleSetupDefault}
                                    className="px-10 py-5 bg-indigo-600 text-white font-black rounded-[1.5rem] shadow-3xl shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all flex flex-col items-center gap-1 group"
                                >
                                    <span className="text-lg">Deploy Reference Structure</span>
                                    <span className="text-[10px] opacity-70 font-bold uppercase tracking-[0.2em] group-hover:tracking-[0.3em] transition-all">Industry Standard</span>
                                </button>
                                <button
                                    onClick={() => openCreateModal()}
                                    className="px-10 py-5 bg-transparent border border-slate-700 text-white font-black rounded-[1.5rem] hover:bg-slate-800 transition-all flex flex-col items-center gap-1"
                                >
                                    <span className="text-lg">Architect Manually</span>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Build from Root</span>
                                </button>
                            </div>
                        </div>
                    ) : filteredAccounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 text-center">
                            <div className="text-4xl mb-4 opacity-50">🔍</div>
                            <h3 className="text-xl font-bold text-white">No accounts match your search</h3>
                            <p className="text-slate-500 mt-2">Try adjusting your filters or search term.</p>
                            <button
                                onClick={() => setSearchTerm('')}
                                className="mt-6 text-indigo-400 font-bold text-sm hover:underline"
                            >
                                Clear Search
                            </button>
                        </div>
                    ) : (
                        <div className="pb-24">
                            {filteredAccounts.map(acc => (
                                <AccountNode key={acc.id} acc={acc} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="New Account" />
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Account" isEdit />
        </MainLayout>
    );
}
