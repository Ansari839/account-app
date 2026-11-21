import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const body = await req.json();
        const { accrualIds, items, warehouseId, date, remarks } = body;

        // Support both structured items array or plain accrualIds
        const settlementItems: any[] = [];
        if (items && Array.isArray(items) && items.length > 0) {
            settlementItems.push(...items);
        } else if (accrualIds && Array.isArray(accrualIds) && accrualIds.length > 0) {
            accrualIds.forEach((id: string) => {
                settlementItems.push({ accrualId: id });
            });
        }

        if (settlementItems.length === 0) {
            return NextResponse.json({ success: false, error: "Please select at least one accrual to settle." }, { status: 400 });
        }

        const settlementDate = date ? new Date(date) : new Date();

        const result = await prisma.$transaction(async (tx) => {
            const settledList = [];
            const pAccrualGetter = (tx as any).productionAccrual || (prisma as any).productionAccrual;

            // Find Accrued Liability account (Debit side)
            let accruedLiabilityAcc = await tx.account.findFirst({
                where: {
                    companyId,
                    OR: [
                        { code: '2130' },
                        { code: '2230' },
                        { name: { contains: 'Accrued', mode: 'insensitive' } },
                        { name: { contains: 'Unbilled', mode: 'insensitive' } }
                    ]
                }
            });
            if (!accruedLiabilityAcc) {
                accruedLiabilityAcc = await tx.account.findFirst({
                    where: { companyId, type: 'LIABILITY', isPosting: true }
                });
            }

            // Find Variance / Expense account if rate difference occurs
            let varianceAccount = await tx.account.findFirst({
                where: {
                    companyId,
                    OR: [
                        { name: { contains: 'Variance', mode: 'insensitive' } },
                        { name: { contains: 'Cost of Goods Sold', mode: 'insensitive' } },
                        { code: '5000' },
                        { type: 'EXPENSE', isPosting: true }
                    ]
                }
            });

            for (const item of settlementItems) {
                const accId = item.accrualId;
                if (!accId) continue;

                let pAccrual: any = null;
                if (pAccrualGetter?.findUnique) {
                    pAccrual = await pAccrualGetter.findUnique({
                        where: { id: accId },
                        include: { Product: true }
                    });
                } else {
                    const raw = await tx.$queryRaw<any[]>`
                        SELECT pa.*, p.name as "productName", p.code as "productCode"
                        FROM "ProductionAccrual" pa
                        LEFT JOIN "Product" p ON pa."productId" = p.id
                        WHERE pa.id = ${accId} LIMIT 1
                    `;
                    if (raw && raw.length > 0) {
                        pAccrual = {
                            ...raw[0],
                            Product: { name: raw[0].productName, code: raw[0].productCode }
                        };
                    }
                }

                if (!pAccrual) continue;

                const totalQty = Number(pAccrual.qty);
                const billedQty = Number(pAccrual.billedQty || 0);
                const remainingQty = Math.max(0, totalQty - billedQty);
                if (remainingQty <= 0) continue;

                // Determine effective settlement values
                const qtyToSettle = (Number(item.qty) > 0) ? Math.min(Number(item.qty), remainingQty) : remainingQty;
                const originalRate = Number(pAccrual.rate || 0);
                const stockRate = (Number(item.rate) > 0) ? Number(item.rate) : originalRate;
                
                // Which Product is actually being deducted from stock?
                // User can select a different yarn / product from their physical stock!
                const productIdToDeduct = item.productId || pAccrual.productId;
                const whToUse = item.warehouseId || warehouseId;

                if (!whToUse) {
                    throw new Error(`Target warehouse is required to deduct stock for ${pAccrual.accrualNo}.`);
                }

                const totalAccrualValue = qtyToSettle * originalRate;
                const totalStockDeductValue = qtyToSettle * stockRate;
                const lotRef = item.lotNo ? `-[${item.lotNo}]` : '';

                // 1. Deduct Physical Stock from Warehouse (StockLedger Out)
                await tx.stockLedger.create({
                    data: {
                        companyId,
                        productId: productIdToDeduct,
                        warehouseId: whToUse,
                        date: settlementDate,
                        qtyIn: 0,
                        qtyOut: qtyToSettle,
                        costRate: stockRate,
                        refType: 'PRODUCTION',
                        refId: pAccrual.productionId || pAccrual.id,
                        stage: pAccrual.stage || 'RAW',
                        batchNo: `STOCK-SETTLE-[${pAccrual.accrualNo}]${lotRef}`
                    }
                });

                // 2. Identify Product's Physical Inventory Asset Account (Credit side)
                const inProduct = await tx.product.findUnique({
                    where: { id: productIdToDeduct },
                    include: { Category: true }
                });
                let inventoryAccount = inProduct?.inventoryAccountId || inProduct?.Category?.wipAccountId;
                if (!inventoryAccount) {
                    const defInv = await tx.account.findFirst({
                        where: { companyId, name: { contains: 'Inventory', mode: 'insensitive' }, type: 'ASSET', isPosting: true }
                    });
                    inventoryAccount = defInv?.id;
                }

                // 3. Post General Ledger Entry
                // Debit: Accrued Liabilities (2130) -> clears the booked unbilled liability
                // Credit: Raw Material Inventory (1310) -> reduces the physical inventory asset
                // Any difference between original accrual rate and stock rate balances to Variance / COGS
                if (accruedLiabilityAcc && inventoryAccount) {
                    const jvNo = `JV-SETTLE-${Date.now().toString().slice(-6)}`;
                    const rateVariance = totalAccrualValue - totalStockDeductValue;

                    const glLines: any[] = [
                        {
                            accountId: accruedLiabilityAcc.id,
                            debit: totalAccrualValue,
                            credit: 0,
                            narration: `Clear Unbilled Accrual [${pAccrual.accrualNo}] (${qtyToSettle} @ Rs. ${originalRate})`
                        },
                        {
                            accountId: inventoryAccount,
                            debit: 0,
                            credit: totalStockDeductValue,
                            narration: `Physical Stock Out from Warehouse: ${inProduct?.name || 'Raw Material'} (${qtyToSettle} @ Rs. ${stockRate})`
                        }
                    ];

                    if (Math.abs(rateVariance) > 0.01 && varianceAccount) {
                        if (rateVariance > 0) {
                            // Accrued liability was higher than actual stock cost -> favorable variance (Credit)
                            glLines.push({
                                accountId: varianceAccount.id,
                                debit: 0,
                                credit: rateVariance,
                                narration: `Accrual vs Physical Stock Rate Variance [${pAccrual.accrualNo}]`
                            });
                        } else {
                            // Stock cost was higher than accrued liability -> unfavorable variance (Debit)
                            glLines.push({
                                accountId: varianceAccount.id,
                                debit: Math.abs(rateVariance),
                                credit: 0,
                                narration: `Accrual vs Physical Stock Rate Variance [${pAccrual.accrualNo}]`
                            });
                        }
                    }

                    await tx.journalEntry.create({
                        data: {
                            companyId,
                            voucherNo: jvNo,
                            date: settlementDate,
                            type: 'JOURNAL',
                            reference: pAccrual.accrualNo,
                            narration: `Settle Accrual [${pAccrual.accrualNo}] against Physical Stock: ${inProduct?.name || 'Raw Material'} (${qtyToSettle} @ Rs. ${stockRate})`,
                            lines: { create: glLines }
                        }
                    });
                }

                // 4. Update ProductionAccrual status & settled details
                const newBilledQty = billedQty + qtyToSettle;
                const newStatus = newBilledQty >= (totalQty - 0.001) ? 'BILLED' : 'PARTIALLY_BILLED';
                const settledNote = `[Settled from Stock: ${inProduct?.name || 'Physical Stock'} - ${qtyToSettle} @ Rs. ${stockRate}]`;
                const finalRemarks = `${pAccrual.remarks || ''} ${settledNote}`.trim();

                if (pAccrualGetter?.update) {
                    await pAccrualGetter.update({
                        where: { id: pAccrual.id },
                        data: {
                            productId: productIdToDeduct, // Update to the actual yarn/product settled
                            billedQty: newBilledQty,
                            status: newStatus,
                            remarks: finalRemarks
                        }
                    });
                } else {
                    await tx.$executeRaw`
                        UPDATE "ProductionAccrual"
                        SET "productId" = ${productIdToDeduct},
                            "billedQty" = ${newBilledQty},
                            "status" = ${newStatus},
                            "remarks" = ${finalRemarks},
                            "updatedAt" = NOW()
                        WHERE "id" = ${pAccrual.id}
                    `;
                }

                settledList.push({
                    accrualNo: pAccrual.accrualNo,
                    productName: inProduct?.name || pAccrual.productName,
                    qty: qtyToSettle,
                    amount: totalStockDeductValue
                });
            }

            return settledList;
        });

        return NextResponse.json({
            success: true,
            data: result,
            message: `Successfully settled ${result.length} accrual batch(es) against physical warehouse stock.`
        });
    } catch (e: any) {
        console.error("Settle Accrual Stock Error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
