"use client";

import React, { useEffect } from "react";
import { Printer, X, FileText, CheckCircle2 } from "lucide-react";
import ReportPrintHeader, { ReportPrintFilter } from "./ReportPrintHeader";
import ReportPrintFooter from "./ReportPrintFooter";

export interface ReportPrintPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyName?: string;
    companyAddress?: string | null;
    companyPhone?: string | null;
    companyEmail?: string | null;
    reportTitle: string;
    period?: string;
    filters?: ReportPrintFilter[];
    currency?: string;
    children: React.ReactNode;
    orientation?: "portrait" | "landscape";
}

export default function ReportPrintPreviewModal({
    isOpen,
    onClose,
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,
    reportTitle,
    period,
    filters = [],
    currency = "PKR",
    children,
    orientation = "portrait"
}: ReportPrintPreviewModalProps) {
    // Handle Escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
            // Prevent background page scrolling while preview is open
            document.body.style.overflow = "hidden";
        }
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "auto";
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handlePrint = () => {
        window.print();
    };

    const isLandscape = orientation === "landscape";

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md overflow-y-auto flex flex-col items-center p-3 sm:p-6 print:p-0 print:bg-white print:static print:z-auto print:overflow-visible animate-in fade-in duration-200">
            {/* Top Floating Control Bar - SCREEN ONLY */}
            <header className="sticky top-0 z-50 w-full max-w-4xl bg-slate-900/95 border border-slate-700/80 shadow-2xl rounded-2xl px-5 py-3.5 mb-5 flex flex-wrap items-center justify-between gap-3 text-white print:hidden">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
                        <FileText size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">{reportTitle}</h3>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {isLandscape ? "A4 Landscape" : "A4 Portrait (210×297mm)"}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium truncate max-w-xs sm:max-w-md">
                            {companyName || "Active Company"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95"
                    >
                        <Printer size={15} />
                        <span>Print / Save PDF</span>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition-colors"
                        title="Close preview (Esc)"
                    >
                        <X size={16} />
                        <span className="hidden sm:inline">Close</span>
                    </button>
                </div>
            </header>

            {/* A4 Paper Sheet Container */}
            <div
                className={`w-full bg-white text-slate-900 shadow-2xl rounded-sm transition-all print:shadow-none print:rounded-none print:w-full print:max-w-none print:min-h-0 print:p-0 print:m-0 ${
                    isLandscape
                        ? "max-w-[297mm] min-h-[210mm] p-6 sm:p-10"
                        : "max-w-[210mm] min-h-[297mm] p-6 sm:p-12"
                }`}
                style={{
                    backgroundColor: "#ffffff",
                    color: "#0f172a"
                }}
            >
                {/* Official Letterhead Header */}
                <ReportPrintHeader
                    companyName={companyName}
                    companyAddress={companyAddress}
                    companyPhone={companyPhone}
                    companyEmail={companyEmail}
                    reportTitle={reportTitle}
                    period={period}
                    filters={filters}
                    currency={currency}
                />

                {/* Printable Report Data Body */}
                <div className="report-print-content text-slate-900 print:text-black">
                    {children}
                </div>

                {/* Official Footer with Signatures */}
                <ReportPrintFooter />
            </div>
        </div>
    );
}
