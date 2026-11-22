import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const { searchParams } = new URL(req.url);
        const accrualId = searchParams.get("accrualId");
        const productionId = searchParams.get("productionId");
        const type = searchParams.get("type"); // "ALL" | "STOCK" | "INVOICE"
        const search = searchParams.get("search")?.toLowerCase();

        // 1. Fetch all ProductionAccruals that have billedQty > 0 or status != PENDING
        const accrualWhere: any = { companyId };
        if (accrualId) accrualWhere.id = accrualId;
        if (productionId) accrualWhere.productionId = productionId;
        accrualWhere.OR = [
            { billedQty: { gt: 0 } },
            { status: { in: ["BILLED", "PARTIALLY_BILLED"] } }
        ];

        const accruals = await prisma.productionAccrual.findMany({
            where: accrualWhere,
            include: {
                Product: { select: { id: true, name: true, code: true, hsCode: true, stage: true } },
                Supplier: { select: { id: true, name: true, code: true } },
                Unit: { select: { id: true, code: true, name: true } },
                ProductionRecord: {
                    select: {
                        id: true,
                        date: true,
                        Product: { select: { name: true, code: true } }
                    }
                },
                PurchaseInvoiceItem: {
                    include: {
                        PurchaseInvoice: {
                            select: { id: true, invoiceNo: true, date: true, Supplier: { select: { name: true } } }
                        },
                        Product: { select: { id: true, name: true, code: true } }
                    }
                }
            },
            orderBy: { date: "desc" }
        });

        // 2. Fetch all StockLedger records for stock settlements: batchNo LIKE 'STOCK-SETTLE-[%]'
        const stockLedgers = await prisma.stockLedger.findMany({
            where: {
                companyId,
                batchNo: { startsWith: "STOCK-SETTLE-[" }
            },
            include: {
                Product: { select: { id: true, name: true, code: true, hsCode: true } },
                Warehouse: { select: { id: true, name: true } }
            },
            orderBy: { date: "desc" }
        });

        // 3. Fetch linked Journal Entries: number starts with 'JV-SETTLE-'
        const journalEntries = await prisma.journalEntry.findMany({
            where: {
                companyId,
                number: { startsWith: "JV-SETTLE-" }
            },
            include: {
                lines: {
                    include: { Account: { select: { id: true, name: true, code: true } } }
                }
            },
            orderBy: { date: "desc" }
        });

        // Map journal entries by reference (accrualNo)
        const jvMap: Record<string, any[]> = {};
        journalEntries.forEach(jv => {
            if (jv.reference) {
                if (!jvMap[jv.reference]) jvMap[jv.reference] = [];
                jvMap[jv.reference].push(jv);
            }
        });

        const settlements: any[] = [];

        // Match StockLedger entries to Accruals
        for (const sl of stockLedgers) {
            // batchNo format: STOCK-SETTLE-[PAC-YYYY-XXXX]-[optional-lot]
            const match = sl.batchNo?.match(/^STOCK-SETTLE-\[([^\]]+)\](?:-\[(.*)\])?$/);
            const accrualNo = match ? match[1] : null;
            const lotNo = match ? match[2] : null;

            const acc = accruals.find(a => a.accrualNo === accrualNo || a.id === sl.refId || a.productionId === sl.refId);

            if (accrualId && acc?.id !== accrualId) continue;
            if (productionId && acc?.productionId !== productionId) continue;
            if (type === "INVOICE") continue;

            const jvs = accrualNo ? (jvMap[accrualNo] || []) : [];
            const linkedJv = jvs[0] || null;

            settlements.push({
                id: `STOCK-${sl.id}`,
                settlementId: sl.id,
                settlementType: "STOCK",
                accrualId: acc?.id || null,
                accrualNo: accrualNo || acc?.accrualNo || "PAC-UNKNOWN",
                accrualDate: acc?.date || sl.date,
                stage: acc?.stage || sl.stage || "RAW",
                serviceType: acc?.serviceType || "RAW_YARN",
                productionId: acc?.productionId || sl.refId,
                productionBatchNo: `Batch #${(acc?.productionId || sl.refId)?.slice(-6).toUpperCase()}`,
                outputProductName: acc?.ProductionRecord?.Product?.name || "-",
                productId: sl.productId,
                productName: sl.Product?.name || acc?.Product?.name || "Raw Material",
                productCode: sl.Product?.code || acc?.Product?.code || "",
                hsCode: sl.Product?.hsCode || acc?.Product?.hsCode || "",
                warehouseId: sl.warehouseId,
                warehouseName: sl.Warehouse?.name || "Main Warehouse",
                lotNo: lotNo || "-",
                qty: Number(sl.qtyOut),
                rate: Number(sl.costRate),
                amount: Math.round(Number(sl.qtyOut) * Number(sl.costRate) * 100) / 100,
                settlementDate: sl.date ? new Date(sl.date).toISOString().split("T")[0] : "",
                remarks: acc?.remarks || `Settled from Warehouse Stock (${sl.Warehouse?.name || ''})`,
                journalEntry: linkedJv ? {
                    id: linkedJv.id,
                    number: linkedJv.number,
                    date: linkedJv.date,
                    narration: linkedJv.narration,
                    lines: linkedJv.lines.map((l: any) => ({
                        accountCode: l.Account?.code,
                        accountName: l.Account?.name,
                        debit: Number(l.debit),
                        credit: Number(l.credit)
                    }))
                } : null,
                purchaseInvoice: null
            });
        }

        // Match PurchaseInvoiceItems to Accruals
        if (type !== "STOCK") {
            for (const acc of accruals) {
                if (acc.PurchaseInvoiceItem && acc.PurchaseInvoiceItem.length > 0) {
                    for (const piItem of acc.PurchaseInvoiceItem) {
                        settlements.push({
                            id: `INV-${piItem.id}`,
                            settlementId: piItem.id,
                            settlementType: "INVOICE",
                            accrualId: acc.id,
                            accrualNo: acc.accrualNo,
                            accrualDate: acc.date,
                            stage: acc.stage,
                            serviceType: acc.serviceType,
                            productionId: acc.productionId,
                            productionBatchNo: `Batch #${acc.productionId?.slice(-6).toUpperCase()}`,
                            outputProductName: acc.ProductionRecord?.Product?.name || "-",
                            productId: piItem.productId || acc.productId,
                            productName: piItem.Product?.name || acc.Product?.name || "Item",
                            productCode: piItem.Product?.code || acc.Product?.code || "",
                            hsCode: acc.Product?.hsCode || "",
                            warehouseId: null,
                            warehouseName: "Supplier Invoice",
                            lotNo: piItem.PurchaseInvoice?.invoiceNo || "-",
                            qty: Number(piItem.qty),
                            rate: Number(piItem.rate),
                            amount: Math.round(Number(piItem.qty) * Number(piItem.rate) * 100) / 100,
                            settlementDate: piItem.PurchaseInvoice?.date ? new Date(piItem.PurchaseInvoice.date).toISOString().split("T")[0] : "",
                            remarks: `Billed via Purchase Invoice #${piItem.PurchaseInvoice?.invoiceNo}`,
                            journalEntry: null,
                            purchaseInvoice: piItem.PurchaseInvoice ? {
                                id: piItem.PurchaseInvoice.id,
                                invoiceNo: piItem.PurchaseInvoice.invoiceNo,
                                date: piItem.PurchaseInvoice.date,
                                supplierName: piItem.PurchaseInvoice.Supplier?.name || "Vendor"
                            } : null
                        });
                    }
                }
            }
        }

        // Apply Search filter
        const filtered = settlements.filter(s => {
            if (!search) return true;
            return (
                s.accrualNo?.toLowerCase().includes(search) ||
                s.productName?.toLowerCase().includes(search) ||
                s.productCode?.toLowerCase().includes(search) ||
                s.warehouseName?.toLowerCase().includes(search) ||
                s.lotNo?.toLowerCase().includes(search) ||
                s.remarks?.toLowerCase().includes(search) ||
                s.journalEntry?.number?.toLowerCase().includes(search) ||
                s.purchaseInvoice?.invoiceNo?.toLowerCase().includes(search)
            );
        });

        return NextResponse.json({
            success: true,
            data: filtered
        });
    } catch (e: any) {
        console.error("Fetch Settlements Error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
