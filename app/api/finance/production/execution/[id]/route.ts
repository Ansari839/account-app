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

            // 4. Explicitly delete inputs and overheads to avoid foreign key constraint errors
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
