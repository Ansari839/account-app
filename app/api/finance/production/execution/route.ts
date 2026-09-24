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
            const overheadRecords = [];
            const outHouseServiceInvoiceIds = [];

            if (mode === "OUT-HOUSE") {
                if (!overheads || overheads.length === 0) {
                    throw new Error("Out-House production requires at least one service invoice to be consumed.");
                }

                // Out-house overheads come from unconsumed purchase invoice items (services)
                for (const ov of overheads) {
                    if (ov.purchaseInvoiceItemId) {
                        const piItem = await tx.purchaseInvoiceItem.findUnique({
                            where: { id: ov.purchaseInvoiceItemId },
                            include: { invoice: true, product: { include: { category: true } } }
                        });
                        if (!piItem) throw new Error("Service Invoice Item not found");
                        
                        const consumeQty = Number(ov.quantity);
                        const remaining = Number(piItem.qty) - Number(piItem.consumedQty);
                        if (consumeQty > remaining) throw new Error(`Cannot consume ${consumeQty} of service ${piItem.product.name}. Only ${remaining} left.`);
                        
                        // Only use the base rate (exclusive of tax) because the tax was already booked to the Tax Account
                        // during the purchase invoice. Adding tax here would over-credit the WIP account.
                        const itemExCost = consumeQty * Number(piItem.rate);
                        const ovAmount = itemExCost;
                        
                        serviceCost += ovAmount;

                        overheadRecords.push({
                            description: `Service Consumed: ${piItem.invoice.invoiceNo} - ${piItem.product.name}`,
                            amount: ovAmount,
                            purchaseInvoiceItemId: piItem.id,
                            quantity: consumeQty,
                            unitId: piItem.unitId
                        });

                        // Keep track for JV credit
                        const cat = piItem.product.category;
                        let creditAccount = cat?.wipAccountId;
                        if (!creditAccount) throw new Error(`Category of service ${piItem.product.name} does not have a WIP Account linked.`);

                        outHouseServiceInvoiceIds.push({ piItemId: piItem.id, consumeQty, amount: ovAmount, creditAccount });
                        
                        // Mark as consumed
                        await tx.purchaseInvoiceItem.update({
                            where: { id: piItem.id },
                            data: { consumedQty: { increment: consumeQty } }
                        });
                    }
                }
            } else {
                // In-house overheads
                for (const ov of overheads) {
                    const amt = Number(ov.amount);
                    serviceCost += amt;
                    overheadRecords.push({
                        description: ov.description || "In-house Overhead",
                        amount: amt,
                        quantity: Number(ov.quantity || 1),
                        unitId: ov.unitId || null
                    });
                }
            }

            const totalOutputCost = rawMaterialCost + serviceCost;
            
            // Generate Batch Number (Journal No)
            const lastRecord = await tx.productionRecord.findFirst({
                where: { companyId },
                orderBy: { createdAt: 'desc' }
            });
            const batchNo = `BATCH-${Date.now().toString().slice(-6)}`;
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
                    inputs: { create: inputRecords },
                    overheads: { create: overheadRecords }
                }
            });

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
                    stage: processStage
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
                        stage: inputStageValue || null
                    }
                });
            }

            // 4. Accounting (Journal Entry)
            const outputProduct = await tx.product.findUnique({ where: { id: outputProductId }, include: { category: true } });
            
            // Debit WIP or Inventory for Output
            // If output is WIP (like Grey Fabric), it should go to WIP account of its category or default Inventory
            let debitAccount = outputProduct?.inventoryAccountId || outputProduct?.category?.wipAccountId;
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
                const inProduct = await tx.product.findUnique({ where: { id: input.productId }, include: { category: true } });
                let creditAcc = inProduct?.inventoryAccountId || inProduct?.category?.wipAccountId;
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
            if (mode === "OUT-HOUSE") {
                // Out-house services credit the WIP Clearing Account
                for (const svc of outHouseServiceInvoiceIds) {
                    const existing = lines.find(l => l.accountId === svc.creditAccount && l.debit === 0);
                    if (existing) {
                        existing.credit += svc.amount;
                    } else {
                        lines.push({
                            accountId: svc.creditAccount,
                            debit: 0,
                            credit: svc.amount,
                            narration: `Service consumed for Batch ${batchNo}`
                        });
                    }
                }
            } else {
                // In-house overheads credit the Factory Overhead account
                if (serviceCost > 0) {
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
                        credit: serviceCost,
                        narration: `In-house Overheads applied to Batch ${batchNo}`
                    });
                }
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
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
