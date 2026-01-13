
import { PrismaClient, AccountType } from '@prisma/client';
import { PurchaseService } from '../services/purchase.service';
import { SalesService } from '../services/sales.service';
import { StockService } from '../services/stock.service';
import { ProductService } from '../services/product.service';

const prisma = new PrismaClient();

async function main() {
    console.log("--- Starting Product Variant Integration Test ---");

    try {
        // 1. Setup Master Data
        const getAccount = async (code: string, name: string, type: AccountType, isPosting: boolean) => {
            return await prisma.account.upsert({
                where: { code },
                update: { isPosting, name, type },
                create: { code, name, type, isPosting }
            });
        };

        const assetParent = await getAccount('1000', 'Assets', 'ASSET', false);
        const expParent = await getAccount('5000', 'Expenses', 'EXPENSE', false);
        const incParent = await getAccount('4000', 'Income', 'INCOME', false);

        const invAcc = await getAccount('1100', 'Inventory Account', 'ASSET', true);
        const cogsAcc = await getAccount('5100', 'COGS Account', 'EXPENSE', true);
        const salesAcc = await getAccount('4100', 'Sales Account', 'INCOME', true);
        const purAcc = await getAccount('5200', 'Purchase Account', 'EXPENSE', true);
        const cashAcc = await getAccount('1200', 'Cash', 'ASSET', true);

        const supplier = await prisma.supplier.upsert({
            where: { name: 'Variant Supplier' },
            update: {},
            create: { name: 'Variant Supplier', code: 'SUP-VAR-001' }
        });

        const customer = await prisma.customer.upsert({
            where: { name: 'Variant Customer' },
            update: { receivableAccountId: cashAcc.id },
            create: { name: 'Variant Customer', code: 'CUS-VAR-001', receivableAccountId: cashAcc.id }
        });

        const warehouse = await prisma.warehouse.upsert({
            where: { name: 'Main Warehouse' },
            update: { isDefault: true },
            create: { name: 'Main Warehouse', code: 'WH-MAIN', isDefault: true }
        });

        const unit = await prisma.unit.upsert({
            where: { name: 'Pcs' },
            update: {},
            create: { name: 'Pcs', code: 'PCS' }
        });

        // 2. Create Product with Variants
        console.log("Creating Product with Variants...");
        const product = await ProductService.createProduct({
            name: "Variant Test Product",
            baseUnitId: unit.id,
            inventoryAccountId: invAcc.id,
            cogsAccountId: cogsAcc.id,
            salesAccountId: salesAcc.id,
            purchaseAccountId: purAcc.id,
            variants: [
                { name: "Small", sku: "VT-SMLA", price: 100 },
                { name: "Large", sku: "VT-LRGE", price: 150 }
            ]
        });

        const variantSmall = product.variants.find(v => v.name === "Small")!;
        const variantLarge = product.variants.find(v => v.name === "Large")!;

        // 3. Purchase Variant Small
        console.log("Purchasing 10 Small Variants...");
        const grn = await PurchaseService.createGRN({
            grnNo: `GRN-VAR-${Date.now()}`,
            supplierId: supplier.id,
            warehouseId: warehouse.id,
            date: new Date(),
            items: [{
                productId: product.id,
                variantId: variantSmall.id,
                qtyReceived: 10,
                rate: 80
            }]
        });

        // 4. Verify Stock
        const stockSmall = await StockService.getStock(product.id, warehouse.id, variantSmall.id);
        const stockLarge = await StockService.getStock(product.id, warehouse.id, variantLarge.id);
        const stockTotal = await StockService.getStock(product.id, warehouse.id);

        console.log(`Stock Small: ${stockSmall} (Expected 10)`);
        console.log(`Stock Large: ${stockLarge} (Expected 0)`);
        console.log(`Stock Total: ${stockTotal} (Expected 10)`);

        if (stockSmall !== 10 || stockLarge !== 0) throw new Error("Stock verification failed after GRN");

        // 5. Create Purchase Invoice (to establish cost)
        await PurchaseService.createPurchaseInvoice({
            invoiceNo: `PI-VAR-${Date.now()}`,
            supplierId: supplier.id,
            date: new Date(),
            grnId: grn.id,
            items: [{
                productId: product.id,
                variantId: variantSmall.id,
                qty: 10,
                rate: 85 // Price changed!
            }]
        });

        // 6. Sell Variant Small
        console.log("Selling 5 Small Variants...");
        const invoice = await SalesService.createSalesInvoice({
            invoiceNo: `SI-VAR-${Date.now()}`,
            customerId: customer.id,
            warehouseId: warehouse.id,
            date: new Date(),
            items: [{
                productId: product.id,
                variantId: variantSmall.id,
                qty: 5,
                rate: 120
            }]
        });

        // 7. Verify Stock after Sales
        const stockSmallAfter = await StockService.getStock(product.id, warehouse.id, variantSmall.id);
        console.log(`Stock Small After Sale: ${stockSmallAfter} (Expected 5)`);
        if (stockSmallAfter !== 5) throw new Error("Stock verification failed after Sales Invoice");

        // 8. Verify COGS (Should use PI rate 85)
        const journal = await prisma.journalEntry.findUnique({
            where: { id: invoice.journalEntryId! },
            include: { lines: true }
        });

        const cogsLine = journal?.lines.find(l => l.accountId === cogsAcc.id);
        const expectedCogs = 5 * 85;
        console.log(`COGS Amount: ${cogsLine?.debit} (Expected ${expectedCogs})`);
        if (Number(cogsLine?.debit) !== expectedCogs) throw new Error("COGS calculation incorrect");

        console.log("--- Test Completed Successfully ---");

    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
