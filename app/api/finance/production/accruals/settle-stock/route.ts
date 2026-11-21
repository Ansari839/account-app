import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const body = await req.json();
        const { accrualIds, warehouseId, date, remarks } = body;

        if (!accrualIds || !Array.isArray(accrualIds) || accrualIds.length === 0) {
            return NextResponse.json({ success: false, error: "Please select at least one accrual to settle." }, { status: 400 });
        }

        if (!warehouseId) {
            return NextResponse.json({ success: false, error: "Please select a warehouse to deduct physical stock from." }, { status: 400 });
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

            for (const accId of accrualIds) {
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

                const rate = Number(pAccrual.rate || 0);
                const totalSettlementValue = remainingQty * rate;

                // 1. Deduct Physical Stock from Warehouse (StockLedger Out)
                await tx.stockLedger.create({
                    data: {
                        companyId,
                        productId: pAccrual.productId,
                        warehouseId: warehouseId,
                        date: settlementDate,
                        qtyIn: 0,
                        qtyOut: remainingQty,
                        costRate: rate,
                        refType: 'PRODUCTION',
                        refId: pAccrual.productionId || pAccrual.id,
                        stage: pAccrual.stage || 'RAW',
                        batchNo: `STOCK-SETTLE-[${pAccrual.accrualNo}]`
                    }
                });

                // 2. Identify Product's Physical Inventory Asset Account (Credit side)
                const inProduct = await tx.product.findUnique({
                    where: { id: pAccrual.productId },
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
                // Debit: Accrued Liabilities (2130) -> clears the pending unbilled liability
                // Credit: Raw Material Inventory (1310) -> reduces the physical inventory asset
                if (accruedLiabilityAcc && inventoryAccount) {
                    const jvNo = `JV-SETTLE-${Date.now().toString().slice(-6)}`;
                    await tx.journalEntry.create({
                        data: {
                            companyId,
                            voucherNo: jvNo,
                            date: settlementDate,
                            type: 'JOURNAL',
                            reference: pAccrual.accrualNo,
                            narration: `Settle Accrual [${pAccrual.accrualNo}] against Physical Warehouse Stock - ${inProduct?.name || 'Raw Material'} (${remainingQty} @ Rs. ${rate})`,
                            lines: {
                                create: [
                                    {
                                        accountId: accruedLiabilityAcc.id,
                                        debit: totalSettlementValue,
                                        credit: 0,
                                        narration: `Clear Unbilled Accrual [${pAccrual.accrualNo}]`
                                    },
                                    {
                                        accountId: inventoryAccount,
                                        debit: 0,
                                        credit: totalSettlementValue,
                                        narration: `Physical Stock Out from Warehouse for [${pAccrual.accrualNo}]`
                                    }
                                ]
                            }
                        }
                    });
                }

                // 4. Update ProductionAccrual status to BILLED / SETTLED
                const newBilledQty = billedQty + remainingQty;
                if (pAccrualGetter?.update) {
                    await pAccrualGetter.update({
                        where: { id: pAccrual.id },
                        data: {
                            billedQty: newBilledQty,
                            status: 'BILLED',
                            remarks: `${pAccrual.remarks || ''} [Settled from Warehouse Stock]`.trim()
                        }
                    });
                } else {
                    await tx.$executeRaw`
                        UPDATE "ProductionAccrual"
                        SET "billedQty" = ${newBilledQty},
                            "status" = 'BILLED',
                            "remarks" = ${`${pAccrual.remarks || ''} [Settled from Warehouse Stock]`.trim()},
                            "updatedAt" = NOW()
                        WHERE "id" = ${pAccrual.id}
                    `;
                }

                settledList.push({
                    accrualNo: pAccrual.accrualNo,
                    qty: remainingQty,
                    amount: totalSettlementValue
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
