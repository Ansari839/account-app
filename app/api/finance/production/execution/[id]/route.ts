import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const { id } = await params;
        const rawRecord = await prisma.productionRecord.findFirst({
            where: { id, companyId },
            include: {
                Product: { include: { Category: true, Unit: true } },
                Warehouse: true,
                ProductionInput: { include: { Product: { include: { Unit: true } } } },
                ProductionOverhead: { include: { Unit: true, PurchaseInvoiceItem: { include: { Product: true } } } }
            }
        });

        if (!rawRecord) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

        const record: any = {
            ...rawRecord,
            outputProduct: {
                ...rawRecord.Product,
                category: rawRecord.Product.Category,
                baseUnit: rawRecord.Product.Unit
            },
            warehouse: rawRecord.Warehouse,
            inputs: rawRecord.ProductionInput.map(inp => ({
                ...inp,
                product: {
                    ...inp.Product,
                    baseUnit: inp.Product.Unit
                }
            })),
            overheads: rawRecord.ProductionOverhead.map(ov => ({
                ...ov,
                unit: ov.Unit,
                purchaseInvoiceItem: ov.PurchaseInvoiceItem ? {
                    ...ov.PurchaseInvoiceItem,
                    product: ov.PurchaseInvoiceItem.Product
                } : null
            }))
        };

        // Calculate cost breakdown for inputs based on their latest production
        for (let i = 0; i < record.inputs.length; i++) {
            const input = record.inputs[i];
            
            // Find latest production for this input to get its cost composition
            const latestProd = await prisma.productionRecord.findFirst({
                where: { 
                    companyId, 
                    outputProductId: input.productId,
                    outputStage: input.inputStage
                },
                orderBy: { date: 'desc' },
                include: {
                    ProductionInput: { include: { Product: { include: { Unit: true } } } },
                    ProductionOverhead: { include: { Unit: true, PurchaseInvoiceItem: { include: { Product: { include: { Unit: true } } } } } }
                }
            });

            if (latestProd && Number(latestProd.totalCost) > 0) {
                const totalLatestCost = Number(latestProd.totalCost);
                const outQty = Number(latestProd.outputQuantity) || 1;
                
                // Ratios relative to the consumed input's quantity & cost
                const qtyRatio = Number(input.quantity) / outQty;
                const costRatio = Number(input.costValue) / totalLatestCost;

                const hierarchy = {
                    materials: [] as any[],
                    services: [] as any[]
                };

                (latestProd.ProductionInput || []).forEach((inp: any) => {
                    hierarchy.materials.push({
                        name: inp.Product.name,
                        stage: inp.inputStage || 'RAW',
                        quantity: Number(inp.quantity) * qtyRatio,
                        unit: inp.Product.Unit?.code || '-',
                        cost: Number(inp.costValue) * costRatio
                    });
                });

                (latestProd.ProductionOverhead || []).forEach((ov: any) => {
                    hierarchy.services.push({
                        name: ov.description,
                        quantity: Number(ov.quantity) * qtyRatio,
                        unit: ov.Unit?.code || ov.PurchaseInvoiceItem?.Product?.Unit?.code || '-',
                        cost: Number(ov.amount) * costRatio
                    });
                });

                input.hierarchy = hierarchy;
            }
        }

        // Fetch associated batchNo and spec dimensions from StockLedger
        const outLedger = await prisma.stockLedger.findFirst({
            where: { refType: 'PRODUCTION', refId: id, qtyIn: { gt: 0 } },
            select: { batchNo: true }
        });
        record.batchNo = outLedger?.batchNo || null;

        // Parse batch specifications
        let cleanBatchNo = record.batchNo || '';
        let outputUom = record.outputProduct?.baseUnit?.code || 'Units';
        let cutSize: number | null = null;
        let cutUnit: string = 'MTR';
        let pieceWeightKg: number | null = null;
        let netWeightKg: number | null = null;

        if (record.batchNo) {
            const bNo = record.batchNo;
            if (bNo.includes(' [')) {
                cleanBatchNo = bNo.split(' [')[0];
            }
            const uomMatch = bNo.match(/\[(\d+(?:\.\d+)?)\s*([A-Za-z]+)/i);
            if (uomMatch && uomMatch[2]) {
                outputUom = uomMatch[2].toUpperCase();
            }
            const cutMatch = bNo.match(/Cut:\s*([\d.]+)\s*([A-Za-z]+)(?:\/pc)?/i);
            if (cutMatch) {
                cutSize = parseFloat(cutMatch[1]);
                cutUnit = cutMatch[2].toUpperCase();
            }
            const unitMatch = bNo.match(/Unit:\s*([\d.]+)\s*KG/i);
            if (unitMatch) {
                pieceWeightKg = parseFloat(unitMatch[1]);
            }
            const netMatch = bNo.match(/Net:\s*([\d.]+)\s*KG/i);
            if (netMatch) {
                netWeightKg = parseFloat(netMatch[1]);
            }
        }

        record.cleanBatchNo = cleanBatchNo;
        record.outputUom = outputUom;
        record.cutSize = cutSize;
        record.cutUnit = cutUnit;
        record.pieceWeightKg = pieceWeightKg;
        record.netWeightKg = netWeightKg;

        // Fetch ProductionAccruals created for this batch (Yarn, Weaving, Dyeing)
        let accruals: any[] = [];
        try {
            const accModel = (prisma as any).productionAccrual;
            if (accModel?.findMany) {
                accruals = await accModel.findMany({
                    where: { productionId: id },
                    include: {
                        Product: { select: { id: true, name: true, code: true, hsCode: true } },
                        Supplier: { select: { id: true, name: true, code: true } },
                        Unit: { select: { id: true, code: true, name: true } }
                    },
                    orderBy: { accrualNo: 'asc' }
                });
            } else {
                throw new Error();
            }
        } catch {
            try {
                const rawRows = await prisma.$queryRaw<any[]>`
                    SELECT 
                        pa.*,
                        p.name as "productName",
                        p.code as "productCode",
                        p."hsCode" as "productHsCode",
                        s.name as "supplierName",
                        s.code as "supplierCode",
                        u.code as "unitCode"
                    FROM "ProductionAccrual" pa
                    LEFT JOIN "Product" p ON pa."productId" = p.id
                    LEFT JOIN "Supplier" s ON pa."supplierId" = s.id
                    LEFT JOIN "Unit" u ON pa."unitId" = u.id
                    WHERE pa."productionId" = ${id}
                    ORDER BY pa."accrualNo" ASC
                `;
                accruals = (rawRows || []).map(r => ({
                    id: r.id,
                    accrualNo: r.accrualNo,
                    date: r.date,
                    stage: r.stage,
                    serviceType: r.serviceType,
                    qty: r.qty,
                    rate: r.rate,
                    amount: r.amount,
                    billedQty: r.billedQty,
                    status: r.status,
                    remarks: r.remarks,
                    Product: { id: r.productId, name: r.productName, code: r.productCode, hsCode: r.productHsCode },
                    Supplier: r.supplierId ? { id: r.supplierId, name: r.supplierName, code: r.supplierCode } : null,
                    Unit: r.unitId ? { id: r.unitId, code: r.unitCode } : null
                }));
            } catch (e) {
                accruals = [];
            }
        }
        record.accruals = accruals.map(a => {
            let billRef = '';
            let billDate = '';
            if (a.remarks) {
                const refMatch = a.remarks.match(/\[BILL_REF:\s*([^\]]+)\]/i);
                if (refMatch) billRef = refMatch[1].trim();
                const dateMatch = a.remarks.match(/\[BILL_DATE:\s*([^\]]+)\]/i);
                if (dateMatch) billDate = dateMatch[1].trim();
            }
            return {
                ...a,
                billRef,
                billDate
            };
        });

        return NextResponse.json({ success: true, data: record });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const { id } = await params;
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

        const existingRecord = await prisma.productionRecord.findFirst({
            where: { id, companyId },
            include: {
                ProductionOverhead: true,
                ProductionInput: true,
                ProductionAccrual: true
            }
        });

        if (!existingRecord) {
            return NextResponse.json({ success: false, error: "Record not found" }, { status: 404 });
        }

        // Safety check: Cannot modify if any accrual was already billed or settled
        const settledAccruals = (existingRecord.ProductionAccrual || []).filter(
            (a: any) => a.status === 'BILLED' || Number(a.billedQty) > 0.001
        );
        if (settledAccruals.length > 0) {
            return NextResponse.json({
                success: false,
                error: `Cannot modify this batch because Accrual ${settledAccruals[0].accrualNo} has already been settled or billed. Please revert the settlement first.`
            }, { status: 400 });
        }

        // Fetch existing output ledger to preserve original batch number
        const existingOutLedger = await prisma.stockLedger.findFirst({
            where: { companyId, refType: 'PRODUCTION', refId: existingRecord.id, qtyIn: { gt: 0 } }
        });
        const rawOldBatchNo = existingOutLedger?.batchNo || '';
        const cleanBatchNo = rawOldBatchNo ? rawOldBatchNo.split(' [')[0] : `BATCH-${existingRecord.id.slice(-6).toUpperCase()}`;

        const result = await prisma.$transaction(async (tx) => {
            // 1. REVERT PREVIOUS EFFECTS
            for (const overhead of existingRecord.ProductionOverhead) {
                if (overhead.purchaseInvoiceItemId && overhead.quantity) {
                    await tx.purchaseInvoiceItem.update({
                        where: { id: overhead.purchaseInvoiceItemId },
                        data: { consumedQty: { decrement: overhead.quantity } }
                    }).catch(() => {});
                }
            }

            await tx.stockLedger.deleteMany({
                where: { refType: 'PRODUCTION', refId: existingRecord.id }
            });

            const oldJe = await tx.journalEntry.findFirst({
                where: {
                    companyId,
                    type: 'JOURNAL',
                    reference: cleanBatchNo
                }
            }) || await tx.journalEntry.findFirst({
                where: {
                    companyId,
                    type: 'JOURNAL',
                    narration: { contains: cleanBatchNo }
                }
            });

            if (oldJe) {
                await tx.journalLine.deleteMany({ where: { entryId: oldJe.id } });
                await tx.journalEntry.delete({ where: { id: oldJe.id } });
            }

            try {
                const accModel = (tx as any).productionAccrual;
                if (accModel?.deleteMany) {
                    await accModel.deleteMany({ where: { productionId: existingRecord.id, status: 'PENDING' } });
                } else {
                    await tx.$executeRaw`DELETE FROM "ProductionAccrual" WHERE "productionId" = ${existingRecord.id} AND "status" = 'PENDING'`;
                }
            } catch (e) {
                console.warn("Could not delete ProductionAccruals on update:", e);
            }

            await tx.productionOverhead.deleteMany({ where: { productionId: existingRecord.id } });
            await tx.productionInput.deleteMany({ where: { productionId: existingRecord.id } });

            // 2. CALCULATE NEW COSTS
            let rawMaterialCost = 0;
            const inputRecords = [];
            const accrualRecordsToCreate: any[] = [];

            for (const input of (inputs || [])) {
                const qty = Number(input.quantity);
                const rate = Number(input.costRate);
                const costValue = qty * rate;
                rawMaterialCost += costValue;

                let inputStageValue = input.stage;
                if (!inputStageValue) {
                    if (processStage === 'GREY') inputStageValue = 'RAW';
                    else if (processStage === 'FINISH') inputStageValue = 'GREY';
                }

                let effectiveProductId = input.productId;
                const isExplicitYarn = Boolean(input.productId);

                if (!effectiveProductId) {
                    const defaultYarn = await tx.product.findFirst({
                        where: {
                            companyId,
                            isManufactured: false,
                            isService: false,
                            OR: [
                                { name: { contains: 'YARN', mode: 'insensitive' } },
                                { code: { contains: 'YARN', mode: 'insensitive' } }
                            ]
                        }
                    }) || await tx.product.findFirst({ where: { companyId, isManufactured: false, isService: false } })
                       || await tx.product.findFirst({ where: { companyId } });
                    effectiveProductId = defaultYarn?.id;
                }

                inputRecords.push({
                    productId: effectiveProductId,
                    quantity: qty,
                    costValue: costValue,
                    lotNumber: input.lotNumber || (input.isAccrual ? 'ACCRUAL-UNBILLED' : null),
                    inputStage: inputStageValue
                });

                if (input.isAccrual || input.mode === 'ACCRUAL') {
                    let yarnProd = null;
                    if (isExplicitYarn && effectiveProductId) {
                        yarnProd = await tx.product.findUnique({
                            where: { id: effectiveProductId },
                            include: { Category: true, Unit: true }
                        });
                    }
                    const yarnName = isExplicitYarn ? (yarnProd?.name || "Raw Yarn") : "Raw Yarn (Unspecified / Settle Later)";

                    const existingCount = accrualRecordsToCreate.length;
                    const prefix = `PAC-${new Date().getFullYear()}-`;
                    let lastAccrualNo: string | null = null;
                    try {
                        const rawLast = await tx.$queryRaw<Array<{ accrualNo: string }>>`
                            SELECT "accrualNo" FROM "ProductionAccrual"
                            WHERE "companyId" = ${companyId} AND "accrualNo" LIKE ${prefix + '%'}
                            ORDER BY "accrualNo" DESC LIMIT 1
                        `;
                        if (rawLast && rawLast.length > 0) lastAccrualNo = rawLast[0].accrualNo;
                    } catch {}

                    let nextSeq = 1;
                    if (lastAccrualNo) {
                        const parts = lastAccrualNo.split('-');
                        const lastNum = parseInt(parts[parts.length - 1]);
                        if (!isNaN(lastNum)) nextSeq = lastNum + 1;
                    }
                    const accrualNo = `${prefix}${(nextSeq + existingCount).toString().padStart(4, '0')}`;

                    let validSupplierId: string | null = null;
                    if (input.supplierId) {
                        const s = await tx.supplier.findFirst({ where: { id: input.supplierId, companyId } });
                        if (s) {
                            validSupplierId = s.id;
                        } else {
                            const acc = await tx.account.findFirst({ where: { id: input.supplierId, companyId } });
                            if (acc) {
                                let linkedSup = await tx.supplier.findFirst({ where: { payableAccountId: acc.id, companyId } });
                                if (!linkedSup) {
                                    try {
                                        const defCurr = await tx.currency.findFirst({ where: { companyId } }) || await tx.currency.findFirst();
                                        linkedSup = await tx.supplier.create({
                                            data: {
                                                companyId,
                                                code: `SUP-${acc.code}`,
                                                name: acc.name,
                                                payableAccountId: acc.id,
                                                currencyCode: defCurr?.id || 'PKR'
                                            }
                                        });
                                    } catch (e) {}
                                }
                                if (linkedSup) validSupplierId = linkedSup.id;
                            }
                        }
                    }

                    let validUnitId: string | null = null;
                    if (input.unitId) {
                        const u = await tx.unit.findFirst({ where: { id: input.unitId } });
                        if (u) validUnitId = u.id;
                    }
                    if (!validUnitId && yarnProd?.baseUnitId) {
                        validUnitId = yarnProd.baseUnitId;
                    }

                    const billRefPrefix = input.billRef ? `[BILL_REF: ${input.billRef}]${input.billDate ? ` [BILL_DATE: ${input.billDate}]` : ''} ` : '';

                    accrualRecordsToCreate.push({
                        companyId,
                        accrualNo,
                        productId: effectiveProductId,
                        supplierId: validSupplierId,
                        unitId: validUnitId,
                        date: new Date(date),
                        stage: 'RAW',
                        serviceType: 'RAW_YARN',
                        qty: qty,
                        rate: rate,
                        amount: costValue,
                        billedQty: 0,
                        status: 'PENDING',
                        remarks: isExplicitYarn 
                            ? `${billRefPrefix}${input.remarks || `Accrued Unbilled Yarn [${yarnName}] for Production Batch`}`
                            : `[UNSPECIFIED_YARN] ${billRefPrefix}${input.remarks || 'Accrued Unbilled Raw Yarn (Physical lot will be selected upon stock or invoice settlement)'}`
                    });
                }
            }

            let serviceCost = 0;
            let inHouseServiceCost = 0;
            const overheadRecords = [];
            const outHouseServiceInvoiceIds = [];

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

                        const existingCount = accrualRecordsToCreate.length;
                        const prefix = `PAC-${new Date().getFullYear()}-`;
                        let lastAccrualNo: string | null = null;
                        try {
                            const rawLast = await tx.$queryRaw<Array<{ accrualNo: string }>>`
                                SELECT "accrualNo" FROM "ProductionAccrual"
                                WHERE "companyId" = ${companyId} AND "accrualNo" LIKE ${prefix + '%'}
                                ORDER BY "accrualNo" DESC LIMIT 1
                            `;
                            if (rawLast && rawLast.length > 0) lastAccrualNo = rawLast[0].accrualNo;
                        } catch {}

                        let nextSeq = 1;
                        if (lastAccrualNo) {
                            const parts = lastAccrualNo.split('-');
                            const lastNum = parseInt(parts[parts.length - 1]);
                            if (!isNaN(lastNum)) nextSeq = lastNum + 1;
                        }
                        const accrualNo = `${prefix}${(nextSeq + existingCount).toString().padStart(4, '0')}`;

                        let creditAccount = null;
                        const accruedAcc = await tx.account.findFirst({
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
                        creditAccount = accruedAcc?.id;
                        if (!creditAccount) {
                            const anyLiability = await tx.account.findFirst({ where: { companyId, type: 'LIABILITY', isPosting: true } });
                            creditAccount = anyLiability?.id;
                        }
                        if (!creditAccount) {
                            const anyAcc = await tx.account.findFirst({ where: { companyId } });
                            creditAccount = anyAcc?.id;
                        }

                        let validSupplierId: string | null = null;
                        if (ov.supplierId) {
                            const s = await tx.supplier.findFirst({ where: { id: ov.supplierId, companyId } });
                            if (s) {
                                validSupplierId = s.id;
                            } else {
                                const acc = await tx.account.findFirst({ where: { id: ov.supplierId, companyId } });
                                if (acc) {
                                    let linkedSup = await tx.supplier.findFirst({ where: { payableAccountId: acc.id, companyId } });
                                    if (!linkedSup) {
                                        try {
                                            const defCurr = await tx.currency.findFirst({ where: { companyId } }) || await tx.currency.findFirst();
                                            linkedSup = await tx.supplier.create({
                                                data: {
                                                    companyId,
                                                    code: `SUP-${acc.code}`,
                                                    name: acc.name,
                                                    payableAccountId: acc.id,
                                                    currencyCode: defCurr?.id || 'PKR'
                                                }
                                            });
                                        } catch (e) {}
                                    }
                                    if (linkedSup) validSupplierId = linkedSup.id;
                                }
                            }
                        }

                        let validUnitId: string | null = null;
                        if (ov.unitId) {
                            const u = await tx.unit.findFirst({ where: { id: ov.unitId } });
                            if (u) validUnitId = u.id;
                        }
                        if (!validUnitId && prod?.baseUnitId) {
                            validUnitId = prod.baseUnitId;
                        }

                        const determinedStage = ov.stage || (ov.serviceType === 'WEAVING' || ov.serviceType === 'KNITTING' ? 'GREY' : processStage);
                        const determinedServiceType = ov.serviceType || (prodName.toUpperCase().includes('DYE') ? 'DYEING' : prodName.toUpperCase().includes('PRINT') ? 'PRINTING' : (prodName.toUpperCase().includes('WEAV') ? 'WEAVING' : (prodName.toUpperCase().includes('KNIT') ? 'KNITTING' : 'DYEING')));

                        const billRefPrefix = ov.billRef ? `[BILL_REF: ${ov.billRef}]${ov.billDate ? ` [BILL_DATE: ${ov.billDate}]` : ''} ` : '';

                        accrualRecordsToCreate.push({
                            companyId,
                            accrualNo,
                            productId: ov.productId || (await tx.product.findFirst({ where: { companyId } }))?.id,
                            supplierId: validSupplierId,
                            unitId: validUnitId,
                            date: new Date(date),
                            stage: determinedStage,
                            serviceType: determinedServiceType,
                            qty: consumeQty,
                            rate: rate,
                            amount: ovAmount,
                            billedQty: 0,
                            status: 'PENDING',
                            remarks: `${billRefPrefix}${ov.remarks || `Accrued Service for Production Batch`}`
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
                        const piItem = await tx.purchaseInvoiceItem.findUnique({
                            where: { id: ov.purchaseInvoiceItemId },
                            include: { PurchaseInvoice: true, Product: { include: { Category: true } } }
                        });
                        if (!piItem) throw new Error("Service Invoice Item not found");

                        const consumeQty = Number(ov.quantity);
                        const remaining = Number(piItem.qty) - Number(piItem.consumedQty);
                        if (consumeQty > remaining) throw new Error(`Cannot consume ${consumeQty} of service ${piItem.Product?.name}. Only ${remaining} left.`);

                        const ovAmount = consumeQty * Number(piItem.rate);
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
            const isOutputEFS = (inputs || []).some((input: any) => input.isEFS === true);

            const { cutSize, cutSizeUnit, pieceWeightKg, outputUom, outputNetWeightKg } = body;
            const specNotes: string[] = [];
            if (outputUom) specNotes.push(`${outputQuantity} ${outputUom}`);
            if (cutSize) specNotes.push(`Cut: ${cutSize} ${cutSizeUnit || 'MTR'}/PC`);
            if (pieceWeightKg) specNotes.push(`Unit: ${pieceWeightKg} KG/PC`);
            if (outputNetWeightKg) specNotes.push(`Net: ${outputNetWeightKg} KG`);
            const specSummary = specNotes.length > 0 ? ` [${specNotes.join(' | ')}]` : '';

            const batchNo = cleanBatchNo;
            const jvNo = `JV-${batchNo}`;

            // 3. UPDATE PRODUCTION RECORD
            const updated = await tx.productionRecord.update({
                where: { id: existingRecord.id },
                data: {
                    date: new Date(date),
                    outputProductId,
                    outputQuantity: Number(outputQuantity),
                    warehouseId: finalWarehouseId,
                    outputStage: processStage,
                    totalCost: totalOutputCost,
                    ProductionInput: { create: inputRecords },
                    ProductionOverhead: { create: overheadRecords }
                }
            });

            // 4. CREATE ACCRUALS
            for (const acc of accrualRecordsToCreate) {
                let saved = false;
                try {
                    const accrualCreator = (tx as any).productionAccrual;
                    if (accrualCreator?.create) {
                        await accrualCreator.create({
                            data: { ...acc, productionId: existingRecord.id }
                        });
                        saved = true;
                    }
                } catch (prismaErr) {}

                if (!saved) {
                    try {
                        const newAccId = 'pa-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
                        await tx.$executeRaw`
                            INSERT INTO "ProductionAccrual" (
                                "id", "accrualNo", "companyId", "productionId", "productId", "supplierId", "unitId",
                                "date", "stage", "serviceType", "qty", "rate", "amount", "billedQty", "status", "remarks", "updatedAt"
                            ) VALUES (
                                ${newAccId}, ${acc.accrualNo}, ${acc.companyId}, ${existingRecord.id}, ${acc.productId}, ${acc.supplierId}, ${acc.unitId},
                                ${acc.date}, ${acc.stage}::"ProductionStage", ${acc.serviceType}, ${acc.qty}, ${acc.rate}, ${acc.amount},
                                ${acc.billedQty}, ${acc.status}, ${acc.remarks}, NOW()
                            )
                        `;
                    } catch (rawSqlErr: any) {}
                }
            }

            // 5. RE-CREATE STOCK LEDGERS
            const outputCostRate = totalOutputCost / Number(outputQuantity);
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
                    refId: existingRecord.id,
                    stage: processStage,
                    isEFS: isOutputEFS,
                    batchNo: `${batchNo}${specSummary}`
                }
            });

            for (const input of (inputs || [])) {
                if (input.isAccrual || input.mode === "ACCRUAL") continue;

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
                        refId: existingRecord.id,
                        stage: inputStageValue || null,
                        isEFS: input.isEFS || false,
                        batchNo
                    }
                });
            }

            // 6. RE-CREATE JOURNAL ENTRY
            const outputProduct = await tx.product.findUnique({ where: { id: outputProductId }, include: { Category: true } });
            let debitAccount = outputProduct?.inventoryAccountId || outputProduct?.Category?.wipAccountId;
            if (!debitAccount) {
                const defInv = await tx.account.findFirst({
                    where: { companyId, name: { contains: 'Inventory', mode: 'insensitive' }, type: 'ASSET' }
                });
                debitAccount = defInv?.id;
            }

            const lines = [];
            lines.push({
                accountId: debitAccount,
                debit: totalOutputCost,
                credit: 0,
                narration: `Produced ${outputQuantity} of ${outputProduct?.name} [Batch ${batchNo}${specSummary}]`
            });

            for (const input of (inputs || [])) {
                const inputCost = Number(input.quantity) * Number(input.costRate);
                if (input.isAccrual || input.mode === "ACCRUAL") {
                    let creditAcc = null;
                    const accruedAcc = await tx.account.findFirst({
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
                    creditAcc = accruedAcc?.id;
                    if (!creditAcc) {
                        const anyLiability = await tx.account.findFirst({ where: { companyId, type: 'LIABILITY', isPosting: true } });
                        creditAcc = anyLiability?.id;
                    }
                    if (creditAcc) {
                        const inProduct = input.productId ? await tx.product.findUnique({ where: { id: input.productId } }) : null;
                        const existing = lines.find(l => l.accountId === creditAcc && l.debit === 0);
                        if (existing) {
                            existing.credit += inputCost;
                        } else {
                            lines.push({
                                accountId: creditAcc,
                                debit: 0,
                                credit: inputCost,
                                narration: `Accrued Unbilled Yarn: ${inProduct?.name || 'Raw Yarn'} (${input.quantity} KG @ Rs. ${input.costRate}) for Batch ${batchNo}`
                            });
                        }
                    }
                } else {
                    const inProduct = await tx.product.findUnique({ where: { id: input.productId }, include: { Category: true } });
                    let creditAcc = inProduct?.inventoryAccountId || inProduct?.Category?.wipAccountId;
                    if (!creditAcc) {
                        const defInv = await tx.account.findFirst({
                            where: { companyId, name: { contains: 'Inventory', mode: 'insensitive' }, type: 'ASSET' }
                        });
                        creditAcc = defInv?.id;
                    }
                    if (creditAcc) {
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
                }
            }

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

            if (inHouseServiceCost > 0) {
                let fohAccount = await tx.account.findFirst({
                    where: { companyId, name: { contains: 'Factory Overhead', mode: 'insensitive' }, isPosting: true }
                });
                if (!fohAccount) {
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
                    narration: `Production Batch ${batchNo} updated${specSummary}`,
                    lines: { create: lines }
                }
            });

            return updated;
        }, {
            maxWait: 10000,
            timeout: 30000
        });

        return NextResponse.json({ success: true, data: result });
    } catch (e: any) {
        console.error("[PRODUCTION_EXECUTION_PUT_ERROR]:", e);
        return NextResponse.json({ success: false, error: e.message || "Failed to update production batch" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const { id } = await params;

        const record = await prisma.productionRecord.findFirst({
            where: { id, companyId },
            include: { ProductionOverhead: true }
        });

        if (!record) {
            return NextResponse.json({ success: false, error: "Record not found" }, { status: 404 });
        }

        await prisma.$transaction(async (tx) => {
            // 1. Revert consumed quantities for purchase invoices (Out-house services)
            for (const overhead of record.ProductionOverhead) {
                if (overhead.purchaseInvoiceItemId && overhead.quantity) {
                    await tx.purchaseInvoiceItem.update({
                        where: { id: overhead.purchaseInvoiceItemId },
                        data: { consumedQty: { decrement: overhead.quantity } }
                    });
                }
            }

            // 2. Delete Stock Ledgers associated with this production
            await tx.stockLedger.deleteMany({
                where: { refType: 'PRODUCTION', refId: record.id }
            });

            // 3. Find and Delete Journal Entries
            // Find journal entry created around the same time with matching narration pattern
            const je = await tx.journalEntry.findFirst({
                where: {
                    companyId,
                    type: 'JOURNAL',
                    narration: { startsWith: 'Production Batch BATCH-' },
                    createdAt: {
                        gte: new Date(record.createdAt.getTime() - 60000),
                        lte: new Date(record.createdAt.getTime() + 60000)
                    }
                }
            });

            if (je) {
                await tx.journalLine.deleteMany({ where: { entryId: je.id } });
                await tx.journalEntry.delete({ where: { id: je.id } });
            }

            // 4. Delete associated pending ProductionAccruals
            try {
                const accModel = (tx as any).productionAccrual;
                if (accModel?.deleteMany) {
                    await accModel.deleteMany({ where: { productionId: record.id, status: 'PENDING' } });
                } else {
                    await tx.$executeRaw`DELETE FROM "ProductionAccrual" WHERE "productionId" = ${record.id} AND "status" = 'PENDING'`;
                }
            } catch (e) {
                console.warn("Could not delete ProductionAccruals on production record delete:", e);
            }

            // 5. Explicitly delete inputs and overheads to avoid foreign key constraint errors
            await tx.productionOverhead.deleteMany({ where: { productionId: record.id } });
            await tx.productionInput.deleteMany({ where: { productionId: record.id } });
            await tx.productionRecord.delete({ where: { id: record.id } });
        }, {
            maxWait: 10000,
            timeout: 30000
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("DELETE Production Error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
