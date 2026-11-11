import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        // Fetch products (non-service for inputs/outputs)
        const rawProducts = await prisma.product.findMany({
            where: { companyId, isService: false },
            include: {
                Unit: true,
                Category: true
            }
        });

        const products = rawProducts.map(p => ({
            id: p.id,
            name: p.name,
            code: p.code,
            hsCode: p.hsCode,
            isManufactured: p.isManufactured,
            stage: p.stage,
            baseUnit: p.Unit ? { code: p.Unit.code } : null,
            category: p.Category ? { name: p.Category.name } : null
        }));

        // Fetch warehouses
        const warehouses = await prisma.warehouse.findMany({
            where: { companyId, deletedAt: null }
        });

        // Fetch units
        const units = await prisma.unit.findMany({
            where: { companyId, deletedAt: null }
        });

        // Fetch unconsumed services (where consumedQty < qty and product is a service)
        const rawServices = await prisma.purchaseInvoiceItem.findMany({
            where: {
                PurchaseInvoice: { companyId },
                Product: { isService: true }
            },
            include: {
                PurchaseInvoice: { select: { invoiceNo: true, date: true, Supplier: { select: { name: true } } } },
                Product: { include: { Category: { select: { name: true } }, Unit: { select: { code: true } } } },
                Unit: { select: { code: true } }
            }
        });

        // Filter out consumed ones
        const unconsumedServices = rawServices.filter(item => Number(item.qty) > Number(item.consumedQty)).map(item => {
            const unconsumedQty = Number(item.qty) - Number(item.consumedQty);
            const rate = Number(item.rate);
            const exAmount = unconsumedQty * rate;
            const proratedTax = Number(item.qty) > 0 ? (Number(item.taxAmount) / Number(item.qty)) * unconsumedQty : 0;
            const inclAmount = exAmount; // Use exclusive amount to avoid double counting tax in production cost
            
            return {
                id: item.id,
                date: item.PurchaseInvoice.date,
                invoiceNo: item.PurchaseInvoice.invoiceNo,
                supplierName: item.PurchaseInvoice.Supplier?.name || '-',
                productName: item.Product.name,
                categoryName: item.Product.Category?.name || '',
                unconsumedQty,
                totalQty: Number(item.qty),
                consumedQty: Number(item.consumedQty),
                rate: rate,
                unit: item.Unit?.code || item.Product.Unit?.code || '-',
                inclAmount
            };
        });

        // Current Stock Balances and Rates to auto-fill input rates
        const rawLedgers = await prisma.stockLedger.findMany({
            where: { companyId },
            select: { productId: true, qtyIn: true, qtyOut: true, costRate: true, stage: true, isEFS: true, batchNo: true }
        });

        const stockRates: Record<string, { qty: number, rate: number, isEFS: boolean }> = {};
        for (const l of rawLedgers) {
            const isEFS = Boolean(l.isEFS || (l.batchNo && l.batchNo.includes('[EFS]')));
            const key = `${l.productId}-${l.stage || 'RAW'}-${isEFS ? 'EFS' : 'STD'}`;
            if (!stockRates[key]) {
                stockRates[key] = { qty: 0, rate: 0, isEFS };
            }
            const s = stockRates[key];
            
            const qIn = Number(l.qtyIn);
            const qOut = Number(l.qtyOut);
            
            if (qIn > 0) {
                // Moving average cost calculation
                const prevTotal = s.qty * s.rate;
                const newTotal = qIn * Number(l.costRate);
                s.qty += qIn;
                s.rate = s.qty > 0 ? (prevTotal + newTotal) / s.qty : 0;
            }
            if (qOut > 0) {
                s.qty -= qOut;
            }
        }

        // Fetch unconsumed PurchaseInvoiceItems as available lots
        const invoiceItems = await prisma.purchaseInvoiceItem.findMany({
            where: {
                PurchaseInvoice: { companyId },
                Product: { isManufactured: false }
            },
            include: {
                PurchaseInvoice: { select: { invoiceNo: true, date: true } }
            },
            orderBy: { PurchaseInvoice: { date: 'desc' } }
        });

        // Apply FIFO capping based on actual stock limits
        const availableLots: any[] = [];
        const itemsByProduct = invoiceItems.reduce((acc: any, item: any) => {
            if (!acc[item.productId]) acc[item.productId] = [];
            acc[item.productId].push(item);
            return acc;
        }, {});

        for (const [productId, items] of Object.entries(itemsByProduct)) {
            // Find current stock for this product (purchased items are usually RAW)
            // For now, matching standard non-EFS for available lots logic unless EFS is added later
            const stockKey = `${productId}-RAW-STD`;
            let remainingStock = stockRates[stockKey] ? stockRates[stockKey].qty : 0;
            
            for (const item of (items as any[])) {
                if (remainingStock <= 0) break;
                
                const unconsumedQty = Number(item.qty) - Number(item.consumedQty || 0);
                if (unconsumedQty <= 0) continue;
                
                const cappedQty = Math.min(unconsumedQty, remainingStock);
                
                if (cappedQty > 0) {
                    availableLots.push({
                        id: item.id,
                        productId: item.productId,
                        invoiceNo: item.PurchaseInvoice.invoiceNo,
                        date: item.PurchaseInvoice.date,
                        qty: cappedQty,
                        rate: Number(item.rate)
                    });
                    remainingStock -= cappedQty;
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: { products, warehouses, units, unconsumedServices, stockRates, availableLots }
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
