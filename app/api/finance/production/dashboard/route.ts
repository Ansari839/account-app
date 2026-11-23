import { NextRequest, NextResponse } from "next/server";
import { AuthUtils } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const { companyId, error } = AuthUtils.getCompanyId(request);
        if (error) return error;

        // Fetch all categories first
        const categories = await prisma.category.findMany({
            where: { companyId }
        });

        // Fetch all physical products (where their category is not a service)
        const rawProducts = await prisma.product.findMany({
            where: { 
                companyId, 
                OR: [
                    { categoryId: null },
                    { Category: { isService: false } }
                ]
            },
            include: { Category: true, Unit: true }
        });

        const products = rawProducts.map(p => ({
            ...p,
            category: p.Category,
            baseUnit: p.Unit
        }));

        // Fetch unconsumed service invoice items (where category is a service)
        const serviceItems = await prisma.purchaseInvoiceItem.findMany({
            where: {
                PurchaseInvoice: { companyId },
                Product: { Category: { isService: true } }
            },
            include: {
                PurchaseInvoice: { include: { Supplier: true } },
                Product: { include: { Category: true, Unit: true } },
                Unit: true
            }
        });
        
        const unconsumedServices = serviceItems.filter(item => Number(item.qty) > Number(item.consumedQty));

        // Fetch the latest ProductionRecord for each product to determine composition
        const latestProductions = await prisma.productionRecord.findMany({
            where: { companyId },
            orderBy: { date: 'desc' },
            include: {
                ProductionInput: {
                    include: { Product: { include: { Unit: true, Category: true } } }
                }
            }
        });
        
        const latestProdMap = new Map();
        latestProductions.forEach(prod => {
            const key = `${prod.outputProductId}-${prod.outputStage || 'RAW'}`;
            if (!latestProdMap.has(key)) {
                latestProdMap.set(key, prod);
            }
        });
        
        const productMap = new Map();
        products.forEach(p => productMap.set(p.id, p));

        const getYarnComposition = (productId: string, stage: string, targetQty: number, depth = 0): any[] => {
            if (depth > 10) return []; // safeguard
            
            // Try to find the product in productMap first
            let product = productMap.get(productId);
            let catName = product?.category?.name?.toUpperCase() || "";
            
            // If it's a YARN, return itself
            if (catName.includes("YARN") || catName.includes("RAW")) {
                return [{
                    productId: productId,
                    productName: product.name,
                    qty: targetQty,
                    unit: product.baseUnit?.code || '-'
                }];
            }
            
            const prodKey = `${productId}-${stage}`;
            const latestProd = latestProdMap.get(prodKey);
            
            if (!latestProd) {
                // Fallback to itself if we can't trace further (but at depth 0, we don't want to show anything if it's not a yarn)
                return depth > 0 && product ? [{
                    productId: product.id,
                    productName: product.name,
                    qty: targetQty,
                    unit: product.baseUnit?.code || '-'
                }] : [];
            }
            
            const outQty = Number(latestProd.outputQuantity) || 1;
            const ratio = targetQty / outQty;
            
            const result: any[] = [];
            (latestProd.ProductionInput || []).forEach((input: any) => {
                const inputReq = Number(input.quantity) * ratio;
                // Add input.Product to productMap if not there (since we included it in query)
                if (input.Product && !productMap.has(input.productId)) {
                    productMap.set(input.productId, {
                        ...input.Product,
                        category: input.Product.Category,
                        baseUnit: input.Product.Unit
                    });
                }
                const subYarns = getYarnComposition(input.productId, input.inputStage || "RAW", inputReq, depth + 1);
                result.push(...subYarns);
            });
            
            return result;
        };

        // Fetch stock ledger entries
        const ledgerEntries = await prisma.stockLedger.findMany({
            where: { companyId },
            select: {
                productId: true,
                stage: true,
                qtyIn: true,
                qtyOut: true,
                isEFS: true,
                batchNo: true,
                refType: true
            }
        });

        // Group by productId, stage, origin, isEFS
        const stockMap = new Map<string, {
            productId: string;
            stage: string;
            origin: 'LOCAL' | 'IMPORT';
            isEFS: boolean;
            stockBalance: number;
        }>();

        for (const e of ledgerEntries) {
            let isEFS = Boolean(e.isEFS);
            const batch = e.batchNo || '';
            let origin: 'LOCAL' | 'IMPORT' = 'LOCAL';

            if (e.refType === 'IMPORT_INVOICE' || isEFS || batch.includes('[EFS]') || batch.includes('[IMPORT]')) {
                origin = 'IMPORT';
                if (batch.includes('[EFS]')) isEFS = true;
            }

            const stage = e.stage || 'RAW';
            const key = `${e.productId}_${stage}_${origin}_${isEFS}`;
            const qty = (Number(e.qtyIn) || 0) - (Number(e.qtyOut) || 0);

            const existing = stockMap.get(key) || {
                productId: e.productId,
                stage,
                origin,
                isEFS,
                stockBalance: 0
            };
            existing.stockBalance += qty;
            stockMap.set(key, existing);
        }

        // Map balances to products per stage & origin
        const productBalances: any[] = [];
        
        products.forEach(product => {
            // Strictly only include products that currently have physical stock > 0
            const productStocks = Array.from(stockMap.values()).filter(s => s.productId === product.id && s.stockBalance > 0.0001);
            
            productStocks.forEach(stock => {
                productBalances.push({
                    ...product,
                    stockBalance: stock.stockBalance,
                    stage: stock.stage || "RAW",
                    origin: stock.origin,
                    isEFS: stock.isEFS
                });
            });
        });

        // Group by Category
        const groupedData: Record<string, any> = {};

        // Initialize all categories first so they always appear as tabs
        categories.forEach(cat => {
            groupedData[cat.id] = {
                id: cat.id,
                name: cat.name,
                isService: cat.isService,
                products: [],
                services: []
            };
        });
        
        // Add "Uncategorized" as a base if needed
        groupedData["uncategorized"] = {
            id: "uncategorized",
            name: "Uncategorized",
            isService: false,
            products: [],
            services: []
        };
        
        productBalances.forEach(p => {
            const catName = p.category?.name || "Uncategorized";
            const catId = p.category?.id || "uncategorized";
            
            if (!groupedData[catId]) {
                groupedData[catId] = {
                    id: catId,
                    name: catName,
                    products: []
                };
            }
            let compositionStr = "N/A";
            const yarnComps = getYarnComposition(p.id, p.stage || "RAW", p.stockBalance > 0 ? p.stockBalance : 1);
            
            if (yarnComps.length > 0) {
                const aggregated = new Map();
                let totalQty = 0;
                yarnComps.forEach((y: any) => {
                    if (!aggregated.has(y.productId)) {
                        aggregated.set(y.productId, { ...y });
                    } else {
                        aggregated.get(y.productId).qty += y.qty;
                    }
                    totalQty += y.qty;
                });
                
                if (totalQty > 0) {
                    const comps: string[] = [];
                    aggregated.forEach((y: any) => {
                        const pct = (y.qty / totalQty) * 100;
                        const actualQty = p.stockBalance > 0 ? y.qty : 0;
                        const formattedQty = actualQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        comps.push(`${y.productName} ${pct.toFixed(0)}% (${formattedQty} ${y.unit})`);
                    });
                    compositionStr = comps.join(' + ');
                }
            }

            groupedData[catId].products.push({
                id: `${p.id}-${p.stage}-${p.origin}-${p.isEFS ? 'efs' : 'nonefs'}`,
                name: `${p.name} ${p.stage ? `(${p.stage})` : ''}`,
                code: p.code,
                hsCode: p.hsCode || '-',
                origin: p.origin || 'LOCAL',
                isEFS: Boolean(p.isEFS),
                unit: p.baseUnit?.code || p.baseUnitId || '-',
                stockBalance: p.stockBalance,
                stage: p.stage,
                composition: compositionStr
            });
        });

        // Map service items
        unconsumedServices.forEach(item => {
            const catName = item.Product?.Category?.name || "Uncategorized";
            const catId = item.Product?.Category?.id || "uncategorized";
            
            if (!groupedData[catId]) {
                groupedData[catId] = {
                    id: catId,
                    name: catName,
                    isService: item.Product?.Category?.isService || true,
                    products: [],
                    services: []
                };
            }
            
            const unconsumedQty = Number(item.qty) - Number(item.consumedQty);
            const rate = Number(item.rate);
            const exAmount = unconsumedQty * rate;
            const taxAmount = Number(item.taxAmount);
            // Rough prorated tax for unconsumed portion (if partial consumption exists)
            const proratedTax = Number(item.qty) > 0 ? (taxAmount / Number(item.qty)) * unconsumedQty : 0;
            const inclAmount = exAmount + proratedTax;
            
            groupedData[catId].services.push({
                id: item.id, // PurchaseInvoiceItemId
                date: item.PurchaseInvoice.date,
                invoiceNo: item.PurchaseInvoice.invoiceNo,
                supplierName: item.PurchaseInvoice.Supplier?.name || '-',
                productName: item.Product.name,
                unconsumedQty: unconsumedQty,
                unit: item.Unit?.code || item.Product.Unit?.code || '-',
                exAmount: exAmount,
                taxAmount: proratedTax,
                inclAmount: inclAmount
            });
        });

        // Convert grouped object to array and strictly filter out categories with 0 stock/services
        const categoriesArray = Object.values(groupedData)
            .filter(cat => {
                const hasProductsInStock = cat.products && cat.products.some((p: any) => Number(p.stockBalance) > 0.0001);
                const hasServicesInStock = cat.services && cat.services.some((s: any) => Number(s.unconsumedQty) > 0.0001);
                return hasProductsInStock || hasServicesInStock;
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        // -------------------------------------------------------------------------------------------------
        // REQUIREMENT 2: Unsettled Accruals Production & Stage-Wise Tracking
        // -------------------------------------------------------------------------------------------------
        const productionRecordsWithAccruals = await prisma.productionRecord.findMany({
            where: {
                companyId,
                ProductionAccrual: { some: {} }
            },
            include: {
                Product: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        hsCode: true,
                        Unit: { select: { code: true, name: true } }
                    }
                },
                Warehouse: { select: { id: true, name: true } },
                ProductionAccrual: {
                    include: {
                        Product: { select: { id: true, name: true, code: true, hsCode: true, Unit: { select: { code: true } } } },
                        Supplier: { select: { id: true, name: true, code: true } },
                        Unit: { select: { id: true, code: true } }
                    },
                    orderBy: { accrualNo: 'asc' }
                },
                ProductionInput: {
                    include: {
                        Product: { select: { id: true, name: true, code: true, Unit: { select: { code: true } } } }
                    }
                }
            },
            orderBy: { date: 'desc' }
        });

        const batchIds = productionRecordsWithAccruals.map(p => p.id);
        const stockLedgerOutputs = await prisma.stockLedger.findMany({
            where: {
                companyId,
                refType: 'PRODUCTION',
                refId: { in: batchIds },
                qtyIn: { gt: 0 }
            },
            select: {
                refId: true,
                batchNo: true,
                stage: true,
                isEFS: true
            }
        });
        const outputLedgerMap = new Map<string, any>();
        stockLedgerOutputs.forEach(sl => {
            if (sl.refId && !outputLedgerMap.has(sl.refId)) {
                outputLedgerMap.set(sl.refId, sl);
            }
        });

        // Also check if any standalone accruals exist without a productionId
        const unlinkedAccruals = await prisma.productionAccrual.findMany({
            where: {
                companyId,
                OR: [
                    { productionId: null },
                    { productionId: { notIn: batchIds } }
                ]
            },
            include: {
                Product: { select: { id: true, name: true, code: true, hsCode: true, Unit: { select: { code: true } } } },
                Supplier: { select: { id: true, name: true, code: true } },
                Unit: { select: { id: true, code: true } }
            },
            orderBy: { accrualNo: 'asc' }
        });

        const unsettledBatches = productionRecordsWithAccruals.map(batch => {
            const outLedger = outputLedgerMap.get(batch.id);
            const rawBatchNo = outLedger?.batchNo || '';
            const batchNoClean = rawBatchNo ? rawBatchNo.split(' [')[0] : `BATCH-${batch.id.slice(-6).toUpperCase()}`;
            const specNotes = rawBatchNo && rawBatchNo.includes('[') ? rawBatchNo.slice(rawBatchNo.indexOf('[')) : '';

            const yarnAccruals: any[] = [];
            const weavingAccruals: any[] = [];
            const dyeingAccruals: any[] = [];
            const otherAccruals: any[] = [];

            batch.ProductionAccrual.forEach((a: any) => {
                const totalQty = Number(a.qty);
                const billedQty = Number(a.billedQty || 0);
                const remainingQty = Math.max(0, totalQty - billedQty);
                const rate = Number(a.rate || 0);
                const amount = Number(a.amount || 0);
                const remainingAmount = remainingQty * rate;

                // If settled, use the actual settled yarn/product name!
                let pName = a.Product?.name || 'Raw Material / Service';
                if (a.remarks && a.remarks.includes('[Settled from Stock:')) {
                    const match = a.remarks.match(/\[Settled from Stock:\s*([^-\]]+)/i);
                    if (match && match[1]) {
                        pName = match[1].trim();
                    }
                }
                const isStillUnspecified = (a.status === 'PENDING' && billedQty <= 0.001) &&
                    Boolean(a.remarks && a.remarks.includes('[UNSPECIFIED_YARN]'));

                const itemData = {
                    id: a.id,
                    accrualNo: a.accrualNo,
                    date: a.date,
                    productId: a.productId,
                    productName: pName,
                    productCode: a.Product?.code || '',
                    hsCode: a.Product?.hsCode || '',
                    isUnspecifiedLot: isStillUnspecified,
                    supplierId: a.supplierId,
                    supplierName: a.Supplier?.name || 'General / Unassigned',
                    unit: a.Unit?.code || a.Product?.Unit?.code || 'KG',
                    stage: a.stage,
                    serviceType: a.serviceType,
                    qty: totalQty,
                    billedQty,
                    remainingQty,
                    rate,
                    amount,
                    remainingAmount,
                    status: a.status,
                    isSettled: a.status === 'BILLED' || remainingQty <= 0.001,
                    remarks: a.remarks || ''
                };

                const svcType = (a.serviceType || '').toUpperCase();
                const stg = (a.stage || '').toUpperCase();

                if (svcType === 'RAW_YARN' || stg === 'RAW' || (!a.serviceType && stg.includes('YARN'))) {
                    yarnAccruals.push(itemData);
                } else if (svcType === 'WEAVING' || svcType === 'KNITTING' || stg === 'GREY') {
                    weavingAccruals.push(itemData);
                } else if (svcType === 'DYEING' || svcType === 'FINISHING' || svcType === 'PRINTING' || stg === 'FINISH') {
                    dyeingAccruals.push(itemData);
                } else {
                    otherAccruals.push(itemData);
                }
            });

            const calcStageStatus = (accList: any[], defaultIfNotPresent = 'NONE') => {
                if (accList.length === 0) return defaultIfNotPresent;
                const allSettled = accList.every(a => a.isSettled);
                if (allSettled) return 'SETTLED';
                const someSettled = accList.some(a => a.billedQty > 0.001);
                if (someSettled) return 'PARTIALLY_SETTLED';
                return 'PENDING';
            };

            const yarnStageStatus = calcStageStatus(yarnAccruals, batch.ProductionInput.length > 0 ? 'STOCK_ALLOCATED' : 'NONE');
            const weavingStageStatus = calcStageStatus(weavingAccruals, 'IN_HOUSE');
            const dyeingStageStatus = calcStageStatus(dyeingAccruals, 'IN_HOUSE');

            const allBatchAccruals = [...yarnAccruals, ...weavingAccruals, ...dyeingAccruals, ...otherAccruals];
            const totalDemanded = allBatchAccruals.reduce((sum, a) => sum + a.qty, 0);
            const totalSettledQty = allBatchAccruals.reduce((sum, a) => sum + a.billedQty, 0);
            const totalAccrualValue = allBatchAccruals.reduce((sum, a) => sum + a.amount, 0);
            const remainingLiability = allBatchAccruals.reduce((sum, a) => sum + a.remainingAmount, 0);

            const allSettled = allBatchAccruals.length > 0 && allBatchAccruals.every(a => a.isSettled);
            const noneSettled = allBatchAccruals.every(a => a.billedQty <= 0.001);

            let overallStatus = 'PENDING';
            if (allSettled) overallStatus = 'FULLY_SETTLED';
            else if (!noneSettled) overallStatus = 'PARTIALLY_SETTLED';

            // Parse actual output UOM and net weight from specNotes if available
            let parsedOutputUnit = batch.Product?.Unit?.code || 'Units';
            let parsedNetWeightKg: number | null = null;
            if (specNotes) {
                const uomMatch = specNotes.match(/\[(\d+(?:\.\d+)?)\s*([A-Za-z]+)/i);
                if (uomMatch && uomMatch[2]) {
                    parsedOutputUnit = uomMatch[2].toUpperCase();
                }
                const netMatch = specNotes.match(/Net:\s*([\d.]+)\s*KG/i);
                if (netMatch && netMatch[1]) {
                    parsedNetWeightKg = parseFloat(netMatch[1]);
                }
            }

            return {
                batchId: batch.id,
                batchNo: batchNoClean,
                specNotes,
                date: batch.date,
                outputProductId: batch.outputProductId,
                outputProductName: batch.Product?.name || 'Output Product',
                outputProductCode: batch.Product?.code || '',
                outputQuantity: Number(batch.outputQuantity),
                outputUnit: parsedOutputUnit,
                outputNetWeightKg: parsedNetWeightKg,
                outputStage: batch.outputStage || 'FINISH',
                warehouseId: batch.warehouseId,
                warehouseName: batch.Warehouse?.name || 'Main Warehouse',
                totalCost: Number(batch.totalCost || 0),
                overallStatus,
                totalAccrualValue,
                remainingLiability,
                totalDemanded,
                totalSettledQty,
                stages: {
                    yarn: {
                        title: 'Raw Yarn',
                        icon: 'yarn',
                        status: yarnStageStatus,
                        accruals: yarnAccruals,
                        totalDemanded: yarnAccruals.reduce((s, a) => s + a.qty, 0),
                        totalSettled: yarnAccruals.reduce((s, a) => s + a.billedQty, 0),
                        remainingQty: yarnAccruals.reduce((s, a) => s + a.remainingQty, 0),
                        remainingAmount: yarnAccruals.reduce((s, a) => s + a.remainingAmount, 0)
                    },
                    weaving: {
                        title: 'Weaving / Knitting',
                        icon: 'weaving',
                        status: weavingStageStatus,
                        accruals: weavingAccruals,
                        totalDemanded: weavingAccruals.reduce((s, a) => s + a.qty, 0),
                        totalSettled: weavingAccruals.reduce((s, a) => s + a.billedQty, 0),
                        remainingQty: weavingAccruals.reduce((s, a) => s + a.remainingQty, 0),
                        remainingAmount: weavingAccruals.reduce((s, a) => s + a.remainingAmount, 0)
                    },
                    dyeingFinish: {
                        title: 'Dyeing / Finishing',
                        icon: 'dyeing',
                        status: dyeingStageStatus,
                        accruals: dyeingAccruals,
                        totalDemanded: dyeingAccruals.reduce((s, a) => s + a.qty, 0),
                        totalSettled: dyeingAccruals.reduce((s, a) => s + a.billedQty, 0),
                        remainingQty: dyeingAccruals.reduce((s, a) => s + a.remainingQty, 0),
                        remainingAmount: dyeingAccruals.reduce((s, a) => s + a.remainingAmount, 0)
                    },
                    other: otherAccruals
                }
            };
        });

        // If any unlinked accruals exist, add as standalone batch
        if (unlinkedAccruals.length > 0) {
            const unlinkedItems = unlinkedAccruals.map((a: any) => {
                const totalQty = Number(a.qty);
                const billedQty = Number(a.billedQty || 0);
                const remainingQty = Math.max(0, totalQty - billedQty);
                const rate = Number(a.rate || 0);
                const amount = Number(a.amount || 0);
                const remainingAmount = remainingQty * rate;

                return {
                    id: a.id,
                    accrualNo: a.accrualNo,
                    date: a.date,
                    productId: a.productId,
                    productName: a.Product?.name || 'Raw Material / Service',
                    productCode: a.Product?.code || '',
                    hsCode: a.Product?.hsCode || '',
                    supplierId: a.supplierId,
                    supplierName: a.Supplier?.name || 'General / Unassigned',
                    unit: a.Unit?.code || a.Product?.Unit?.code || 'KG',
                    stage: a.stage,
                    serviceType: a.serviceType,
                    qty: totalQty,
                    billedQty,
                    remainingQty,
                    rate,
                    amount,
                    remainingAmount,
                    status: a.status,
                    isSettled: a.status === 'BILLED' || remainingQty <= 0.001,
                    remarks: a.remarks || ''
                };
            });

            unsettledBatches.push({
                batchId: 'standalone-accruals',
                batchNo: 'STANDALONE / MANUAL ACCRUALS',
                specNotes: 'Directly booked or unlinked production demands',
                date: unlinkedItems[0]?.date || new Date(),
                outputProductId: '',
                outputProductName: 'Manual / Direct Accruals',
                outputProductCode: '',
                outputQuantity: 0,
                outputUnit: 'Items',
                outputStage: 'RAW',
                warehouseId: '',
                warehouseName: 'Direct',
                totalCost: 0,
                overallStatus: unlinkedItems.every(i => i.isSettled) ? 'FULLY_SETTLED' : unlinkedItems.some(i => i.billedQty > 0) ? 'PARTIALLY_SETTLED' : 'PENDING',
                totalAccrualValue: unlinkedItems.reduce((s, i) => s + i.amount, 0),
                remainingLiability: unlinkedItems.reduce((s, i) => s + i.remainingAmount, 0),
                totalDemanded: unlinkedItems.reduce((s, i) => s + i.qty, 0),
                totalSettledQty: unlinkedItems.reduce((s, i) => s + i.billedQty, 0),
                stages: {
                    yarn: {
                        title: 'Raw Yarn',
                        icon: 'yarn',
                        status: unlinkedItems.filter(i => (i.serviceType || '').toUpperCase() === 'RAW_YARN').every(i => i.isSettled) ? 'SETTLED' : 'PENDING',
                        accruals: unlinkedItems.filter(i => (i.serviceType || '').toUpperCase() === 'RAW_YARN'),
                        totalDemanded: unlinkedItems.filter(i => (i.serviceType || '').toUpperCase() === 'RAW_YARN').reduce((s, a) => s + a.qty, 0),
                        totalSettled: unlinkedItems.filter(i => (i.serviceType || '').toUpperCase() === 'RAW_YARN').reduce((s, a) => s + a.billedQty, 0),
                        remainingQty: unlinkedItems.filter(i => (i.serviceType || '').toUpperCase() === 'RAW_YARN').reduce((s, a) => s + a.remainingQty, 0),
                        remainingAmount: unlinkedItems.filter(i => (i.serviceType || '').toUpperCase() === 'RAW_YARN').reduce((s, a) => s + a.remainingAmount, 0)
                    },
                    weaving: {
                        title: 'Weaving / Knitting',
                        icon: 'weaving',
                        status: 'NONE',
                        accruals: [],
                        totalDemanded: 0,
                        totalSettled: 0,
                        remainingQty: 0,
                        remainingAmount: 0
                    },
                    dyeingFinish: {
                        title: 'Dyeing / Finishing',
                        icon: 'dyeing',
                        status: unlinkedItems.filter(i => (i.serviceType || '').toUpperCase() !== 'RAW_YARN').every(i => i.isSettled) ? 'SETTLED' : 'PENDING',
                        accruals: unlinkedItems.filter(i => (i.serviceType || '').toUpperCase() !== 'RAW_YARN'),
                        totalDemanded: unlinkedItems.filter(i => (i.serviceType || '').toUpperCase() !== 'RAW_YARN').reduce((s, a) => s + a.qty, 0),
                        totalSettled: unlinkedItems.filter(i => (i.serviceType || '').toUpperCase() !== 'RAW_YARN').reduce((s, a) => s + a.billedQty, 0),
                        remainingQty: unlinkedItems.filter(i => (i.serviceType || '').toUpperCase() !== 'RAW_YARN').reduce((s, a) => s + a.remainingQty, 0),
                        remainingAmount: unlinkedItems.filter(i => (i.serviceType || '').toUpperCase() !== 'RAW_YARN').reduce((s, a) => s + a.remainingAmount, 0)
                    },
                    other: []
                }
            });
        }

        const accrualsSummary = {
            totalBatches: unsettledBatches.length,
            unsettledBatchesCount: unsettledBatches.filter(b => b.overallStatus !== 'FULLY_SETTLED').length,
            fullySettledBatchesCount: unsettledBatches.filter(b => b.overallStatus === 'FULLY_SETTLED').length,
            totalRemainingLiability: unsettledBatches.reduce((s, b) => s + b.remainingLiability, 0),
            yarnPendingCount: unsettledBatches.filter(b => b.stages.yarn.status === 'PENDING' || b.stages.yarn.status === 'PARTIALLY_SETTLED').length,
            weavingPendingCount: unsettledBatches.filter(b => b.stages.weaving.status === 'PENDING' || b.stages.weaving.status === 'PARTIALLY_SETTLED').length,
            dyeingPendingCount: unsettledBatches.filter(b => b.stages.dyeingFinish.status === 'PENDING' || b.stages.dyeingFinish.status === 'PARTIALLY_SETTLED').length
        };

        return NextResponse.json({
            success: true,
            data: categoriesArray,
            categories: categoriesArray,
            unsettledBatches,
            accrualsSummary
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
