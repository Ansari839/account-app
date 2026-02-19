"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { authenticatedFetch } from '@/lib/api-client';
import CompanyAdminDashboard from '@/components/dashboard/CompanyAdminDashboard';
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';
import SalesDashboard from '@/components/dashboard/SalesDashboard';
import PurchaseDashboard from '@/components/dashboard/PurchaseDashboard';
import WarehouseDashboard from '@/components/dashboard/WarehouseDashboard';

export default function DashboardPage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'default' | 'global'>('default');
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [dashboardType, setDashboardType] = useState<string>('COMPANY');
    const [role, setRole] = useState<string>('');

    const fetchStats = async () => {
        setLoading(true);
        try {
            let url = '/api/finance/dashboard/stats';
            const params = new URLSearchParams();

            if (viewMode === 'global') {
                params.append('mode', 'global');
            }

            // If we have a stored role preference (optional feature), we could append it here
            // params.append('role', 'SALES');

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const res = await authenticatedFetch(url);
            const json = await res.json();

            if (json.success) {
                setStats(json.data);
                setDashboardType(json.type);
                setIsSuperAdmin(json.isSuperAdmin);
                if (json.role) setRole(json.role);
            }
        } catch (err) {
            console.error('Failed to fetch dashboard stats:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [viewMode]);

    const renderDashboard = () => {
        if (loading && !stats) return <div className="flex h-64 items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;

        if (dashboardType === 'GLOBAL') {
            return <SuperAdminDashboard stats={stats} loading={loading} />;
        }

        if (dashboardType === 'ROLE_BASED') {
            switch (role) {
                case 'SALES': return <SalesDashboard stats={stats} loading={loading} />;
                case 'PURCHASE': return <PurchaseDashboard stats={stats} loading={loading} />;
                case 'WAREHOUSE': return <WarehouseDashboard stats={stats} loading={loading} />;
                default: return <CompanyAdminDashboard stats={stats} loading={loading} />;
            }
        }

        return <CompanyAdminDashboard stats={stats} loading={loading} />;
    };

    return (
        <MainLayout>
            <div className="relative">
                {isSuperAdmin && (
                    <div className="absolute top-0 right-0 z-10 -mt-2">
                        <button
                            onClick={() => setViewMode(viewMode === 'default' ? 'global' : 'default')}
                            className="bg-slate-800 text-white text-xs px-3 py-1 rounded-full hover:bg-slate-700 transition-colors border border-slate-600 shadow-lg"
                        >
                            Switch to {viewMode === 'default' ? 'Global View' : 'Company View'}
                        </button>
                    </div>
                )}
                {renderDashboard()}
            </div>
        </MainLayout>
    );
}
