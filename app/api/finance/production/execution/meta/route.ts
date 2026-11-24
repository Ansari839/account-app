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
            where: {
                deletedAt: null,
                isService: false,
                OR: [
                    { companyId },
                    { companyId: 'default-company' }
                ]
            },
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
            isService: false,
            stage: p.stage,
            baseUnit: p.Unit ? { id: p.Unit.id, code: p.Unit.code } : null,
            category: p.Category ? { name: p.Category.name } : null
        }));

        // Fetch strictly service products (Dyeing, Printing, Weaving, Knitting, etc.)
        const rawServiceProducts = await prisma.product.findMany({
            where: {
                deletedAt: null,
                OR: [
                    { isService: true },
                    { Category: { isService: true } },
                    { Category: { name: { in: ['DYEING', 'PRINTING', 'WEAVING', 'KNITTING', 'SERVICES', 'PROCESSING'] } } }
                ],
                AND: [
                    {
                        OR: [
                            { companyId },
                            { companyId: 'default-company' }
                        ]
                    }
                ]
            },
            include: {
                Unit: true,
                Category: true
            },
            orderBy: { name: 'asc' }
        });

        const serviceProducts = rawServiceProducts.map(p => ({
            id: p.id,
            name: p.name,
            code: p.code,
            hsCode: p.hsCode,
            isService: true,
            stage: p.stage,
            baseUnit: p.Unit ? { id: p.Unit.id, code: p.Unit.code } : null,
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
                productId: item.productId,
                productName: item.Product.name,
                productCode: item.Product.code || '',
                hsCode: item.Product.hsCode || '',
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
                productId: op.productId,
                productName: op.Product.name,
                productCode: op.Product.code || '',
                hsCode: op.Product.hsCode || '',
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

        // Also fetch GRN services (services received in warehouse via GRN)
        try {
            let grnServices: any[] = [];
            try {
                grnServices = await (prisma.gRNItem as any).findMany({
                    where: {
                        grn: { companyId },
                        product: { isService: true }
                    },
                    include: {
                        grn: {
                            select: {
                                grnNo: true,
                                date: true,
                                supplier: { select: { name: true } }
                            }
                        },
                        product: {
                            include: {
                                Category: { select: { name: true } },
                                Unit: { select: { code: true } }
                            }
                        },
                        unit: { select: { code: true } }
                    }
                });
            } catch (err: any) {
                // Fallback for capitalized schema relations
                grnServices = await (prisma.gRNItem as any).findMany({
                    where: {
                        GRN: { companyId },
                        Product: { isService: true }
                    },
                    include: {
                        GRN: {
                            select: {
                                grnNo: true,
                                date: true,
                                supplier: { select: { name: true } }
                            }
                        },
                        Product: {
                            include: {
                                Category: { select: { name: true } },
                                Unit: { select: { code: true } }
                            }
                        },
                        Unit: { select: { code: true } }
                    }
                }).catch(() => []);
            }

            for (const rawGrn of grnServices) {
                const grnItem = {
                    ...rawGrn,
                    grn: rawGrn.grn || rawGrn.GRN,
                    product: rawGrn.product || rawGrn.Product,
                    unit: rawGrn.unit || rawGrn.Unit
                };
                const receivedQty = Number(grnItem.qtyReceived);
                if (receivedQty <= 0) continue;

                // Check already billed qty if linked to an invoice item
                const billedAgg = await prisma.purchaseInvoiceItem.aggregate({
                    where: { grnItemId: grnItem.id },
                    _sum: { qty: true }
                });
                const alreadyBilledQty = Number(billedAgg._sum.qty || 0);
                const unconsumedQty = Math.max(0, receivedQty - alreadyBilledQty);
                if (unconsumedQty <= 0) continue;

                const prodUpper = (grnItem.product?.name || "").toUpperCase();
                const catUpper = (grnItem.product?.Category?.name || "").toUpperCase();

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

                unconsumedServices.push({
                    id: `GRN-SVC-${grnItem.id}`,
                    date: grnItem.grn.date,
                    invoiceNo: `[GRN] ${grnItem.grn.grnNo}`,
                    supplierName: grnItem.grn.supplier?.name ? `[GRN] ${grnItem.grn.supplier.name}` : `[GRN Receipt]`,
                    productId: grnItem.productId,
                    productName: grnItem.product?.name,
                    productCode: grnItem.product?.code || '',
                    hsCode: grnItem.product?.hsCode || '',
                    categoryName: grnItem.product?.Category?.name || '',
                    serviceType,
                    unconsumedQty,
                    totalQty: receivedQty,
                    consumedQty: alreadyBilledQty,
                    rate: Number(grnItem.rate || 0),
                    unit: grnItem.unit?.code || grnItem.product?.Unit?.code || 'KG',
                    inclAmount: unconsumedQty * Number(grnItem.rate || 0),
                    isOpening: false,
                    isGRN: true
                });
            }
        } catch (e: any) {
            console.warn("Could not load GRN services into meta:", e.message);
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
                PurchaseInvoice: { 
                    select: { 
                        invoiceNo: true, 
                        date: true,
                        Supplier: { select: { name: true } }
                    } 
                },
                Product: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        hsCode: true,
                        stage: true,
                        isService: true,
                        Unit: { select: { code: true } }
                    }
                },
                Unit: { select: { code: true } }
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
                        productName: item.Product?.name || 'Raw Material',
                        productCode: item.Product?.code || '',
                        hsCode: item.Product?.hsCode || '',
                        unitName: item.Unit?.code || item.Product?.Unit?.code || 'KG',
                        stage: item.Product?.stage || 'RAW',
                        isService: item.Product?.isService || false,
                        supplierName: item.PurchaseInvoice?.Supplier?.name || 'Vendor',
                        invoiceNo: item.PurchaseInvoice.invoiceNo,
                        date: item.PurchaseInvoice.date ? new Date(item.PurchaseInvoice.date).toISOString().split('T')[0] : '',
                        qty: cappedQty,
                        rate: Number(item.rate),
                        isOpening: false,
                        isEFS: false,
                        origin: 'LOCAL'
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
                Product: { 
                    select: { 
                        id: true, 
                        name: true, 
                        code: true,
                        hsCode: true,
                        stage: true,
                        isService: true,
                        Unit: { select: { code: true } }
                    } 
                },
                Warehouse: { select: { name: true } }
            },
            orderBy: { date: 'asc' }
        });

        for (const op of openingStockRecords) {
            const isEFS = Boolean(op.isEFS || (op.batchNo && op.batchNo.includes('[EFS]')));
            const isImport = Boolean(isEFS || (op.batchNo && op.batchNo.includes('[IMPORT]')));
            const stockKey = `${op.productId}-${op.stage || 'RAW'}-${isEFS ? 'EFS' : 'STD'}`;
            const remainingStock = stockRates[stockKey] ? stockRates[stockKey].qty : 0;
            
            if (remainingStock > 0) {
                availableLots.push({
                    id: `OPENING-${op.id}`,
                    productId: op.productId,
                    productName: op.Product?.name || 'Raw Material',
                    productCode: op.Product?.code || '',
                    hsCode: op.Product?.hsCode || '',
                    unitName: op.Product?.Unit?.code || 'KG',
                    stage: op.stage || op.Product?.stage || 'RAW',
                    isService: op.Product?.isService || false,
                    supplierName: `Opening Lot (${op.Warehouse?.name || 'Warehouse'})`,
                    invoiceNo: op.batchNo ? `OPENING (${op.batchNo})` : `OPENING-STOCK`,
                    date: op.date ? new Date(op.date).toISOString().split('T')[0] : '',
                    qty: Math.min(Number(op.qtyIn), remainingStock),
                    rate: Number(op.costRate),
                    isOpening: true,
                    isEFS,
                    origin: isImport ? 'IMPORT' : 'LOCAL'
                });
            }
        }

        // Fetch GRN lots for raw materials (received via GRN)
        try {
            let grnRawItems: any[] = [];
            try {
                grnRawItems = await (prisma.gRNItem as any).findMany({
                    where: {
                        grn: { companyId },
                        product: { isManufactured: false, isService: false }
                    },
                    include: {
                        grn: {
                            select: {
                                grnNo: true,
                                date: true,
                                supplier: { select: { name: true } }
                            }
                        },
                        product: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                hsCode: true,
                                stage: true,
                                isService: true,
                                Unit: { select: { code: true } }
                            }
                        },
                        unit: { select: { code: true } }
                    }
                });
            } catch (err: any) {
                // Fallback for capitalized schema relations
                grnRawItems = await (prisma.gRNItem as any).findMany({
                    where: {
                        GRN: { companyId },
                        Product: { isManufactured: false, isService: false }
                    },
                    include: {
                        GRN: {
                            select: {
                                grnNo: true,
                                date: true,
                                supplier: { select: { name: true } }
                            }
                        },
                        Product: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                hsCode: true,
                                stage: true,
                                isService: true,
                                Unit: { select: { code: true } }
                            }
                        },
                        Unit: { select: { code: true } }
                    }
                }).catch(() => []);
            }

            for (const rawItem of grnRawItems) {
                const grnItem = {
                    ...rawItem,
                    grn: rawItem.grn || rawItem.GRN,
                    product: rawItem.product || rawItem.Product,
                    unit: rawItem.unit || rawItem.Unit
                };
                const stockKey = `${grnItem.productId}-${grnItem.product?.stage || 'RAW'}-STD`;
                const remainingStock = stockRates[stockKey] ? stockRates[stockKey].qty : 0;
                const receivedQty = Number(grnItem.qtyReceived);

                if (remainingStock > 0 && receivedQty > 0) {
                    const avail = Math.min(receivedQty, remainingStock);
                    availableLots.push({
                        id: `GRN-${grnItem.id}`,
                        productId: grnItem.productId,
                        productName: grnItem.product?.name || 'Raw Material',
                        productCode: grnItem.product?.code || '',
                        hsCode: grnItem.product?.hsCode || '',
                        unitName: grnItem.unit?.code || grnItem.product?.Unit?.code || 'KG',
                        stage: grnItem.product?.stage || 'RAW',
                        isService: false,
                        supplierName: grnItem.grn.supplier?.name ? `[GRN] ${grnItem.grn.supplier.name}` : `[GRN Receipt]`,
                        invoiceNo: `GRN: ${grnItem.grn.grnNo}`,
                        date: grnItem.grn.date ? new Date(grnItem.grn.date).toISOString().split('T')[0] : '',
                        qty: avail,
                        rate: Number(grnItem.rate || 0),
                        isOpening: false,
                        isGRN: true,
                        isEFS: false,
                        origin: 'LOCAL'
                    });
                }
            }
        } catch (e: any) {
            console.warn("Could not load GRN raw lots into meta:", e.message);
        }

        // Fetch Suppliers for optional vendor linking on accruals
        const suppliers = await prisma.supplier.findMany({
            where: { companyId, deletedAt: null },
            select: { id: true, name: true, code: true, payableAccountId: true },
            orderBy: { name: 'asc' }
        });

        // Fetch Accounts from Chart of Accounts (posting accounts)
        const accounts = await prisma.account.findMany({
            where: {
                companyId,
                deletedAt: null,
                isPosting: true
            },
            select: {
                id: true,
                code: true,
                name: true,
                type: true
            },
            orderBy: { code: 'asc' }
        });

        return NextResponse.json({
            success: true,
            data: { products, serviceProducts, warehouses, units, unconsumedServices, stockRates, availableLots, suppliers, accounts }
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
