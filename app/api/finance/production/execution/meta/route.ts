import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthUtils } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(req);
        if (error) return error;

        // Fetch products (non-service for inputs/outputs)
        const products = await prisma.product.findMany({
            where: { companyId, isService: false },
            select: {
                id: true,
                name: true,
                code: true,
                isManufactured: true,
                stage: true,
                baseUnit: { select: { code: true } },
                category: { select: { name: true } }
            }
        });

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
                invoice: { companyId },
                product: { isService: true }
            },
            include: {
                invoice: { select: { invoiceNo: true, date: true, supplier: { select: { name: true } } } },
                product: { select: { name: true, category: { select: { name: true } }, baseUnit: { select: { code: true } } } },
                unit: { select: { code: true } }
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
                date: item.invoice.date,
                invoiceNo: item.invoice.invoiceNo,
                supplierName: item.invoice.supplier.name,
                productName: item.product.name,
                categoryName: item.product.category?.name || '',
                unconsumedQty,
                totalQty: Number(item.qty),
                consumedQty: Number(item.consumedQty),
                rate: rate,
                unit: item.unit?.code || item.product.baseUnit?.code || '-',
                inclAmount
            };
        });

        // Current Stock Balances and Rates to auto-fill input rates
        const rawLedgers = await prisma.stockLedger.findMany({
            where: { companyId },
            select: { productId: true, qtyIn: true, qtyOut: true, costRate: true, stage: true }
        });

        const stockRates: Record<string, { qty: number, rate: number }> = {};
        for (const l of rawLedgers) {
            const key = `${l.productId}-${l.stage || 'RAW'}`;
            if (!stockRates[key]) {
                stockRates[key] = { qty: 0, rate: 0 };
            }
            const s = stockRates[key];
            
            const qIn = Number(l.qtyIn);
            const qOut = Number(l.qtyOut);
            
            if (qIn > 0) {
                // Moving average cost calculation
                const prevTotal = s.qty * s.rate;
                const newTotal = qIn * Number(l.costRate);
                s.qty += qIn;
                s.rate = (prevTotal + newTotal) / s.qty;
            }
            if (qOut > 0) {
                s.qty -= qOut;
            }
        }

        // Fetch unconsumed PurchaseInvoiceItems as available lots
        const invoiceItems = await prisma.purchaseInvoiceItem.findMany({
            where: {
                invoice: { companyId },
                product: { isManufactured: false }
            },
            include: {
                invoice: { select: { invoiceNo: true, date: true } }
            },
            orderBy: { invoice: { date: 'desc' } }
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
            const stockKey = `${productId}-RAW`;
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
                        invoiceNo: item.invoice.invoiceNo,
                        date: item.invoice.date,
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
