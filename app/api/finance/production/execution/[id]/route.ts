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
        record.accruals = accruals;

        return NextResponse.json({ success: true, data: record });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
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
