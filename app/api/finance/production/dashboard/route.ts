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
        const products = await prisma.product.findMany({
            where: { 
                companyId, 
                OR: [
                    { categoryId: null },
                    { category: { isService: false } }
                ]
            },
            include: { category: true, baseUnit: true }
        });

        // Fetch unconsumed service invoice items (where category is a service)
        const serviceItems = await prisma.purchaseInvoiceItem.findMany({
            where: {
                invoice: { companyId },
                product: { category: { isService: true } }
            },
            include: {
                invoice: { include: { supplier: true } },
                product: { include: { category: true, baseUnit: true } },
                unit: true
            }
        });
        
        const unconsumedServices = serviceItems.filter(item => Number(item.qty) > Number(item.consumedQty));

        // Fetch the latest ProductionRecord for each product to determine composition
        const latestProductions = await prisma.productionRecord.findMany({
            where: { companyId },
            orderBy: { date: 'desc' },
            include: {
                inputs: {
                    include: { product: { include: { baseUnit: true, category: true } } }
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
            latestProd.inputs.forEach((input: any) => {
                const inputReq = Number(input.quantity) * ratio;
                // Add input.product to productMap if not there (since we included it in query)
                if (!productMap.has(input.productId)) {
                    productMap.set(input.productId, input.product);
                }
                const subYarns = getYarnComposition(input.productId, input.inputStage || "RAW", inputReq, depth + 1);
                result.push(...subYarns);
            });
            
            return result;
        };

        // Fetch stock ledger sums grouped by productId
        const ledger = await prisma.stockLedger.groupBy({
            by: ['productId', 'stage'],
            _sum: {
                qtyIn: true,
                qtyOut: true
            },
            where: { companyId }
        });

        // Map balances to products per stage
        const productBalances: any[] = [];
        
        products.forEach(product => {
            const productStocks = ledger.filter(l => l.productId === product.id);
            
            // If no stock exists, maybe show it as RAW by default or just show it once
            if (productStocks.length === 0) {
                productBalances.push({
                    ...product,
                    stockBalance: 0,
                    stage: "RAW"
                });
            } else {
                productStocks.forEach(stock => {
                    const inQty = Number(stock._sum?.qtyIn || 0);
                    const outQty = Number(stock._sum?.qtyOut || 0);
                    const balance = inQty - outQty;
                    
                    productBalances.push({
                        ...product,
                        stockBalance: balance,
                        stage: stock.stage || "RAW"
                    });
                });
            }
        }); // Show all products regardless of stock balance

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
                id: `${p.id}-${p.stage}`,
                name: `${p.name} ${p.stage ? `(${p.stage})` : ''}`,
                code: p.code,
                unit: p.baseUnit?.code || p.baseUnitId || '-',
                stockBalance: p.stockBalance,
                stage: p.stage,
                composition: compositionStr
            });
        });

        // Map service items
        unconsumedServices.forEach(item => {
            const catName = item.product?.category?.name || "Uncategorized";
            const catId = item.product?.category?.id || "uncategorized";
            
            if (!groupedData[catId]) {
                groupedData[catId] = {
                    id: catId,
                    name: catName,
                    isService: item.product?.category?.isService || true,
                    products: [],
                    services: []
                };
            }
            
            const unconsumedQty = Number(item.qty) - Number(item.consumedQty);
            const rate = Number(item.rate);
            const exAmount = unconsumedQty * rate;
            const taxAmount = Number(item.taxAmount);
            // Rough prorated tax for unconsumed portion (if partial consumption exists)
            // If it's a fixed tax, we prorate it: (taxAmount / qty) * unconsumedQty
            const proratedTax = Number(item.qty) > 0 ? (taxAmount / Number(item.qty)) * unconsumedQty : 0;
            const inclAmount = exAmount + proratedTax;
            
            groupedData[catId].services.push({
                id: item.id, // PurchaseInvoiceItemId
                date: item.invoice.date,
                invoiceNo: item.invoice.invoiceNo,
                supplierName: item.invoice.supplier.name,
                productName: item.product.name,
                unconsumedQty: unconsumedQty,
                unit: item.unit?.code || item.product.baseUnit?.code || '-',
                exAmount: exAmount,
                taxAmount: proratedTax,
                inclAmount: inclAmount
            });
        });

        // Convert grouped object to array and filter out completely empty tabs
        const categoriesArray = Object.values(groupedData)
            .filter(cat => cat.products.length > 0 || cat.services.length > 0 || categories.find(c => c.id === cat.id)) // keep seeded cats
            .sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({ success: true, data: categoriesArray });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
