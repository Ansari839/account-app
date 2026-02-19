"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import { useNotifications } from '@/context/NotificationContext';

interface Company {
    id: string;
    name: string;
}

export default function AdminBackupPage() {
    const { showNotification } = useNotifications();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<string>('');
    const [targetCompany, setTargetCompany] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [backupFile, setBackupFile] = useState<File | null>(null);
    const [masterOnly, setMasterOnly] = useState(false);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            const res = await authenticatedFetch('/api/admin/companies');
            const json = await res.json();
            if (json.success) {
                setCompanies(json.data);
            }
        } catch (error) {
            console.error("Failed to fetch companies", error);
        }
    };

    const handleExport = async () => {
        if (!selectedCompany) return;
        try {
            setLoading(true);
            const res = await authenticatedFetch(`/api/admin/backup/export?companyId=${selectedCompany}`);

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const companyName = companies.find(c => c.id === selectedCompany)?.name || 'company';
                a.download = `backup-${companyName}-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                showNotification('success', 'Backup downloaded successfully');
            } else {
                showNotification('error', 'Failed to export backup');
            }
        } catch (error) {
            console.error(error);
            showNotification('error', 'Export failed');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setBackupFile(e.target.files[0]);
        }
    };

    const handleRestore = async () => {
        if (!targetCompany || !backupFile) return;

        const confirm = window.confirm(
            "WARNING: This will DELETE ALL DATA in the selected company and replace it with the backup. This action cannot be undone. Are you sure?"
        );

        if (!confirm) return;

        try {
            setRestoring(true);
            const text = await backupFile.text();
            const backupData = JSON.parse(text);

            const res = await authenticatedFetch('/api/admin/backup/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetCompanyId: targetCompany,
                    backupData
                })
            });

            const json = await res.json();
            if (json.success) {
                showNotification('success', 'Company restored successfully');
                setBackupFile(null);
                setTargetCompany('');
            } else {
                showNotification('error', json.error || 'Restore failed');
            }
        } catch (error) {
            console.error(error);
            showNotification('error', 'Restore failed: Invalid file or server error');
        } finally {
            setRestoring(false);
        }
    };

    return (
        <MainLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Backup & Restore</h1>
                    <p className="text-slate-400 mt-1">Manage company data snapshots.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Export Section */}
                    <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-3xl backdrop-blur-sm">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Export Data</h2>
                                <p className="text-sm text-slate-400">Download a full JSON backup.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Select Company</label>
                                <select
                                    value={selectedCompany}
                                    onChange={(e) => setSelectedCompany(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">-- Choose Company --</option>
                                    {companies.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="masterOnly"
                                    checked={masterOnly}
                                    onChange={(e) => setMasterOnly(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="masterOnly" className="text-sm text-slate-300">Export Master Data Only (No Transactions)</label>
                            </div>

                            <button
                                onClick={handleExport}
                                disabled={!selectedCompany || loading}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                        Exporting...
                                    </>
                                ) : (
                                    'Download Backup'
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Restore Section */}
                    <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-3xl backdrop-blur-sm">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Restore Data</h2>
                                <p className="text-sm text-slate-400">Overwrite a company with backup.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-rose-900/20 border border-rose-900/50 rounded-xl">
                                <p className="text-xs text-rose-300 font-medium">
                                    ⚠️ DATA LOSS WARNING: Restoring will permanently delete all existing data in the target company.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Target Company</label>
                                <select
                                    value={targetCompany}
                                    onChange={(e) => setTargetCompany(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-rose-500"
                                >
                                    <option value="">-- Choose Target --</option>
                                    {companies.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Backup File (JSON)</label>
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileChange}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700"
                                />
                            </div>

                            <button
                                onClick={handleRestore}
                                disabled={!targetCompany || !backupFile || restoring}
                                className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-2"
                            >
                                {restoring ? (
                                    <>
                                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                        Restoring...
                                    </>
                                ) : (
                                    'Restore Backup'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
