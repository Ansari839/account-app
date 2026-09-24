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

        // Fetch stock ledger sums grouped by productId
        const ledger = await prisma.stockLedger.groupBy({
            by: ['productId'],
            _sum: {
                qtyIn: true,
                qtyOut: true
            },
            where: { companyId }
        });

        // Map balances to products
        const productBalances = products.map(product => {
            const stock = ledger.find(l => l.productId === product.id);
            const inQty = Number(stock?._sum?.qtyIn || 0);
            const outQty = Number(stock?._sum?.qtyOut || 0);
            const balance = inQty - outQty;

            return {
                ...product,
                stockBalance: balance
            };
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
            groupedData[catId].products.push({
                id: p.id,
                name: p.name,
                code: p.code,
                unit: p.baseUnit?.code || p.baseUnitId || '-',
                stockBalance: p.stockBalance
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
