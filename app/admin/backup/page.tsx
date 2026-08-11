"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';
import {
    Download, Upload, Clock, Play, Trash2, ToggleLeft, ToggleRight,
    AlertTriangle, CheckCircle2, XCircle, Loader2, Plus, RefreshCw,
    HardDrive, DatabaseBackup, History, Settings2
} from 'lucide-react';

interface Company { id: string; name: string; }

interface Schedule {
    id: string;
    frequency: string;
    cronTime: string;
    storagePath: string;
    masterOnly: boolean;
    isActive: boolean;
    retainDaily: number;
    retainWeekly: number;
    retainMonthly: number;
    retainQuarterly: number;
    _count?: { logs: number };
}

interface BackupLog {
    id: string;
    companyName: string | null;
    backupType: string;
    status: string;
    fileName: string | null;
    fileSizeBytes: string | null;
    triggeredBy: string;
    createdAt: string;
}

interface Approval {
    id: string;
    fromType: string;
    toType: string;
    fileCount: number;
    totalSizeBytes: string | null;
    requestedAt: string;
    companyId: string | null;
    schedule: { company: { name: string } | null };
}

const FREQ_OPTIONS = [
    { value: 'DAILY', label: 'Daily', cron: '0 2 * * *', desc: 'Every day at 2 AM' },
    { value: 'WEEKLY', label: 'Weekly', cron: '0 2 * * 0', desc: 'Every Sunday at 2 AM' },
    { value: 'MONTHLY', label: 'Monthly', cron: '0 2 1 * *', desc: '1st of month at 2 AM' },
];

type Tab = 'export' | 'schedule' | 'history' | 'approvals';

