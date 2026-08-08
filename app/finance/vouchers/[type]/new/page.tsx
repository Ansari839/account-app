"use client";

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';
import { useParams, useRouter } from 'next/navigation';
import Combobox from '@/components/Combobox';
import { 
    Calendar, FileText, AlignLeft, 
    Trash2, Plus, ArrowLeft, 
    CheckCircle2, AlertTriangle, Save, RefreshCw
} from 'lucide-react';

interface JournalLine {
    accountId: string;
    debit: string | number;
    credit: string | number;
    narration: string;
}

export default function VoucherCreatePage() {
    const { type } = useParams();
    const router = useRouter();
    const { showNotification } = useNotifications();

    // State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState('');
    const [narration, setNarration] = useState('');
    const [lines, setLines] = useState<JournalLine[]>([
        { accountId: '', debit: '', credit: '', narration: '' },
        { accountId: '', debit: '', credit: '', narration: '' }
    ]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingCell, setEditingCell] = useState<string | null>(null);
    const [headerAccountId, setHeaderAccountId] = useState('');

    // Contra Specific State
    const [contraFrom, setContraFrom] = useState('');
    const [contraTo, setContraTo] = useState('');
    const [contraAmount, setContraAmount] = useState('');

    // Draft State
    const [draftData, setDraftData] = useState<any>(null);

    // Load Accounts
    useEffect(() => {
        authenticatedFetch('/api/accounts?isPosting=true')
            .then(res => res.json())
            .then(json => {
                if (json.accounts) {
                    setAccounts(json.accounts);
                }
            });
    }, []);

    // Load Draft from Local Storage on Mount
    useEffect(() => {
        const saved = localStorage.getItem(`draft_voucher_${type}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setDraftData(parsed);
            } catch (e) {
                console.error("Failed to parse draft", e);
            }
        }
    }, [type]);

    // Auto-Save Draft to Local Storage
    useEffect(() => {
        // Skip saving if a draft is awaiting user decision
        if (draftData) return;

        // Only save if there is actual data
        const hasData = lines.some(l => l.accountId || l.debit || l.credit || l.narration) || reference || narration || (type === 'contra' ? (contraFrom || contraTo || contraAmount) : headerAccountId);
        
        if (hasData) {
            const stateToSave = { date, reference, narration, headerAccountId, lines, contraFrom, contraTo, contraAmount };
            localStorage.setItem(`draft_voucher_${type}`, JSON.stringify(stateToSave));
        }
    }, [date, reference, narration, headerAccountId, lines, contraFrom, contraTo, contraAmount, type, draftData]);

    const restoreDraft = () => {
        if (draftData) {
            if (draftData.date) setDate(draftData.date);
            if (draftData.reference) setReference(draftData.reference);
            if (draftData.narration) setNarration(draftData.narration);
            if (draftData.headerAccountId) setHeaderAccountId(draftData.headerAccountId);
            if (draftData.lines && draftData.lines.length > 0) setLines(draftData.lines);
            if (draftData.contraFrom) setContraFrom(draftData.contraFrom);
            if (draftData.contraTo) setContraTo(draftData.contraTo);
            if (draftData.contraAmount) setContraAmount(draftData.contraAmount);
            setDraftData(null);
        }
    };

    const discardDraft = () => {
        setDraftData(null);
        localStorage.removeItem(`draft_voucher_${type}`);
    };

    // Helper: Totals
    const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    const isGridBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
    const isBalanced = (type === 'payment' || type === 'receipt') ? true : (type === 'contra' ? (contraFrom && contraTo && Number(contraAmount) > 0) : isGridBalanced);

    // Handlers
    const addLine = () => {
        const newIndex = lines.length;
        setLines([...lines, { accountId: '', debit: '', credit: '', narration: '' }]);
        setTimeout(() => {
            const el = document.getElementById(`combobox-line-${newIndex}`);
            if (el) el.focus();
        }, 50);
    };

    const handleGridKeyDown = (e: React.KeyboardEvent, rowIndex: number, field: string) => {
        const fields = (type === 'journal' || type === 'contra') 
            ? ['combobox', 'narration', 'debit', 'credit']
            : ['combobox', 'narration', 'amount'];
        const colIndex = fields.indexOf(field);
        const cellId = `${field}-${rowIndex}`;
        const isEditing = editingCell === cellId;
        
        if (e.key === 'F2') {
            e.preventDefault();
            setEditingCell(cellId);
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (isEditing) {
                setEditingCell(null);
                if (rowIndex < lines.length - 1) document.getElementById(`${field}-line-${rowIndex + 1}`)?.focus();
            } else {
                setEditingCell(cellId);
            }
            return;
        }

        if (e.key === 'Escape') {
            setEditingCell(null);
            return;
        }
        
        if (!isEditing) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (rowIndex > 0) document.getElementById(`${field}-line-${rowIndex - 1}`)?.focus();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (rowIndex < lines.length - 1) document.getElementById(`${field}-line-${rowIndex + 1}`)?.focus();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (colIndex > 0) document.getElementById(`${fields[colIndex - 1]}-line-${rowIndex}`)?.focus();
                else if (rowIndex > 0) document.getElementById(`${fields[fields.length - 1]}-line-${rowIndex - 1}`)?.focus();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (colIndex < fields.length - 1) document.getElementById(`${fields[colIndex + 1]}-line-${rowIndex}`)?.focus();
                else if (rowIndex < lines.length - 1) document.getElementById(`${fields[0]}-line-${rowIndex + 1}`)?.focus();
            } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && field !== 'combobox') {
                setEditingCell(cellId);
                // If it's a number, and they start typing, we clear the previous value for Excel feel
                if (field === 'debit' || field === 'credit' || field === 'amount') {
                    if (/^[0-9.]$/.test(e.key)) {
                        const amountField = field === 'amount' ? (type === 'payment' ? 'debit' : 'credit') : field;
                        updateLine(rowIndex, { [amountField]: '' });
                    }
                } else if (field === 'narration') {
                    updateLine(rowIndex, { narration: '' });
                }
            }
        } else {
            // In edit mode
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setEditingCell(null);
                if (rowIndex > 0) document.getElementById(`${field}-line-${rowIndex - 1}`)?.focus();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setEditingCell(null);
                if (rowIndex < lines.length - 1) document.getElementById(`${field}-line-${rowIndex + 1}`)?.focus();
            }
        }
    };

    const removeLine = (index: number) => {
        if (lines.length <= 2) {
            showNotification('error', 'Journal must have at least 2 lines');
            return;
        }
        setLines(lines.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, updates: Partial<JournalLine>) => {
        setLines(prevLines => {
            const newLines = [...prevLines];
            newLines[index] = { ...newLines[index], ...updates };
            return newLines;
        });
    };

    const handleSubmit = async () => {
        // Validate Amounts
        const hasInvalidAmounts = lines.some(l => {
            const d = Number(l.debit) || 0;
            const c = Number(l.credit) || 0;
            return (d === 0 && c === 0) || (d < 0 || c < 0);
        });

        if (hasInvalidAmounts) {
            showNotification('error', 'All lines must have a valid non-zero amount');
            return;
        }

        if (lines.some(l => !l.accountId)) {
            showNotification('error', 'All lines must have an account selected');
            return;
        }

        if ((type === 'payment' || type === 'receipt') && !headerAccountId) {
            showNotification('error', `Please select a ${type === 'payment' ? 'Payment' : 'Receipt'} Account in the header`);
            return;
        }
        
        if (type === 'contra' && (!contraFrom || !contraTo || Number(contraAmount) <= 0)) {
            showNotification('error', 'Please fill all Contra transfer details correctly');
            return;
        }

        if (type !== 'contra' && !isBalanced) {
            showNotification('error', 'Voucher is not balanced');
            return;
        }

        setIsSubmitting(true);
        try {
            let submitLines = lines.map(l => ({
                accountId: l.accountId,
                debit: Number(l.debit) || 0,
                credit: Number(l.credit) || 0,
                narration: l.narration
            }));

            if (type === 'payment') {
                submitLines.push({
                    accountId: headerAccountId,
                    debit: 0,
                    credit: totalDebit,
                    narration: 'Total Payment'
                });
            } else if (type === 'receipt') {
                submitLines.push({
                    accountId: headerAccountId,
                    debit: totalCredit,
                    credit: 0,
                    narration: 'Total Receipt'
                });
            } else if (type === 'contra') {
                submitLines = [
                    { accountId: contraFrom, credit: Number(contraAmount), debit: 0, narration: narration || 'Contra Transfer' },
                    { accountId: contraTo, debit: Number(contraAmount), credit: 0, narration: narration || 'Contra Transfer' }
                ];
            }

            const body = {
                type: (type as string || 'JOURNAL').toUpperCase(),
                date: new Date(date),
                reference,
                narration,
                lines: submitLines
            };

            const res = await authenticatedFetch('/api/finance/vouchers/journal', {
                method: 'POST',
                body: JSON.stringify(body)
            });

            const json = await res.json();
            if (json.success) {
                showNotification('success', 'Voucher saved successfully!');
                localStorage.removeItem(`draft_voucher_${type}`);
                router.push(`/finance/vouchers/${type || 'journal'}`);
            } else {
                showNotification('error', json.error || 'Failed to create voucher');
            }
        } catch (error) {
            showNotification('error', 'Network error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const accountOptions = accounts.map(acc => ({
        value: acc.id,
        label: `${acc.code} - ${acc.name}`
    }));

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between bg-slate-900 dark:bg-slate-950 p-8 rounded-3xl shadow-xl shadow-slate-900/20 mb-2">
                    <div className="flex items-center gap-6">
                        <button 
                            onClick={() => router.back()} 
                            className="p-3.5 bg-white/10 border border-white/20 text-white rounded-2xl hover:bg-white/20 hover:scale-105 active:scale-95 transition-all shadow-sm"
                        >
                            <ArrowLeft size={22} />
                        </button>
                        <div>
                            <h1 className="text-4xl font-black tracking-tight text-white">
                                New {type ? type.toString().charAt(0).toUpperCase() + type.toString().slice(1).toLowerCase() : ''} Voucher
                            </h1>
                            <p className="text-slate-300 mt-2 text-xs uppercase font-bold tracking-widest">
                                Create a new financial transaction
                            </p>
                        </div>
                    </div>
                </div>

                {draftData && (
                    <div className="bg-amber-500/10 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 backdrop-blur-md">
                        <div className="flex items-center gap-4 text-amber-800 dark:text-amber-400">
                            <div className="p-3 bg-amber-500/20 rounded-2xl">
                                <RefreshCw size={22} className="animate-spin-slow" />
                            </div>
                            <div>
                                <p className="font-black text-lg tracking-tight">Unsaved Draft Found!</p>
                                <p className="text-sm font-medium opacity-80 mt-0.5">Would you like to restore the data you were previously working on?</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={discardDraft} 
                                className="px-5 py-3 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900"
                            >
                                Discard
                            </button>
                            <button 
                                onClick={restoreDraft} 
                                className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900"
                            >
                                Restore Data
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-sm space-y-8 backdrop-blur-md">
                    {/* Header Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-3">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Calendar size={16} /> Date
                            </label>
                            <input 
                                type="date" 
                                value={date} 
                                onChange={e => setDate(e.target.value)} 
                                className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900 text-slate-900 dark:text-white transition-all shadow-sm" 
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <FileText size={16} /> Reference
                            </label>
                            <input 
                                type="text" 
                                placeholder="e.g. INV-001" 
                                value={reference} 
                                onChange={e => setReference(e.target.value)} 
                                className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900 text-slate-900 dark:text-white transition-all shadow-sm placeholder:text-slate-400" 
                            />
                        </div>
                        <div className="md:col-span-3 space-y-3">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <AlignLeft size={16} /> Narration
                            </label>
                            <textarea 
                                placeholder="Description of the transaction..." 
                                value={narration} 
                                onChange={e => setNarration(e.target.value)} 
                                className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900 text-slate-900 dark:text-white transition-all h-24 resize-none shadow-sm placeholder:text-slate-400" 
                            />
                        </div>
                        {(type === 'payment' || type === 'receipt') && (
                            <div className="md:col-span-3 space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <FileText size={16} /> {type === 'payment' ? 'Pay From (Cash/Bank)' : 'Receive Into (Cash/Bank)'}
                                </label>
                                <Combobox
                                    options={accountOptions}
                                    value={headerAccountId}
                                    onChange={setHeaderAccountId}
                                    placeholder={`Select ${type === 'payment' ? 'Payment' : 'Receipt'} Account...`}
                                    className="w-full"
                                />
                            </div>
                        )}
                    </div>

                    {type === 'contra' ? (
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm bg-white dark:bg-slate-900/50 space-y-6">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">Transfer Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <FileText size={16} /> Transfer From
                                    </label>
                                    <Combobox
                                        options={accountOptions}
                                        value={contraFrom}
                                        onChange={setContraFrom}
                                        placeholder="Select Source Account..."
                                        className="w-full"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <FileText size={16} /> Transfer To
                                    </label>
                                    <Combobox
                                        options={accountOptions}
                                        value={contraTo}
                                        onChange={setContraTo}
                                        placeholder="Select Destination Account..."
                                        className="w-full"
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <FileText size={16} /> Amount
                                    </label>
                                    <input 
                                        type="number" 
                                        placeholder="0.00" 
                                        value={contraAmount} 
                                        onChange={e => setContraAmount(e.target.value)} 
                                        className="w-full p-4 text-2xl font-mono rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900 text-slate-900 dark:text-white transition-all shadow-sm" 
                                        step="any"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Lines Table */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900/50">
                                <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-600 dark:text-slate-300 uppercase font-black tracking-widest bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-5 py-4 w-[35%]">Account</th>
                                    <th className="px-5 py-4 w-[30%]">Narration</th>
                                    {type === 'journal' || type === 'contra' ? (
                                        <>
                                            <th className="px-5 py-4 w-[15%] text-right">Debit</th>
                                            <th className="px-5 py-4 w-[15%] text-right">Credit</th>
                                        </>
                                    ) : (
                                        <th className="px-5 py-4 w-[20%] text-right">Amount</th>
                                    )}
                                    <th className="px-5 py-4 w-12 text-center">Act</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {lines.map((line, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="p-3 align-top">
                                            <Combobox
                                                id={`combobox-line-${idx}`}
                                                options={accountOptions}
                                                value={line.accountId}
                                                onChange={(val) => updateLine(idx, { accountId: val })}
                                                onKeyDown={(e) => handleGridKeyDown(e, idx, 'combobox')}
                                                placeholder="Select Account..."
                                                className="w-full"
                                            />
                                        </td>
                                        <td className="p-3 align-top">
                                            <input
                                                id={`narration-line-${idx}`}
                                                type="text"
                                                readOnly={editingCell !== `narration-${idx}`}
                                                placeholder="Line Note"
                                                className={`w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/50 outline-none transition-all shadow-sm placeholder:text-slate-400 text-slate-900 dark:text-white ${editingCell === `narration-${idx}` ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 cursor-text' : 'focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 focus:border-indigo-400 cursor-default select-none'}`}
                                                value={line.narration}
                                                onChange={e => updateLine(idx, { narration: e.target.value })}
                                                onKeyDown={(e) => handleGridKeyDown(e, idx, 'narration')}
                                                onDoubleClick={() => setEditingCell(`narration-${idx}`)}
                                                onBlur={() => setEditingCell(null)}
                                            />
                                        </td>
                                        {type === 'journal' || type === 'contra' ? (
                                            <>
                                                <td className="p-3 align-top">
                                                    <input
                                                        id={`debit-line-${idx}`}
                                                        type="number"
                                                        readOnly={editingCell !== `debit-${idx}`}
                                                        placeholder="0.00"
                                                        className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none w-full text-right p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/50 outline-none transition-all shadow-sm placeholder:text-slate-400 font-mono text-slate-900 dark:text-white ${editingCell === `debit-${idx}` ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 cursor-text' : 'focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 focus:border-indigo-400 cursor-default select-none'}`}
                                                        value={line.debit}
                                                        onChange={e => updateLine(idx, { debit: e.target.value, credit: '' })}
                                                        onKeyDown={(e) => handleGridKeyDown(e, idx, 'debit')}
                                                        onDoubleClick={() => setEditingCell(`debit-${idx}`)}
                                                        onBlur={() => setEditingCell(null)}
                                                        step="any"
                                                    />
                                                </td>
                                                <td className="p-3 align-top">
                                                    <input
                                                        id={`credit-line-${idx}`}
                                                        type="number"
                                                        readOnly={editingCell !== `credit-${idx}`}
                                                        placeholder="0.00"
                                                        className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none w-full text-right p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/50 outline-none transition-all shadow-sm placeholder:text-slate-400 font-mono text-slate-900 dark:text-white ${editingCell === `credit-${idx}` ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 cursor-text' : 'focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 focus:border-indigo-400 cursor-default select-none'}`}
                                                        value={line.credit}
                                                        onChange={e => updateLine(idx, { credit: e.target.value, debit: '' })}
                                                        onKeyDown={(e) => handleGridKeyDown(e, idx, 'credit')}
                                                        onDoubleClick={() => setEditingCell(`credit-${idx}`)}
                                                        onBlur={() => setEditingCell(null)}
                                                        step="any"
                                                    />
                                                </td>
                                            </>
                                        ) : (
                                            <td className="p-3 align-top">
                                                <input
                                                    id={`amount-line-${idx}`}
                                                    type="number"
                                                    readOnly={editingCell !== `amount-${idx}`}
                                                    placeholder="0.00"
                                                    className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none w-full text-right p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/50 outline-none transition-all shadow-sm placeholder:text-slate-400 font-mono text-slate-900 dark:text-white ${editingCell === `amount-${idx}` ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 cursor-text' : 'focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 focus:border-indigo-400 cursor-default select-none'}`}
                                                    value={type === 'payment' ? line.debit : line.credit}
                                                    onChange={e => updateLine(idx, type === 'payment' ? { debit: e.target.value, credit: '' } : { credit: e.target.value, debit: '' })}
                                                    onKeyDown={(e) => handleGridKeyDown(e, idx, 'amount')}
                                                    onDoubleClick={() => setEditingCell(`amount-${idx}`)}
                                                    onBlur={() => setEditingCell(null)}
                                                    step="any"
                                                />
                                            </td>
                                        )}
                                        <td className="p-3 align-middle text-center">
                                            <button
                                                onClick={() => removeLine(idx)}
                                                className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900"
                                                title="Remove Line"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-center px-2">
                        <button 
                            onClick={addLine} 
                            className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900"
                        >
                            <Plus size={16} strokeWidth={3} />
                            Add Another Line
                        </button>

                        {/* Totals Display */}
                        <div className="flex gap-10 text-right bg-slate-50 dark:bg-slate-950/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            {type === 'journal' || type === 'contra' ? (
                                <>
                                    <div>
                                        <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-black tracking-widest mb-1.5">Total Debit</div>
                                        <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
                                            {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                    <div className="w-px bg-slate-200 dark:bg-slate-800 h-10 self-center"></div>
                                    <div>
                                        <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-black tracking-widest mb-1.5">Total Credit</div>
                                        <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
                                            {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-black tracking-widest mb-1.5">Total Amount</div>
                                    <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
                                        {(type === 'payment' ? totalDebit : totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    </>
                )}

                    {/* Footer Actions */}
                    <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div className={`font-bold flex items-center gap-3 px-5 py-3 rounded-2xl transition-colors ${
                            isBalanced 
                                ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shadow-sm' 
                                : 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 shadow-sm'
                        }`}>
                            {type === 'journal' || type === 'contra' ? (
                                isBalanced ? (
                                    <><CheckCircle2 size={20} strokeWidth={2.5} /> Balanced</>
                                ) : (
                                    <><AlertTriangle size={20} strokeWidth={2.5} /> Unbalanced (Diff: {Math.abs(totalDebit - totalCredit).toFixed(2)})</>
                                )
                            ) : (
                                <><CheckCircle2 size={20} strokeWidth={2.5} /> Ready to Post</>
                            )}
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !isBalanced}
                            className="px-8 py-3.5 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                        >
                            <Save size={18} strokeWidth={2.5} />
                            {isSubmitting ? 'Posting Voucher...' : 'Post Voucher'}
                        </button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
