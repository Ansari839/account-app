"use client";

import React, { useEffect, useState } from 'react';
import { Clock, HardDrive, ToggleLeft, ToggleRight, Play, Download, CheckCircle2, XCircle, AlertTriangle, Loader2, Plus, Trash2, RefreshCw } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';

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
}

interface BackupLog {
    id: string;
    backupType: string;
    status: string;
    fileName: string | null;
    fileSizeBytes: string | null;
    triggeredBy: string;
    createdAt: string;
    approval: { id: string; fromType: string; toType: string; status: string; fileCount: number } | null;
}

interface Approval {
    id: string;
    fromType: string;
    toType: string;
    fileCount: number;
    totalSizeBytes: string | null;
    requestedAt: string;
    scheduleId: string;
}

const FREQ_OPTIONS = [
    { value: 'DAILY', label: 'Daily', cron: '0 2 * * *', desc: 'Every day at 2:00 AM' },
    { value: 'WEEKLY', label: 'Weekly', cron: '0 2 * * 0', desc: 'Every Sunday at 2:00 AM' },
    { value: 'MONTHLY', label: 'Monthly', cron: '0 2 1 * *', desc: '1st of every month at 2:00 AM' },
];

function formatBytes(bytes: string | null) {
    if (!bytes) return '—';
    const n = parseInt(bytes);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function statusBadge(status: string) {
    if (status === 'SUCCESS') return <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-semibold flex items-center gap-1"><CheckCircle2 size={11} /> Success</span>;
    if (status === 'FAILED') return <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-xs rounded-full font-semibold flex items-center gap-1"><XCircle size={11} /> Failed</span>;
    return <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full font-semibold flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Running</span>;
}

export default function BackupSettings() {
    const { showNotification } = useNotifications();
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [logs, setLogs] = useState<BackupLog[]>([]);
    const [approvals, setApprovals] = useState<Approval[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [running, setRunning] = useState(false);
    const [showForm, setShowForm] = useState(false);

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

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [sRes, lRes] = await Promise.all([
                authenticatedFetch('/api/company/backup/schedule'),
                authenticatedFetch('/api/company/backup/logs'),
            ]);
            const sJson = await sRes.json();
            const lJson = await lRes.json();

            if (sJson.success && sJson.data.length > 0) {
                setSchedule(sJson.data[0]);
                setForm(f => ({ ...f, ...sJson.data[0] }));
            }
            if (lJson.success) setLogs(lJson.data);

            // Check for pending approvals
            const pendingApprovals = (lJson.data as BackupLog[])
                .filter(l => l.approval && l.approval.status === 'PENDING')
                .map(l => l.approval!);
            setApprovals(pendingApprovals as any);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleFrequencyChange = (freq: string) => {
        const opt = FREQ_OPTIONS.find(f => f.value === freq);
        setForm(f => ({ ...f, frequency: freq, cronTime: opt?.cron ?? f.cronTime }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const method = schedule ? 'PUT' : 'POST';
            const url = schedule
                ? `/api/admin/backup/schedule/${schedule.id}`
                : '/api/company/backup/schedule';

            const res = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const json = await res.json();
            if (json.success) {
                setSchedule(json.data);
                setShowForm(false);
                showNotification('success', 'Backup schedule saved!');
                fetchAll();
            } else {
                showNotification('error', json.error || 'Failed to save schedule');
            }
        } catch (e) {
            showNotification('error', 'Error saving schedule');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async () => {
        if (!schedule) return;
        const res = await authenticatedFetch(`/api/admin/backup/schedule/${schedule.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...schedule, isActive: !schedule.isActive }),
        });
        const json = await res.json();
        if (json.success) {
            setSchedule(json.data);
            showNotification('success', `Schedule ${json.data.isActive ? 'enabled' : 'disabled'}`);
        }
    };

    const handleRunNow = async () => {
        if (!schedule) return;
        setRunning(true);
        try {
            const res = await authenticatedFetch('/api/company/backup/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduleId: schedule.id }),
            });
            const json = await res.json();
            if (json.success) {
                showNotification('success', 'Backup started! Check history below.');
                setTimeout(fetchAll, 3000);
            } else {
                showNotification('error', json.error || 'Failed to trigger backup');
            }
        } finally {
            setRunning(false);
        }
    };

    const handleApproval = async (approvalId: string, action: 'approve' | 'reject') => {
        const res = await authenticatedFetch('/api/admin/backup/approvals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvalId, action }),
        });
        const json = await res.json();
        if (json.success) {
            showNotification('success', action === 'approve' ? 'Rotation approved & executed!' : 'Rotation rejected');
            fetchAll();
        } else {
            showNotification('error', json.error || 'Action failed');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-indigo-400" size={32} />
        </div>
    );

    return (
        <div className="space-y-6">

            {/* ── Pending Approvals Banner ── */}
            {approvals.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                        <AlertTriangle size={16} /> Rotation Approval Required
                    </div>
                    {approvals.map(a => (
                        <div key={a.id} className="flex items-center justify-between bg-slate-900/50 rounded-xl p-4">
                            <div>
                                <p className="text-white font-semibold text-sm">
                                    Promote {a.fileCount} <span className="text-amber-400">{a.fromType}</span> backups → <span className="text-emerald-400">{a.toType}</span>
                                </p>
                                <p className="text-slate-400 text-xs mt-0.5">
                                    Total size: {formatBytes(a.totalSizeBytes)} · Requested {new Date(a.requestedAt).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleApproval(a.id, 'approve')}
                                    className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                                >
                                    <CheckCircle2 size={13} /> Approve
                                </button>
                                <button
                                    onClick={() => handleApproval(a.id, 'reject')}
                                    className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                                >
                                    <XCircle size={13} /> Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Schedule Card ── */}
            <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                            <Clock size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Auto Backup Schedule</h3>
                            <p className="text-slate-400 text-xs">Configure automatic backup frequency</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {schedule && (
                            <>
                                <button
                                    onClick={handleRunNow}
                                    disabled={running}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                                >
                                    {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                                    Run Now
                                </button>
                                <button onClick={handleToggle} className="text-slate-400 hover:text-white transition-colors">
                                    {schedule.isActive
                                        ? <ToggleRight size={28} className="text-emerald-400" />
                                        : <ToggleLeft size={28} />}
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => setShowForm(!showForm)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-xs font-bold rounded-lg transition-all"
                        >
                            {schedule ? <RefreshCw size={12} /> : <Plus size={12} />}
                            {schedule ? 'Edit' : 'Create Schedule'}
                        </button>
                    </div>
                </div>

                {/* Current schedule summary */}
                {schedule && !showForm && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Frequency', value: schedule.frequency },
                            { label: 'Storage Path', value: schedule.storagePath },
                            { label: 'Keep Daily', value: `${schedule.retainDaily} files` },
                            { label: 'Keep Weekly', value: `${schedule.retainWeekly} files` },
                        ].map(item => (
                            <div key={item.label} className="bg-slate-800/50 rounded-xl p-3">
                                <p className="text-slate-400 text-xs">{item.label}</p>
                                <p className="text-white font-bold text-sm mt-0.5">{item.value}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Form */}
                {(showForm || !schedule) && (
                    <div className="space-y-4 mt-4">
                        {/* Frequency */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-2">Frequency</label>
                            <div className="grid grid-cols-3 gap-2">
                                {FREQ_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleFrequencyChange(opt.value)}
                                        className={`p-3 rounded-xl border text-sm font-semibold transition-all text-left ${form.frequency === opt.value
                                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                                            : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}
                                    >
                                        <div className="font-bold text-sm">{opt.label}</div>
                                        <div className="text-xs opacity-70 mt-0.5">{opt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom cron time */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Cron Expression</label>
                                <input
                                    value={form.cronTime}
                                    onChange={e => setForm(f => ({ ...f, cronTime: e.target.value }))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                                    placeholder="0 2 * * *"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                                    <HardDrive size={11} className="inline mr-1" />
                                    Storage Path (local or USB)
                                </label>
                                <input
                                    value={form.storagePath}
                                    onChange={e => setForm(f => ({ ...f, storagePath: e.target.value }))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                                    placeholder="./backups or E:\Backups"
                                />
                            </div>
                        </div>

                        {/* Retention */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'Keep Daily', key: 'retainDaily' },
                                { label: 'Keep Weekly', key: 'retainWeekly' },
                                { label: 'Keep Monthly', key: 'retainMonthly' },
                                { label: 'Keep Quarterly', key: 'retainQuarterly' },
                            ].map(item => (
                                <div key={item.key}>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">{item.label}</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={form[item.key as keyof typeof form] as number}
                                        onChange={e => setForm(f => ({ ...f, [item.key]: parseInt(e.target.value) }))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Master only */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="masterOnly"
                                checked={form.masterOnly}
                                onChange={e => setForm(f => ({ ...f, masterOnly: e.target.checked }))}
                                className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-600 rounded"
                            />
                            <label htmlFor="masterOnly" className="text-sm text-slate-300">Master data only (no transactions)</label>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                            {saving ? 'Saving...' : 'Save Schedule'}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Backup History ── */}
            <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Download size={16} className="text-indigo-400" /> Backup History
                    </h3>
                    <button onClick={fetchAll} className="text-slate-400 hover:text-white transition-colors">
                        <RefreshCw size={14} />
                    </button>
                </div>

                {logs.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-8">No backups yet. Create a schedule or run manually.</p>
                ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {logs.map(log => (
                            <div key={log.id} className="flex items-center justify-between bg-slate-800/50 rounded-xl px-4 py-3 gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    {statusBadge(log.status)}
                                    <div className="min-w-0">
                                        <p className="text-white text-xs font-semibold truncate">
                                            {log.fileName ?? `${log.backupType} Backup`}
                                        </p>
                                        <p className="text-slate-500 text-xs">
                                            {new Date(log.createdAt).toLocaleString()} · {formatBytes(log.fileSizeBytes)} · {log.triggeredBy}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full shrink-0">
                                    {log.backupType}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