function formatBytes(bytes: string | null) {
    if (!bytes) return '—';
    const n = parseInt(bytes);
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1048576).toFixed(2)} MB`;
}

function statusBadge(status: string) {
    if (status === 'SUCCESS') return <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-semibold flex items-center gap-1"><CheckCircle2 size={11} /> Success</span>;
    if (status === 'FAILED') return <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-xs rounded-full font-semibold flex items-center gap-1"><XCircle size={11} /> Failed</span>;
    return <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full font-semibold flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Running</span>;
}

export default function AdminBackupPage() {
    const { showNotification } = useNotifications();
    const [tab, setTab] = useState<Tab>('export');

    // Export/Restore state
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompany, setSelectedCompany] = useState('');
    const [targetCompany, setTargetCompany] = useState('');
    const [loading, setLoading] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [backupFile, setBackupFile] = useState<File | null>(null);
    const [masterOnly, setMasterOnly] = useState(false);

    // Schedule state
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [logs, setLogs] = useState<BackupLog[]>([]);
    const [approvals, setApprovals] = useState<Approval[]>([]);
    const [schedLoading, setSchedLoading] = useState(false);
    const [showSchedForm, setShowSchedForm] = useState(false);
    const [schedSaving, setSchedSaving] = useState(false);
    const [editSched, setEditSched] = useState<Schedule | null>(null);
    const [runningId, setRunningId] = useState<string | null>(null);

    const [form, setForm] = useState({
        frequency: 'DAILY',
        cronTime: '0 2 * * *',
        storagePath: './backups',
        masterOnly: false,
        retainDaily: 7,
        retainWeekly: 4,
        retainMonthly: 3,
        retainQuarterly: 4,
    });

    useEffect(() => { fetchCompanies(); fetchScheduleData(); }, []);

    const fetchCompanies = async () => {
        const res = await authenticatedFetch('/api/admin/companies');
        const json = await res.json();
        if (json.success) setCompanies(json.data);
    };

    const fetchScheduleData = async () => {
        setSchedLoading(true);
        try {
            const [sRes, lRes, aRes] = await Promise.all([
                authenticatedFetch('/api/admin/backup/schedule'),
                authenticatedFetch('/api/admin/backup/logs'),
                authenticatedFetch('/api/admin/backup/approvals'),
            ]);
            const sJson = await sRes.json();
            const lJson = await lRes.json();
            const aJson = await aRes.json();
            if (sJson.success) setSchedules(sJson.data);
            if (lJson.success) setLogs(lJson.data);
            if (aJson.success) setApprovals(aJson.data);
        } finally {
            setSchedLoading(false);
        }
    };

    // ── Export ──────────────────────────────────────────────────
    const handleExport = async () => {
        if (!selectedCompany) return;
        setLoading(true);
        try {
            const res = await authenticatedFetch(`/api/admin/backup/export?companyId=${selectedCompany}&masterOnly=${masterOnly}`);
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const name = companies.find(c => c.id === selectedCompany)?.name ?? 'company';
                a.download = `backup-${name}-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a); a.click(); a.remove();
                showNotification('success', 'Backup downloaded!');
            } else showNotification('error', 'Export failed');
        } catch { showNotification('error', 'Export error'); }
        finally { setLoading(false); }
    };

    const handleRestore = async () => {
        if (!targetCompany || !backupFile) return;
        if (!window.confirm('WARNING: All existing data in the target company will be deleted. Proceed?')) return;
        setRestoring(true);
        try {
            const text = await backupFile.text();
            const backupData = JSON.parse(text);
            const res = await authenticatedFetch('/api/admin/backup/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetCompanyId: targetCompany, backupData }),
            });
            const json = await res.json();
            if (json.success) { showNotification('success', 'Company restored!'); setBackupFile(null); }
            else showNotification('error', json.error || 'Restore failed');
        } catch { showNotification('error', 'Invalid file or server error'); }
        finally { setRestoring(false); }
    };

    // ── Schedule ─────────────────────────────────────────────────
    const handleFreqChange = (freq: string) => {
        const opt = FREQ_OPTIONS.find(f => f.value === freq);
        setForm(f => ({ ...f, frequency: freq, cronTime: opt?.cron ?? f.cronTime }));
    };

    const openEditForm = (s: Schedule) => {
        setEditSched(s);
        setForm({ frequency: s.frequency, cronTime: s.cronTime, storagePath: s.storagePath, masterOnly: s.masterOnly, retainDaily: s.retainDaily, retainWeekly: s.retainWeekly, retainMonthly: s.retainMonthly, retainQuarterly: s.retainQuarterly });
        setShowSchedForm(true);
    };

    const handleSaveSchedule = async () => {
        setSchedSaving(true);
        try {
            const method = editSched ? 'PUT' : 'POST';
            const url = editSched ? `/api/admin/backup/schedule/${editSched.id}` : '/api/admin/backup/schedule';
            const res = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const json = await res.json();
            if (json.success) {
                showNotification('success', `Schedule ${editSched ? 'updated' : 'created'}!`);
                setShowSchedForm(false); setEditSched(null);
                fetchScheduleData();
            } else showNotification('error', json.error || 'Save failed');
        } finally { setSchedSaving(false); }
    };

    const handleDeleteSchedule = async (id: string) => {
        if (!window.confirm('Delete this schedule?')) return;
        await authenticatedFetch(`/api/admin/backup/schedule/${id}`, { method: 'DELETE' });
        fetchScheduleData();
        showNotification('success', 'Schedule deleted');
    };

    const handleToggleSchedule = async (s: Schedule) => {
        await authenticatedFetch(`/api/admin/backup/schedule/${s.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...s, isActive: !s.isActive }),
        });
        fetchScheduleData();
    };

    const handleRunNow = async (s: Schedule) => {
        setRunningId(s.id);
        try {
            const res = await authenticatedFetch('/api/company/backup/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduleId: s.id }),
            });
            const json = await res.json();
            if (json.success) { showNotification('success', 'Backup triggered!'); setTimeout(fetchScheduleData, 3000); }
            else showNotification('error', json.error || 'Failed');
        } finally { setRunningId(null); }
    };

    // ── Approvals ──────────────────────────────────────────────
    const handleApproval = async (approvalId: string, action: 'approve' | 'reject') => {
        const res = await authenticatedFetch('/api/admin/backup/approvals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvalId, action }),
        });
        const json = await res.json();
        if (json.success) { showNotification('success', action === 'approve' ? 'Rotation executed!' : 'Rejected'); fetchScheduleData(); }
        else showNotification('error', json.error || 'Failed');
    };

    const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
        { id: 'export', label: 'Export & Restore', icon: <DatabaseBackup size={16} /> },
        { id: 'schedule', label: 'Schedules', icon: <Clock size={16} />, badge: schedules.length },
        { id: 'history', label: 'History', icon: <History size={16} />, badge: logs.length },
        { id: 'approvals', label: 'Approvals', icon: <AlertTriangle size={16} />, badge: approvals.length || undefined },
    ];

    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <DatabaseBackup className="text-indigo-400" size={30} /> Backup & Restore
                    </h1>
                    <p className="text-slate-400 mt-1">Manage company data snapshots and automated schedules.</p>
                </div>

                {/* Pending approvals banner */}
                {approvals.length > 0 && (
                    <div
                        className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-amber-500/15 transition-all"
                        onClick={() => setTab('approvals')}
                    >
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="text-amber-400" size={20} />
                            <div>
                                <p className="text-amber-400 font-bold text-sm">{approvals.length} Rotation Approval{approvals.length > 1 ? 's' : ''} Pending</p>
                                <p className="text-slate-400 text-xs">Click to review and approve file rotations</p>
                            </div>
                        </div>
                        <span className="text-amber-400 text-xs font-bold">View →</span>
                    </div>
                )}

                {/* Tab Nav */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-1.5 flex gap-1 overflow-x-auto">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap relative ${tab === t.id ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                        >
                            {t.icon} {t.label}
                            {t.badge ? (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${t.id === 'approvals' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>
                                    {t.badge}
                                </span>
                            ) : null}
                        </button>
                    ))}
                </div>

                {/* ── Export & Restore ── */}
                {tab === 'export' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Export */}
                        <div className="bg-slate-800/50 border border-slate-700 p-7 rounded-3xl backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl"><Download size={22} /></div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Export Data</h2>
                                    <p className="text-sm text-slate-400">Download a full JSON backup</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Select Company</label>
                                    <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500">
                                        <option value="">-- Choose Company --</option>
                                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" id="masterOnly" checked={masterOnly} onChange={e => setMasterOnly(e.target.checked)} className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded" />
                                    <label htmlFor="masterOnly" className="text-sm text-slate-300">Export Master Data Only</label>
                                </div>
                                <button onClick={handleExport} disabled={!selectedCompany || loading} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-2">
                                    {loading ? <><Loader2 size={16} className="animate-spin" /> Exporting...</> : <><Download size={16} /> Download Backup</>}
                                </button>
                            </div>
                        </div>

                        {/* Restore */}
                        <div className="bg-slate-800/50 border border-slate-700 p-7 rounded-3xl backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl"><Upload size={22} /></div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Restore Data</h2>
                                    <p className="text-sm text-slate-400">Overwrite a company with backup</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="p-3 bg-rose-900/20 border border-rose-900/50 rounded-xl">
                                    <p className="text-xs text-rose-300 font-medium">⚠️ DATA LOSS WARNING: Restoring will permanently delete all existing data in the target company.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Target Company</label>
                                    <select value={targetCompany} onChange={e => setTargetCompany(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-rose-500">
                                        <option value="">-- Choose Target --</option>
                                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Backup File (JSON)</label>
                                    <input type="file" accept=".json" onChange={e => e.target.files?.[0] && setBackupFile(e.target.files[0])} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700" />
                                </div>
                                <button onClick={handleRestore} disabled={!targetCompany || !backupFile || restoring} className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-2">
                                    {restoring ? <><Loader2 size={16} className="animate-spin" /> Restoring...</> : <><Upload size={16} /> Restore Backup</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Schedules ── */}
                {tab === 'schedule' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-slate-400 text-sm">Automated backup schedules for all companies.</p>
                            <button onClick={() => { setEditSched(null); setShowSchedForm(!showSchedForm); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all">
                                <Plus size={14} /> New Schedule
                            </button>
                        </div>

                        {/* Schedule Form */}
                        {showSchedForm && (
                            <div className="bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-6 space-y-4">
                                <h3 className="font-bold text-white flex items-center gap-2"><Settings2 size={16} className="text-indigo-400" /> {editSched ? 'Edit' : 'New'} Schedule</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    {FREQ_OPTIONS.map(opt => (
                                        <button key={opt.value} onClick={() => handleFreqChange(opt.value)} className={`p-3 rounded-xl border text-sm font-semibold transition-all text-left ${form.frequency === opt.value ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                            <div className="font-bold">{opt.label}</div>
                                            <div className="text-xs opacity-70 mt-0.5">{opt.desc}</div>
                                        </button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Cron Expression</label>
                                        <input value={form.cronTime} onChange={e => setForm(f => ({ ...f, cronTime: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm font-mono focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5"><HardDrive size={11} className="inline mr-1" />Storage Path</label>
                                        <input value={form.storagePath} onChange={e => setForm(f => ({ ...f, storagePath: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm font-mono focus:ring-2 focus:ring-indigo-500" placeholder="./backups or E:\Backups" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-3">
                                    {[{ label: 'Keep Daily', key: 'retainDaily' }, { label: 'Keep Weekly', key: 'retainWeekly' }, { label: 'Keep Monthly', key: 'retainMonthly' }, { label: 'Keep Quarterly', key: 'retainQuarterly' }].map(item => (
                                        <div key={item.key}>
                                            <label className="block text-xs font-semibold text-slate-400 mb-1.5">{item.label}</label>
                                            <input type="number" min={1} value={form[item.key as keyof typeof form] as number} onChange={e => setForm(f => ({ ...f, [item.key]: parseInt(e.target.value) }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" id="ma" checked={form.masterOnly} onChange={e => setForm(f => ({ ...f, masterOnly: e.target.checked }))} className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-600 rounded" />
                                    <label htmlFor="ma" className="text-sm text-slate-300">Master data only</label>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleSaveSchedule} disabled={schedSaving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                                        {schedSaving ? <Loader2 size={14} className="animate-spin" /> : null} Save
                                    </button>
                                    <button onClick={() => setShowSchedForm(false)} className="px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl transition-all">Cancel</button>
                                </div>
                            </div>
                        )}

                        {/* Schedule list */}
                        {schedules.length === 0 && !showSchedForm ? (
                            <p className="text-slate-500 text-sm text-center py-10">No schedules yet. Create one above.</p>
                        ) : (
                            schedules.map(s => (
                                <div key={s.id} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-2 h-2 rounded-full ${s.isActive ? 'bg-emerald-400 shadow-emerald-400/50 shadow-sm' : 'bg-slate-600'}`} />
                                        <div>
                                            <p className="text-white font-bold">{s.frequency} · <span className="font-mono text-indigo-400 text-sm">{s.cronTime}</span></p>
                                            <p className="text-slate-400 text-xs">{s.storagePath} · Daily:{s.retainDaily} Weekly:{s.retainWeekly} Monthly:{s.retainMonthly} · {s._count?.logs ?? 0} runs</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleRunNow(s)} disabled={runningId === s.id} className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-all disabled:opacity-50">
                                            {runningId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                                        </button>
                                        <button onClick={() => openEditForm(s)} className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all"><Settings2 size={14} /></button>
                                        <button onClick={() => handleToggleSchedule(s)} className="text-slate-400 hover:text-white transition-colors">
                                            {s.isActive ? <ToggleRight size={24} className="text-emerald-400" /> : <ToggleLeft size={24} />}
                                        </button>
                                        <button onClick={() => handleDeleteSchedule(s.id)} className="p-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-lg transition-all"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ── History ── */}
                {tab === 'history' && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-white">Backup History</h3>
                            <button onClick={fetchScheduleData} className="text-slate-400 hover:text-white transition-colors"><RefreshCw size={14} /></button>
                        </div>
                        {logs.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-10">No backup history yet.</p>
                        ) : (
                            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                                {logs.map(log => (
                                    <div key={log.id} className="flex items-center justify-between bg-slate-900/50 rounded-xl px-4 py-3 gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {statusBadge(log.status)}
                                            <div className="min-w-0">
                                                <p className="text-white text-xs font-semibold truncate">{log.companyName ?? 'All Companies'} · {log.fileName ?? log.backupType}</p>
                                                <p className="text-slate-500 text-xs">{new Date(log.createdAt).toLocaleString()} · {formatBytes(log.fileSizeBytes)} · {log.triggeredBy}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{log.backupType}</span>
                                            {log.fileSizeBytes && (
                                                <a href={`/api/admin/backup/download/${log.id}`} className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded-lg transition-all">
                                                    <Download size={12} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Approvals ── */}
                {tab === 'approvals' && (
                    <div className="space-y-4">
                        <p className="text-slate-400 text-sm">Review and approve file rotation requests (Daily→Weekly, Weekly→Monthly, etc.)</p>
                        {approvals.length === 0 ? (
                            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-10 text-center">
                                <CheckCircle2 className="mx-auto text-emerald-400 mb-3" size={32} />
                                <p className="text-slate-400 text-sm">No pending rotation approvals.</p>
                            </div>
                        ) : (
                            approvals.map(a => (
                                <div key={a.id} className="bg-slate-800/50 border border-amber-500/20 rounded-2xl p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <AlertTriangle className="text-amber-400" size={16} />
                                                <span className="text-white font-bold">
                                                    Promote {a.fileCount} <span className="text-amber-400">{a.fromType}</span> → <span className="text-emerald-400">{a.toType}</span> backup
                                                </span>
                                            </div>
                                            <p className="text-slate-400 text-sm">
                                                {a.schedule?.company?.name ?? 'All Companies'} · {a.fileCount} files ({formatBytes(a.totalSizeBytes)}) will be deleted after consolidation
                                            </p>
                                            <p className="text-slate-500 text-xs mt-1">Requested: {new Date(a.requestedAt).toLocaleString()}</p>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button onClick={() => handleApproval(a.id, 'approve')} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-bold rounded-xl transition-all">
                                                <CheckCircle2 size={14} /> Approve
                                            </button>
                                            <button onClick={() => handleApproval(a.id, 'reject')} className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-sm font-bold rounded-xl transition-all">
                                                <XCircle size={14} /> Reject
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
