"use client";

import React from "react";

export interface ReportPrintFilter {
    label: string;
    value: string;
}

export interface ReportPrintHeaderProps {
    companyName?: string;
    companyAddress?: string | null;
    companyPhone?: string | null;
    companyEmail?: string | null;
    reportTitle: string;
    period?: string;
    filters?: ReportPrintFilter[];
    currency?: string;
    className?: string;
}

export default function ReportPrintHeader({
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,
    reportTitle,
    period,
    filters = [],
    currency = "PKR",
    className = ""
}: ReportPrintHeaderProps) {
    const formattedDate = new Date().toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
    const formattedTime = new Date().toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit"
    });

    return (
        <div className={`report-print-header text-slate-900 border-b-2 border-slate-900 pb-5 mb-6 ${className}`}>
            {/* Top Row: Company Letterhead */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-slate-950 font-sans">
                        {companyName || "COMPANY NAME"}
                    </h1>
                    {(companyAddress || companyPhone || companyEmail) && (
                        <div className="text-xs text-slate-600 font-medium space-y-0.5">
                            {companyAddress && <p>{companyAddress}</p>}
                            <p className="flex flex-wrap items-center gap-x-2">
                                {companyPhone && <span>Tel: {companyPhone}</span>}
                                {companyPhone && companyEmail && <span>•</span>}
                                {companyEmail && <span>Email: {companyEmail}</span>}
                            </p>
                        </div>
                    )}
                </div>

                {/* Print Meta Badge */}
                <div className="text-right sm:text-right text-xs font-mono text-slate-500 shrink-0">
                    <div className="inline-block px-2.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[11px] font-bold text-slate-800 uppercase tracking-widest mb-1">
                        Accounting Report
                    </div>
                    <p className="text-[11px]">Date: {formattedDate} {formattedTime}</p>
                    <p className="text-[11px]">Base Currency: <span className="font-bold text-slate-800">{currency}</span></p>
                </div>
            </div>

            {/* Title & Filter Badges Row */}
            <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">
                        {reportTitle}
                    </h2>
                    {period && (
                        <p className="text-xs font-semibold text-slate-600 mt-0.5">
                            {period}
                        </p>
                    )}
                </div>

                {filters.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                        {filters.map((f, i) => (
                            <span 
                                key={i} 
                                className="px-2.5 py-0.5 bg-slate-100 border border-slate-300 rounded-md text-slate-800 font-medium text-[11px]"
                            >
                                <span className="font-bold text-slate-600">{f.label}:</span> {f.value}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
