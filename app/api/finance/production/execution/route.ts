import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const body = await req.json();
        const { date, outputProductId, outputQuantity, warehouseId, inputs, overheads, mode, processStage } = body;

        let finalWarehouseId = warehouseId;
        if (!finalWarehouseId) {
            const wh = await prisma.warehouse.findFirst({ where: { companyId, deletedAt: null } });
            if (!wh) {
                return NextResponse.json({ success: false, error: "No warehouse found in the system." }, { status: 400 });
            }
            finalWarehouseId = wh.id;
        }

        if (!outputProductId || !outputQuantity) {
            return NextResponse.json({ success: false, error: "Missing required output fields" }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Calculate Total Costs
            let rawMaterialCost = 0;
            const inputRecords = [];
            
            for (const input of inputs) {
                const qty = Number(input.quantity);
                const rate = Number(input.costRate);
                const costValue = qty * rate;
                rawMaterialCost += costValue;
                
                let inputStageValue = input.stage;
                if (!inputStageValue) {
                    if (processStage === 'GREY') inputStageValue = 'RAW';
                    else if (processStage === 'FINISH') inputStageValue = 'GREY';
                }

                inputRecords.push({
                    productId: input.productId,
                    quantity: qty,
                    costValue: costValue,
                    lotNumber: input.lotNumber || null,
                    inputStage: inputStageValue
                });
            }

            let serviceCost = 0;
            let inHouseServiceCost = 0;
            const overheadRecords = [];
            const outHouseServiceInvoiceIds = [];
            const accrualRecordsToCreate: any[] = [];

            if (overheads && overheads.length > 0) {
                for (const ov of overheads) {
                    if (ov.isAccrual || ov.mode === "ACCRUAL") {
                        const consumeQty = Number(ov.quantity || 0);
                        const rate = Number(ov.rate || 0);
                        const ovAmount = consumeQty * rate;
                        serviceCost += ovAmount;

                        let prod = null;
                        if (ov.productId) {
                            prod = await tx.product.findUnique({
                                where: { id: ov.productId },
                                include: { Category: true, Unit: true }
                            });
                        }

                        const prodName = prod?.name || ov.manualName || "Unbilled Production Service";

                        // Sequence for PAC-YYYY-XXXX
                        const existingCount = accrualRecordsToCreate.length;
                        const accrualDelegate = (tx as any).productionAccrual || (prisma as any).productionAccrual;
                        let lastAccrual = null;
                        if (accrualDelegate?.findFirst) {
                            try {
                                lastAccrual = await accrualDelegate.findFirst({
                                    where: { companyId, accrualNo: { startsWith: `PAC-${new Date().getFullYear()}-` } },
                                    orderBy: { accrualNo: 'desc' }
                                });
                            } catch (err) {
                                console.warn('[Accrual seq lookup]:', err);
                            }
                        }
                        let nextSeq = 1;
                        if (lastAccrual) {
                            const parts = lastAccrual.accrualNo.split('-');
                            const lastNum = parseInt(parts[parts.length - 1]);
                            if (!isNaN(lastNum)) nextSeq = lastNum + 1;
                        }
                        const accrualNo = `PAC-${new Date().getFullYear()}-${(nextSeq + existingCount).toString().padStart(4, '0')}`;

                        // Find Accrued Liability account (Credit side)
                        let creditAccount = null;
                        const accruedAcc = await tx.account.findFirst({
                            where: {
                                companyId,
                                OR: [
                                    { code: '2130' },
                                    { name: { contains: 'Accrued', mode: 'insensitive' } },
                                    { name: { contains: 'Unbilled', mode: 'insensitive' } }
                                ]
                            }
                        });
                        creditAccount = accruedAcc?.id;
                        if (!creditAccount) {
                            const anyLiability = await tx.account.findFirst({
                                where: { companyId, type: 'LIABILITY', isPosting: true }
                            });
                            creditAccount = anyLiability?.id;
                        }
                        if (!creditAccount) {
                            const anyAcc = await tx.account.findFirst({ where: { companyId } });
                            creditAccount = anyAcc?.id;
                        }

                        let validSupplierId: string | null = null;
                        if (ov.supplierId) {
                            const s = await tx.supplier.findFirst({ where: { id: ov.supplierId, companyId } });
                            if (s) validSupplierId = s.id;
                        }

                        let validUnitId: string | null = null;
                        if (ov.unitId) {
                            const u = await tx.unit.findFirst({ where: { id: ov.unitId } });
                            if (u) validUnitId = u.id;
                        }
                        if (!validUnitId && prod?.baseUnitId) {
                            validUnitId = prod.baseUnitId;
                        }

                        accrualRecordsToCreate.push({
                            companyId,
                            accrualNo,
                            productId: ov.productId || (await tx.product.findFirst({ where: { companyId } }))?.id,
                            supplierId: validSupplierId,
                            unitId: validUnitId,
                            date: new Date(date),
                            stage: processStage,
                            serviceType: ov.serviceType || (prodName.toUpperCase().includes('DYE') ? 'DYEING' : prodName.toUpperCase().includes('PRINT') ? 'PRINTING' : 'WEAVING'),
                            qty: consumeQty,
                            rate: rate,
                            amount: ovAmount,
                            billedQty: 0,
                            status: 'PENDING',
                            remarks: ov.remarks || `Accrued Service for Production Batch`
                        });

                        overheadRecords.push({
                            description: `Unbilled Accrual [${accrualNo}]: ${prodName} (@ Rs. ${rate})`,
                            amount: ovAmount,
                            quantity: consumeQty,
                            unitId: validUnitId
                        });

                        if (creditAccount) {
                            outHouseServiceInvoiceIds.push({
                                piItemId: accrualNo,
                                consumeQty,
                                amount: ovAmount,
                                creditAccount,
                                customNarration: `Accrual [${accrualNo}] - ${prodName} (${consumeQty} @ ${rate})`
                            });
                        }
                    } else if (ov.purchaseInvoiceItemId) {
                        if (ov.purchaseInvoiceItemId.startsWith("OPENING-SVC-")) {
                            const ledgerId = ov.purchaseInvoiceItemId.replace("OPENING-SVC-", "");
                            const opEntry = await tx.stockLedger.findUnique({
                                where: { id: ledgerId },
                                include: { Product: { include: { Category: true } } }
                            });
                            if (!opEntry) throw new Error("Opening Service entry not found");

                            const consumeQty = Number(ov.quantity);
                            const remaining = Number(opEntry.qtyIn) - Number(opEntry.qtyOut);
                            if (consumeQty > remaining) throw new Error(`Cannot consume ${consumeQty} of opening service ${opEntry.Product?.name}. Only ${remaining} left.`);

                            const ovAmount = consumeQty * Number(opEntry.costRate);
                            serviceCost += ovAmount;

                            overheadRecords.push({
                                description: `Opening Service Consumed: ${opEntry.batchNo || 'Opening Balance'} - ${opEntry.Product?.name}`,
                                amount: ovAmount,
                                quantity: consumeQty,
                                unitId: opEntry.Product?.baseUnitId || null
                            });

                            await tx.stockLedger.update({
                                where: { id: opEntry.id },
                                data: { qtyOut: { increment: consumeQty } }
                            });

                            const cat = opEntry.Product?.Category;
                            let creditAccount = cat?.wipAccountId;
                            if (!creditAccount) {
                                const fallbackAcc = await tx.account.findFirst({
                                    where: {
                                        companyId,
                                        OR: [
                                            { name: { contains: 'WIP', mode: 'insensitive' } },
                                            { name: { contains: 'Work in Progress', mode: 'insensitive' } },
                                            { name: { contains: 'Direct Expense', mode: 'insensitive' } },
                                            { name: { contains: 'Cost', mode: 'insensitive' } },
                                            { name: { contains: 'Inventory', mode: 'insensitive' } }
                                        ]
                                    }
                                });
                                creditAccount = fallbackAcc?.id;
                            }
                            if (!creditAccount) {
                                const anyAcc = await tx.account.findFirst({ where: { companyId } });
                                creditAccount = anyAcc?.id;
                            }

                            if (creditAccount) {
                                outHouseServiceInvoiceIds.push({ piItemId: opEntry.id, consumeQty, amount: ovAmount, creditAccount });
                            }
                        } else if (ov.purchaseInvoiceItemId.startsWith("GRN-SVC-")) {
                            const grnItemId = ov.purchaseInvoiceItemId.replace("GRN-SVC-", "");
                            let grnItem: any = null;
                            try {
                                grnItem = await (tx.gRNItem as any).findUnique({
                                    where: { id: grnItemId },
                                    include: { grn: true, product: { include: { Category: true } } }
                                });
                            } catch {
                                grnItem = await (tx.gRNItem as any).findUnique({
                                    where: { id: grnItemId },
                                    include: { GRN: true, Product: { include: { Category: true } } }
                                });
                            }
                            if (!grnItem) throw new Error("GRN Service item not found");
                            const grnObj = grnItem.grn || grnItem.GRN;
                            const prodObj = grnItem.product || grnItem.Product;

                            const consumeQty = Number(ov.quantity);
                            const ovAmount = consumeQty * Number(grnItem.rate || 0);
                            serviceCost += ovAmount;

                            overheadRecords.push({
                                description: `GRN Service Consumed: ${grnObj?.grnNo || 'GRN'} - ${prodObj?.name || 'Service'}`,
                                amount: ovAmount,
                                quantity: consumeQty,
                                unitId: grnItem.unitId
                            });

                            const cat = prodObj?.Category;
                            let creditAccount = cat?.wipAccountId;
                            if (!creditAccount) {
                                const fallbackAcc = await tx.account.findFirst({
                                    where: {
                                        companyId,
                                        OR: [
                                            { name: { contains: 'Accrued', mode: 'insensitive' } },
                                            { name: { contains: 'WIP', mode: 'insensitive' } },
                                            { name: { contains: 'Direct Expense', mode: 'insensitive' } },
                                            { name: { contains: 'Cost', mode: 'insensitive' } }
                                        ]
                                    }
                                });
                                creditAccount = fallbackAcc?.id;
                            }
                            if (!creditAccount) {
                                const anyAcc = await tx.account.findFirst({ where: { companyId } });
                                creditAccount = anyAcc?.id;
                            }

                            if (creditAccount) {
                                outHouseServiceInvoiceIds.push({ piItemId: grnItem.id, consumeQty, amount: ovAmount, creditAccount });
                            }
                        } else {
                            const piItem = await tx.purchaseInvoiceItem.findUnique({
                                where: { id: ov.purchaseInvoiceItemId },
                                include: { PurchaseInvoice: true, Product: { include: { Category: true } } }
                            });
                            if (!piItem) throw new Error("Service Invoice Item not found");
                            
                            const consumeQty = Number(ov.quantity);
                            const remaining = Number(piItem.qty) - Number(piItem.consumedQty);
                            if (consumeQty > remaining) throw new Error(`Cannot consume ${consumeQty} of service ${piItem.Product?.name}. Only ${remaining} left.`);
                            
                            // Base rate exclusive of tax
                            const itemExCost = consumeQty * Number(piItem.rate);
                            const ovAmount = itemExCost;
                            
                            serviceCost += ovAmount;

                            overheadRecords.push({
                                description: `Service Consumed: ${piItem.PurchaseInvoice?.invoiceNo} - ${piItem.Product?.name}`,
                                amount: ovAmount,
                                purchaseInvoiceItemId: piItem.id,
                                quantity: consumeQty,
                                unitId: piItem.unitId
                            });

                            const cat = piItem.Product?.Category;
                            let creditAccount = cat?.wipAccountId;
                            if (!creditAccount) {
                                const fallbackAcc = await tx.account.findFirst({
                                    where: {
                                        companyId,
                                        OR: [
                                            { name: { contains: 'WIP', mode: 'insensitive' } },
                                            { name: { contains: 'Work in Progress', mode: 'insensitive' } },
                                            { name: { contains: 'Direct Expense', mode: 'insensitive' } },
                                            { name: { contains: 'Cost', mode: 'insensitive' } },
                                            { name: { contains: 'Inventory', mode: 'insensitive' } }
                                        ]
                                    }
                                });
                                creditAccount = fallbackAcc?.id;
                            }
                            if (!creditAccount) {
                                const anyAcc = await tx.account.findFirst({ where: { companyId } });
                                creditAccount = anyAcc?.id;
                            }

                            if (!creditAccount) throw new Error(`No GL Account found to credit service for ${piItem.Product?.name}.`);

                            outHouseServiceInvoiceIds.push({ piItemId: piItem.id, consumeQty, amount: ovAmount, creditAccount });
                            
                            await tx.purchaseInvoiceItem.update({
                                where: { id: piItem.id },
                                data: { consumedQty: { increment: consumeQty } }
                            });
                        }
                    } else if (Number(ov.amount) > 0) {
                        const amt = Number(ov.amount);
                        serviceCost += amt;
                        inHouseServiceCost += amt;
                        overheadRecords.push({
                            description: ov.description || "In-house Overhead",
                            amount: amt,
                            quantity: Number(ov.quantity || 1),
                            unitId: ov.unitId || null
                        });
                    }
                }
            }

            const totalOutputCost = rawMaterialCost + serviceCost;
            
            // Determine if the output is EFS (if any input is EFS)
            const isOutputEFS = inputs.some((input: any) => input.isEFS === true);
            
            // Generate Batch Number (Journal No)
            const batchNo = `BATCH-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
            const jvNo = `JV-${batchNo}`;

            // 2. Create Production Record
            const record = await tx.productionRecord.create({
                data: {
                    companyId,
                    date: new Date(date),
                    status: "COMPLETED",
                    outputProductId,
                    outputQuantity: Number(outputQuantity),
                    warehouseId: finalWarehouseId,
                    outputStage: processStage,
                    totalCost: totalOutputCost,
                    ProductionInput: { create: inputRecords },
                    ProductionOverhead: { create: overheadRecords }
                }
            });

            // 2.1 Persist Production Accruals (Unbilled services/materials for future invoice offset)
            const accrualCreator = (tx as any).productionAccrual || (prisma as any).productionAccrual;
            if (accrualCreator?.create) {
                for (const acc of accrualRecordsToCreate) {
                    try {
                        await accrualCreator.create({
                            data: {
                                ...acc,
                                productionId: record.id
                            }
                        });
                    } catch (err: any) {
                        console.error('[ProductionAccrual create error]:', err);
                    }
                }
            }

            // 3. Stock Ledger Updates
            const outputCostRate = totalOutputCost / Number(outputQuantity);
            
            // In (Output Product)
            await tx.stockLedger.create({
                data: {
                    companyId,
                    productId: outputProductId,
                    warehouseId: finalWarehouseId,
                    date: new Date(date),
                    qtyIn: Number(outputQuantity),
                    qtyOut: 0,
                    costRate: outputCostRate,
                    refType: 'PRODUCTION',
                    refId: record.id,
                    stage: processStage,
                    isEFS: isOutputEFS
                }
            });

            // Out (Input Products)
            for (const input of inputs) {
                let inputStageValue = input.stage;
                if (!inputStageValue) {
                    if (processStage === 'GREY') inputStageValue = 'RAW';
                    else if (processStage === 'FINISH') inputStageValue = 'GREY';
                }

                await tx.stockLedger.create({
                    data: {
                        companyId,
                        productId: input.productId,
                        warehouseId: finalWarehouseId,
                        date: new Date(date),
                        qtyIn: 0,
                        qtyOut: Number(input.quantity),
                        costRate: Number(input.costRate),
                        refType: 'PRODUCTION',
                        refId: record.id,
                        stage: inputStageValue || null,
                        isEFS: input.isEFS || false
                    }
                });

                if (input.purchaseInvoiceItemId && !input.purchaseInvoiceItemId.startsWith('OPENING-')) {
                    await tx.purchaseInvoiceItem.update({
                        where: { id: input.purchaseInvoiceItemId },
                        data: { consumedQty: { increment: Number(input.quantity) } }
                    }).catch(() => {});
                }
            }

            // 4. Accounting (Journal Entry)
            const outputProduct = await tx.product.findUnique({ where: { id: outputProductId }, include: { Category: true } });
            
            // Debit WIP or Inventory for Output
            // If output is WIP (like Grey Fabric), it should go to WIP account of its category or default Inventory
            let debitAccount = outputProduct?.inventoryAccountId || outputProduct?.Category?.wipAccountId;
            if (!debitAccount) {
                const defInv = await tx.account.findFirst({
                    where: { companyId, name: { contains: 'Inventory', mode: 'insensitive' }, type: 'ASSET' }
                });
                debitAccount = defInv?.id;
                if (!debitAccount) throw new Error("No Inventory Account found for output product.");
            }

            const lines = [];
            // DEBIT Output Product
            lines.push({
                accountId: debitAccount,
                debit: totalOutputCost,
                credit: 0,
                narration: `Produced ${outputQuantity} of ${outputProduct?.name} [Batch ${batchNo}]`
            });

            // CREDIT Input Products (Raw Materials)
            for (const input of inputs) {
                const inProduct = await tx.product.findUnique({ where: { id: input.productId }, include: { Category: true } });
                let creditAcc = inProduct?.inventoryAccountId || inProduct?.Category?.wipAccountId;
                if (!creditAcc) {
                    const defInv = await tx.account.findFirst({
                        where: { companyId, name: { contains: 'Inventory', mode: 'insensitive' }, type: 'ASSET' }
                    });
                    creditAcc = defInv?.id;
                    if (!creditAcc) throw new Error(`No Inventory Account found for input product ${inProduct?.name}.`);
                }
                const inputCost = Number(input.quantity) * Number(input.costRate);
                
                // Check if line with this account already exists
                const existing = lines.find(l => l.accountId === creditAcc && l.debit === 0);
                if (existing) {
                    existing.credit += inputCost;
                } else {
                    lines.push({
                        accountId: creditAcc,
                        debit: 0,
                        credit: inputCost,
                        narration: `Consumed ${input.quantity} of ${inProduct?.name} for Batch ${batchNo}`
                    });
                }
            }

            // CREDIT Services / Overheads
            // 1. Out-house services credit the WIP Clearing Account
            for (const svc of outHouseServiceInvoiceIds) {
                const existing = lines.find(l => l.accountId === svc.creditAccount && l.debit === 0);
                if (existing) {
                    existing.credit += svc.amount;
                } else {
                    lines.push({
                        accountId: svc.creditAccount,
                        debit: 0,
                        credit: svc.amount,
                        narration: (svc as any).customNarration || `Service consumed for Batch ${batchNo}`
                    });
                }
            }

            // 2. In-house overheads credit the Factory Overhead account
            if (inHouseServiceCost > 0) {
                let fohAccount = await tx.account.findFirst({
                    where: { companyId, name: { contains: 'Factory Overhead', mode: 'insensitive' }, isPosting: true }
                });
                if (!fohAccount) {
                    // Create one dynamically
                    fohAccount = await tx.account.create({
                        data: {
                            companyId,
                            code: `FOH-${Date.now().toString().slice(-4)}`,
                            name: 'Factory Overhead Applied',
                            type: 'LIABILITY',
                            isPosting: true
                        }
                    });
                }

                lines.push({
                    accountId: fohAccount.id,
                    debit: 0,
                    credit: inHouseServiceCost,
                    narration: `In-house Overheads applied to Batch ${batchNo}`
                });
            }

            await tx.journalEntry.create({
                data: {
                    companyId,
                    number: jvNo,
                    date: new Date(date),
                    type: 'JOURNAL',
                    reference: batchNo,
                    narration: `Production Batch ${batchNo} completed`,
                    lines: { create: lines }
                }
            });

            return record;
        }, {
            maxWait: 10000,
            timeout: 30000
        });

        return NextResponse.json({ success: true, data: result });
    } catch (e: any) {
        console.error("[PRODUCTION_EXECUTION_POST_ERROR]:", e);
        return NextResponse.json({ success: false, error: e.message || "Failed to post production batch" }, { status: 500 });
    }
}
