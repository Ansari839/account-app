import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const { id } = await context.params;
        const rawId = id.replace(/^(STOCK-|INV-)/, "");
        const isStock = !id.startsWith("INV-");

        if (isStock) {
            const sl = await prisma.stockLedger.findUnique({
                where: { id: rawId },
                include: {
                    Product: { select: { id: true, name: true, code: true, hsCode: true } },
                    Warehouse: { select: { id: true, name: true } }
                }
            });

            if (!sl || sl.companyId !== companyId) {
                return NextResponse.json({ success: false, error: "Stock settlement record not found" }, { status: 404 });
            }

            const match = sl.batchNo?.match(/^STOCK-SETTLE-\[([^\]]+)\](?:-\[(.*)\])?$/);
            const accrualNo = match ? match[1] : null;
            const lotNo = match ? match[2] : null;

            const acc = await prisma.productionAccrual.findFirst({
                where: {
                    companyId,
                    OR: [
                        { accrualNo: accrualNo || "" },
                        { id: sl.refId },
                        { productionId: sl.refId }
                    ]
                },
                include: {
                    Product: { select: { id: true, name: true, code: true, hsCode: true } },
                    ProductionRecord: { select: { id: true, Product: { select: { name: true } } } }
                }
            });

            const jv = accrualNo ? await prisma.journalEntry.findFirst({
                where: { companyId, reference: accrualNo, number: { startsWith: "JV-SETTLE-" } },
                include: { lines: { include: { Account: { select: { code: true, name: true } } } } }
            }) : null;

            return NextResponse.json({
                success: true,
                data: {
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
                    productName: sl.Product?.name || "Raw Material",
                    productCode: sl.Product?.code || "",
                    hsCode: sl.Product?.hsCode || "",
                    warehouseId: sl.warehouseId,
                    warehouseName: sl.Warehouse?.name || "Warehouse",
                    lotNo: lotNo || "-",
                    qty: Number(sl.qtyOut),
                    rate: Number(sl.costRate),
                    amount: Math.round(Number(sl.qtyOut) * Number(sl.costRate) * 100) / 100,
                    settlementDate: sl.date ? new Date(sl.date).toISOString().split("T")[0] : "",
                    remarks: acc?.remarks || "",
                    journalEntry: jv ? {
                        id: jv.id,
                        number: jv.number,
                        date: jv.date,
                        narration: jv.narration,
                        lines: jv.lines.map((l: any) => ({
                            accountCode: l.Account?.code,
                            accountName: l.Account?.name,
                            debit: Number(l.debit),
                            credit: Number(l.credit)
                        }))
                    } : null
                }
            });
        } else {
            const piItem = await prisma.purchaseInvoiceItem.findUnique({
                where: { id: rawId },
                include: {
                    PurchaseInvoice: { include: { Supplier: true } },
                    Product: true
                }
            });

            if (!piItem) {
                return NextResponse.json({ success: false, error: "Invoice settlement item not found" }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                data: {
                    id: `INV-${piItem.id}`,
                    settlementId: piItem.id,
                    settlementType: "INVOICE",
                    accrualId: piItem.accrualId,
                    qty: Number(piItem.qty),
                    rate: Number(piItem.rate),
                    amount: Math.round(Number(piItem.qty) * Number(piItem.rate) * 100) / 100,
                    invoiceNo: piItem.PurchaseInvoice?.invoiceNo
                }
            });
        }
    } catch (e: any) {
        console.error("Get Settlement Error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const { id } = await context.params;
        const rawId = id.replace(/^(STOCK-|INV-)/, "");
        const isStock = !id.startsWith("INV-");

        const body = await req.json();
        const { qty, rate, productId, warehouseId, settlementDate, remarks } = body;

        const newQty = Number(qty);
        const newRate = Number(rate);

        if (newQty <= 0) {
            return NextResponse.json({ success: false, error: "Settlement quantity must be greater than zero." }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            if (isStock) {
                const sl = await tx.stockLedger.findUnique({
                    where: { id: rawId },
                    include: { Product: true }
                });

                if (!sl || sl.companyId !== companyId) {
                    throw new Error("Stock settlement record not found");
                }

                const oldQty = Number(sl.qtyOut);
                const oldRate = Number(sl.costRate);
                const qtyDiff = newQty - oldQty;

                const match = sl.batchNo?.match(/STOCK-SETTLE-\[([^\]]+)\]/);
                const accrualNo = match ? match[1] : null;

                const acc = await tx.productionAccrual.findFirst({
                    where: {
                        companyId,
                        OR: [
                            { accrualNo: accrualNo || "" },
                            { id: sl.refId },
                            { productionId: sl.refId }
                        ]
                    }
                });

                // 1. Update StockLedger
                await tx.stockLedger.update({
                    where: { id: sl.id },
                    data: {
                        qtyOut: newQty,
                        costRate: newRate,
                        productId: productId || sl.productId,
                        warehouseId: warehouseId || sl.warehouseId,
                        date: settlementDate ? new Date(settlementDate) : sl.date
                    }
                });

                // 2. Update Journal Entry if exists
                if (accrualNo) {
                    const jvs = await tx.journalEntry.findMany({
                        where: { companyId, reference: accrualNo, number: { startsWith: "JV-SETTLE-" } }
                    });
                    const newTotalVal = Math.round(newQty * newRate * 100) / 100;
                    for (const jv of jvs) {
                        // Update debit and credit lines
                        const lines = await tx.journalLine.findMany({ where: { entryId: jv.id } });
                        for (const line of lines) {
                            if (Number(line.debit) > 0) {
                                await tx.journalLine.update({
                                    where: { id: line.id },
                                    data: { debit: newTotalVal }
                                });
                            } else if (Number(line.credit) > 0) {
                                await tx.journalLine.update({
                                    where: { id: line.id },
                                    data: { credit: newTotalVal }
                                });
                            }
                        }
                    }
                }

                // 3. Update ProductionAccrual
                if (acc) {
                    const updatedBilledQty = Math.max(0, Number(acc.billedQty) + qtyDiff);
                    const totalDemanded = Number(acc.qty);
                    const newStatus = updatedBilledQty >= (totalDemanded - 0.001) ? "BILLED" : "PARTIALLY_BILLED";

                    const productObj = productId ? await tx.product.findUnique({ where: { id: productId } }) : sl.Product;
                    const settledNote = `[Settled from Stock: ${productObj?.name || 'Stock'} - ${newQty} @ Rs. ${newRate}]`;
                    const cleanedRemarks = (acc.remarks || '').replace(/\[Settled from Stock:[^\]]+\]/g, '').trim();
                    const finalRemarks = `${cleanedRemarks} ${settledNote}`.trim();

                    await tx.productionAccrual.update({
                        where: { id: acc.id },
                        data: {
                            productId: productId || acc.productId,
                            billedQty: updatedBilledQty,
                            status: newStatus,
                            remarks: finalRemarks
                        }
                    });
                }

                return { updated: true, newQty, newRate };
            } else {
                // Purchase Invoice Item settlement update
                const piItem = await tx.purchaseInvoiceItem.findUnique({ where: { id: rawId } });
                if (!piItem) throw new Error("Purchase invoice settlement line not found");

                const oldQty = Number(piItem.qty);
                const qtyDiff = newQty - oldQty;

                await tx.purchaseInvoiceItem.update({
                    where: { id: piItem.id },
                    data: {
                        qty: newQty,
                        rate: newRate,
                        total: Math.round(newQty * newRate * 100) / 100
                    }
                });

                if (piItem.accrualId) {
                    const acc = await tx.productionAccrual.findUnique({ where: { id: piItem.accrualId } });
                    if (acc) {
                        const updatedBilledQty = Math.max(0, Number(acc.billedQty) + qtyDiff);
                        const totalDemanded = Number(acc.qty);
                        const newStatus = updatedBilledQty >= (totalDemanded - 0.001) ? "BILLED" : "PARTIALLY_BILLED";
                        await tx.productionAccrual.update({
                            where: { id: acc.id },
                            data: {
                                billedQty: updatedBilledQty,
                                status: newStatus
                            }
                        });
                    }
                }

                return { updated: true, newQty, newRate };
            }
        });

        return NextResponse.json({
            success: true,
            data: result,
            message: "Settlement record updated successfully."
        });
    } catch (e: any) {
        console.error("Update Settlement Error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const { id } = await context.params;
        const rawId = id.replace(/^(STOCK-|INV-)/, "");
        const isStock = !id.startsWith("INV-");

        const result = await prisma.$transaction(async (tx) => {
            if (isStock) {
                const sl = await tx.stockLedger.findUnique({
                    where: { id: rawId },
                    include: { Product: true }
                });

                if (!sl || sl.companyId !== companyId) {
                    throw new Error("Stock settlement record not found or already deleted");
                }

                const match = sl.batchNo?.match(/STOCK-SETTLE-\[([^\]]+)\]/);
                const accrualNo = match ? match[1] : null;

                const acc = await tx.productionAccrual.findFirst({
                    where: {
                        companyId,
                        OR: [
                            { accrualNo: accrualNo || "" },
                            { id: sl.refId },
                            { productionId: sl.refId }
                        ]
                    }
                });

                // 1. Delete linked Journal Entries & Lines
                if (accrualNo) {
                    const jvs = await tx.journalEntry.findMany({
                        where: { companyId, reference: accrualNo, number: { startsWith: "JV-SETTLE-" } }
                    });
                    for (const jv of jvs) {
                        await tx.journalLine.deleteMany({ where: { entryId: jv.id } });
                        await tx.journalEntry.delete({ where: { id: jv.id } });
                    }
                }

                // 2. Delete the StockLedger deduction (instantly restoring warehouse inventory)
                await tx.stockLedger.delete({ where: { id: sl.id } });

                // 3. Revert ProductionAccrual: reduce billedQty & set status back to PENDING if 0
                if (acc) {
                    const newBilled = Math.max(0, Number(acc.billedQty) - Number(sl.qtyOut));
                    const newStatus = newBilled <= 0.001 ? "PENDING" : "PARTIALLY_BILLED";
                    const cleanedRemarks = (acc.remarks || '').replace(/\[Settled from Stock:[^\]]+\]/g, '').trim();

                    await tx.productionAccrual.update({
                        where: { id: acc.id },
                        data: {
                            billedQty: newBilled,
                            status: newStatus,
                            remarks: cleanedRemarks || null
                        }
                    });
                }

                return {
                    reverted: true,
                    accrualNo: accrualNo || acc?.accrualNo,
                    restoredQty: Number(sl.qtyOut),
                    productName: sl.Product?.name
                };
            } else {
                // For Purchase Invoice line settlement
                const piItem = await tx.purchaseInvoiceItem.findUnique({ where: { id: rawId } });
                if (!piItem) throw new Error("Purchase invoice line not found");

                if (piItem.accrualId) {
                    const acc = await tx.productionAccrual.findUnique({ where: { id: piItem.accrualId } });
                    if (acc) {
                        const newBilled = Math.max(0, Number(acc.billedQty) - Number(piItem.qty));
                        const newStatus = newBilled <= 0.001 ? "PENDING" : "PARTIALLY_BILLED";
                        await tx.productionAccrual.update({
                            where: { id: acc.id },
                            data: {
                                billedQty: newBilled,
                                status: newStatus
                            }
                        });
                    }
                    await tx.purchaseInvoiceItem.update({
                        where: { id: piItem.id },
                        data: { accrualId: null }
                    });
                }

                return { reverted: true, accrualNo: "Invoice Line Unlinked" };
            }
        });

        return NextResponse.json({
            success: true,
            data: result,
            message: `Settlement reverted successfully. Physical stock restored and accrual returned to Pending.`
        });
    } catch (e: any) {
        console.error("Delete/Revert Settlement Error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
