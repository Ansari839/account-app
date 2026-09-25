import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        const { id } = await params;
        const record = await prisma.productionRecord.findFirst({
            where: { id, companyId },
            include: {
                outputProduct: { include: { category: true, baseUnit: true } },
                warehouse: true,
                inputs: { include: { product: { include: { baseUnit: true } } } },
                overheads: { include: { unit: true, purchaseInvoiceItem: { include: { product: true } } } }
            }
        });

        if (!record) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

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
                    inputs: { include: { product: { include: { baseUnit: true } } } },
                    overheads: { include: { unit: true, purchaseInvoiceItem: { include: { product: { include: { baseUnit: true } } } } } }
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

                latestProd.inputs.forEach((inp: any) => {
                    hierarchy.materials.push({
                        name: inp.product.name,
                        stage: inp.inputStage || 'RAW',
                        quantity: Number(inp.quantity) * qtyRatio,
                        unit: inp.product.baseUnit?.code || '-',
                        cost: Number(inp.costValue) * costRatio
                    });
                });

                latestProd.overheads.forEach((ov: any) => {
                    hierarchy.services.push({
                        name: ov.description,
                        quantity: Number(ov.quantity) * qtyRatio,
                        unit: ov.unit?.code || ov.purchaseInvoiceItem?.product?.baseUnit?.code || '-',
                        cost: Number(ov.amount) * costRatio
                    });
                });

                (input as any).hierarchy = hierarchy;
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
            include: { overheads: true }
        });

        if (!record) {
            return NextResponse.json({ success: false, error: "Record not found" }, { status: 404 });
        }

        await prisma.$transaction(async (tx) => {
            // 1. Revert consumed quantities for purchase invoices (Out-house services)
            for (const overhead of record.overheads) {
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
