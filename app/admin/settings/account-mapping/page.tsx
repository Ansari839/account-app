'use client';

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { Link2, Save, CheckCircle2, AlertCircle, RefreshCw, BookOpen } from 'lucide-react';

interface AccountOption {
    id: string;
    code: string;
    name: string;
    type: string;
}

interface MappingEntry {
    accountId: string;
    account: AccountOption;
}

type Mappings = Record<string, MappingEntry>;

const MAPPING_KEYS: { key: string; label: string; description: string; color: string }[] = [
    { key: 'sales',            label: 'Sales Revenue',        description: 'Credit account when a Sales Invoice is posted',           color: 'emerald' },
    { key: 'sales_returns',    label: 'Sales Returns',        description: 'Debit account when a Sale Return (Credit Note) is posted', color: 'amber' },
    { key: 'purchases',        label: 'Purchases (COGS)',     description: 'Debit account when a Purchase Invoice is posted',          color: 'blue' },
    { key: 'purchase_returns', label: 'Purchase Returns',     description: 'Credit account when a Purchase Return is posted',          color: 'orange' },
    { key: 'purchase_discount', label: 'Purchase Discount',   description: 'Credit account when discount is received',                 color: 'violet' },
    { key: 'inventory',           label: 'Inventory / Stock',  description: 'Stock account for perpetual inventory (COGS auto-entry)', color: 'teal' },
    { key: 'cash',                label: 'Default Cash Account', description: 'Default cash account for payments & receipts',         color: 'slate' },
];

const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    amber:   'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    blue:    'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    orange:  'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    violet:  'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    rose:    'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    cyan:    'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    purple:  'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    teal:    'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    slate:   'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
};

export default function AccountMappingPage() {
    const [accounts, setAccounts] = useState<AccountOption[]>([]);
    const [mappings, setMappings] = useState<Mappings>({});
    const [selected, setSelected] = useState<Record<string, string>>({}); // key → accountId
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [saved, setSaved] = useState<Record<string, boolean>>({});
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [loadingMappings, setLoadingMappings] = useState(true);

    useEffect(() => {
        fetchAccounts();
        fetchMappings();
    }, []);

    const fetchAccounts = async () => {
        try {
            const token = localStorage.getItem('token');
            const companyId = localStorage.getItem('activeCompanyId') || '';
            const res = await fetch('/api/accounts', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-company-id': companyId
                }
            });
            if (res.ok) {
                const data = await res.json();
                setAccounts((data.accounts || []).filter((a: AccountOption & { isPosting: boolean }) => a.isPosting));
            }
        } finally {
            setLoadingAccounts(false);
        }
    };

    const fetchMappings = async () => {
        try {
            const token = localStorage.getItem('token');
            const companyId = localStorage.getItem('activeCompanyId') || '';
            const res = await fetch('/api/finance/coa/mapping', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-company-id': companyId
                }
            });
            if (res.ok) {
                const data = await res.json();
                setMappings(data.data || {});
                // Set initial selections from saved mappings
                const initial: Record<string, string> = {};
                Object.entries(data.data || {}).forEach(([k, v]: [string, any]) => {
                    initial[k] = v.accountId;
                });
                setSelected(initial);
            }
        } finally {
            setLoadingMappings(false);
        }
    };

    const handleSave = async (key: string) => {
        const accountId = selected[key];
        if (!accountId) return;
        setSaving(prev => ({ ...prev, [key]: true }));
        try {
            const token = localStorage.getItem('token');
            const companyId = localStorage.getItem('activeCompanyId') || '';
            const res = await fetch('/api/finance/coa/mapping', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'x-company-id': companyId
                },
                body: JSON.stringify({ key, accountId })
            });
            if (res.ok) {
                const data = await res.json();
                setMappings(prev => ({ ...prev, [key]: data.data }));
                setSaved(prev => ({ ...prev, [key]: true }));
                setTimeout(() => setSaved(prev => ({ ...prev, [key]: false })), 2500);
            }
        } finally {
            setSaving(prev => ({ ...prev, [key]: false }));
        }
    };

    const groupedAccounts = {
        ASSET: accounts.filter(a => a.type === 'ASSET'),
        LIABILITY: accounts.filter(a => a.type === 'LIABILITY'),
        EQUITY: accounts.filter(a => a.type === 'EQUITY'),
        INCOME: accounts.filter(a => a.type === 'INCOME'),
        EXPENSE: accounts.filter(a => a.type === 'EXPENSE'),
    };

    const isLoading = loadingAccounts || loadingMappings;
    const needsSeed = !isLoading && accounts.length === 0;

    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                        Account Mapping
                    </h1>
                    <p className="text-slate-500 mt-1 uppercase text-[10px] font-bold tracking-widest">
                        System Accounts — Finance Module Integration
                    </p>
                </div>

                {/* Info Banner */}
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-5 flex items-start gap-4">
                    <Link2 size={20} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                            System Accounts kya hain?
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Jab Sales Invoice, Purchase Invoice, ya Return create hota hai — system automatically double-entry journal banta hai.
                            Yahan aap define karte hain ke kaun sa account Debit/Credit ho. COA seed karne ke baad defaults automatically set ho jaate hain.
                        </p>
                    </div>
                </div>

                {needsSeed && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-center gap-4">
                        <AlertCircle size={20} className="text-amber-500 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">COA accounts nahi milay</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Pehle Chart of Accounts mein <strong>Auto Seed COA</strong> button click karein, phir yahan wapis aayein.
                            </p>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-3">
                        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Loading Mappings...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {MAPPING_KEYS.map(({ key, label, description, color }) => {
                            const currentMapping = mappings[key];
                            const isSaving = saving[key];
                            const isSaved = saved[key];
                            const selectedId = selected[key] || '';

                            return (
                                <div key={key} className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-start gap-3 mb-4">
                                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
                                            <BookOpen size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-black text-slate-900 dark:text-white text-sm">{label}</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{description}</p>
                                        </div>
                                    </div>

                                    {currentMapping && (
                                        <div className="mb-3 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current:</span>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                ({currentMapping.account.code}) {currentMapping.account.name}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <select
                                            className="flex-1 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                            value={selectedId}
                                            onChange={e => setSelected(prev => ({ ...prev, [key]: e.target.value }))}
                                        >
                                            <option value="">— Select Account —</option>
                                            {Object.entries(groupedAccounts).map(([type, accs]) => (
                                                accs.length > 0 && (
                                                    <optgroup key={type} label={type}>
                                                        {accs.map(a => (
                                                            <option key={a.id} value={a.id}>({a.code}) {a.name}</option>
                                                        ))}
                                                    </optgroup>
                                                )
                                            ))}
                                        </select>

                                        <button
                                            onClick={() => handleSave(key)}
                                            disabled={isSaving || !selectedId || selectedId === currentMapping?.accountId}
                                            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                                                isSaved
                                                    ? 'bg-emerald-500 text-white'
                                                    : 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed'
                                            }`}
                                        >
                                            {isSaving ? (
                                                <RefreshCw size={14} className="animate-spin" />
                                            ) : isSaved ? (
                                                <><CheckCircle2 size={14} /> Saved</>
                                            ) : (
                                                <><Save size={14} /> Save</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
