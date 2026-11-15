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

        // Filter out consumed ones and categorize service type
        const unconsumedServices = rawServices.filter(item => Number(item.qty) > Number(item.consumedQty)).map(item => {
            const unconsumedQty = Number(item.qty) - Number(item.consumedQty);
            const rate = Number(item.rate);
            const exAmount = unconsumedQty * rate;
            const proratedTax = Number(item.qty) > 0 ? (Number(item.taxAmount) / Number(item.qty)) * unconsumedQty : 0;
            const inclAmount = exAmount; // Use exclusive amount to avoid double counting tax in production cost
            
            const prodUpper = (item.Product.name || "").toUpperCase();
            const catUpper = (item.Product.Category?.name || "").toUpperCase();

            let serviceType: "DYEING" | "PRINTING" | "WEAVING" | "KNITTING" | "OTHER" = "OTHER";
            if (catUpper.includes("DYE") || prodUpper.includes("DYE")) {
                serviceType = "DYEING";
            } else if (catUpper.includes("PRINT") || prodUpper.includes("PRINT")) {
                serviceType = "PRINTING";
            } else if (catUpper.includes("WEAV") || prodUpper.includes("WEAV")) {
                serviceType = "WEAVING";
            } else if (catUpper.includes("KNIT") || prodUpper.includes("KNIT")) {
                serviceType = "KNITTING";
            }

            return {
                id: item.id,
                date: item.PurchaseInvoice.date,
                invoiceNo: item.PurchaseInvoice.invoiceNo,
                supplierName: item.PurchaseInvoice.Supplier?.name || '-',
                productName: item.Product.name,
                categoryName: item.Product.Category?.name || '',
                serviceType,
                unconsumedQty,
                totalQty: Number(item.qty),
                consumedQty: Number(item.consumedQty),
                rate: rate,
                unit: item.Unit?.code || item.Product.Unit?.code || '-',
                inclAmount,
                isOpening: false
            };
        });

        // Also fetch Opening Services from StockLedger (refType: 'OPENING_STOCK' on Product where isService: true)
        const openingServices = await prisma.stockLedger.findMany({
            where: {
                companyId,
                refType: 'OPENING_STOCK',
                Product: { isService: true }
            },
            include: {
                Product: {
                    include: {
                        Category: { select: { name: true } },
                        Unit: { select: { code: true } }
                    }
                }
            }
        });

        for (const op of openingServices) {
            const unconsumedQty = Number(op.qtyIn) - Number(op.qtyOut);
            if (unconsumedQty <= 0) continue;

            const prodUpper = (op.Product.name || "").toUpperCase();
            const catUpper = (op.Product.Category?.name || "").toUpperCase();

            let serviceType: "DYEING" | "PRINTING" | "WEAVING" | "KNITTING" | "OTHER" = "OTHER";
            if (catUpper.includes("DYE") || prodUpper.includes("DYE")) {
                serviceType = "DYEING";
            } else if (catUpper.includes("PRINT") || prodUpper.includes("PRINT")) {
                serviceType = "PRINTING";
            } else if (catUpper.includes("WEAV") || prodUpper.includes("WEAV")) {
                serviceType = "WEAVING";
            } else if (catUpper.includes("KNIT") || prodUpper.includes("KNIT")) {
                serviceType = "KNITTING";
            }

            const infoText = op.batchNo ? op.batchNo : 'Opening Balance';

            unconsumedServices.push({
                id: `OPENING-SVC-${op.id}`,
                date: op.date,
                invoiceNo: op.batchNo ? op.batchNo : 'OPENING-BALANCE',
                supplierName: `[Opening] ${infoText}`,
                productName: op.Product.name,
                categoryName: op.Product.Category?.name || '',
                serviceType,
                unconsumedQty,
                totalQty: Number(op.qtyIn),
                consumedQty: Number(op.qtyOut),
                rate: Number(op.costRate),
                unit: op.Product.Unit?.code || 'KG',
                inclAmount: unconsumedQty * Number(op.costRate),
                isOpening: true
            });
        }

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
                        rate: Number(item.rate),
                        isOpening: false,
                        isEFS: false
                    });
                    remainingStock -= cappedQty;
                }
            }
        }

        // Fetch Opening Stock lots from StockLedger for raw materials & grey fabrics
        const openingStockRecords = await prisma.stockLedger.findMany({
            where: {
                companyId,
                refType: 'OPENING_STOCK',
                Product: { isManufactured: false }
            },
            include: {
                Product: { select: { id: true, name: true, code: true } }
            },
            orderBy: { date: 'asc' }
        });

        for (const op of openingStockRecords) {
            const isEFS = Boolean(op.isEFS || (op.batchNo && op.batchNo.includes('[EFS]')));
            const stockKey = `${op.productId}-${op.stage || 'RAW'}-${isEFS ? 'EFS' : 'STD'}`;
            const remainingStock = stockRates[stockKey] ? stockRates[stockKey].qty : 0;
            
            if (remainingStock > 0) {
                // Check if already in availableLots or add opening stock lot
                availableLots.push({
                    id: `OPENING-${op.id}`,
                    productId: op.productId,
                    invoiceNo: op.batchNo ? `OPENING (${op.batchNo})` : `OPENING-STOCK`,
                    date: op.date,
                    qty: Math.min(Number(op.qtyIn), remainingStock),
                    rate: Number(op.costRate),
                    isOpening: true,
                    isEFS
                });
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
