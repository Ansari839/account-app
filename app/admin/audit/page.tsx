"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';

interface AuditLog {
    id: string;
    action: string;
    module: string;
    entityId?: string;
    user?: {
        fullName: string;
        email: string;
    };
    companyId?: string;
    createdAt: string;
    beforeState?: any;
    afterState?: any;
}

export default function AuditLogPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        authenticatedFetch('/api/admin/audit')
            .then(res => res.json())
            .then(data => {
                if (data.success) setLogs(data.data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    return (
        <MainLayout>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">System Activity Log</h1>
                        <p className="text-slate-400 mt-1">Monitor all actions across the platform.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-slate-500">Loading logs...</div>
                ) : (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-slate-700/50 text-slate-200 uppercase font-bold text-xs">
                                <tr>
                                    <th className="p-4">Time</th>
                                    <th className="p-4">User</th>
                                    <th className="p-4">Action</th>
                                    <th className="p-4">Module</th>
                                    <th className="p-4">Company ID</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="p-4 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                                        <td className="p-4">
                                            <div className="font-bold text-white">{log.user?.fullName || 'System'}</div>
                                            <div className="text-xs">{log.user?.email}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${log.action.includes('CREATE') ? 'bg-emerald-500/10 text-emerald-500' :
                                                log.action.includes('UPDATE') ? 'bg-blue-500/10 text-blue-500' :
                                                    log.action.includes('DELETE') ? 'bg-rose-500/10 text-rose-500' :
                                                        'bg-slate-500/10 text-slate-500'
                                                }`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="p-4 font-mono text-xs">{log.module}</td>
                                        <td className="p-4 font-mono text-xs">{log.companyId?.substring(0, 8) || '-'}</td>
                                    </tr>
                                ))}
                                {logs.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-500">No activity logs found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
