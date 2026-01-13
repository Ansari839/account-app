import 'dotenv/config';
import prisma from '../lib/prisma';
import { SalesService } from '../services/sales.service';
import { PurchaseService } from '../services/purchase.service';
import { VariantService } from '../services/variant.service';

async function main() {
    console.log("Starting Sales Parity Test...");

    // 0. Ensure Currency
    await prisma.currency.upsert({
        where: { code: 'USD' },
        update: {},
        create: { code: 'USD', name: 'US Dollar', symbol: '$', rate: 1, isBase: true }
    });

    // 1. Setup Master Data
    console.log("1. Setting up Master Data...");

    let company = await prisma.company.findFirst();
    if (!company) {
        company = await prisma.company.create({
            data: { name: 'Test Company', email: 'test@example.com' }
        });
    }

    // Create Accounts
    const salesAccount = await prisma.account.upsert({
        where: { companyId_code: { code: '400-TEST', companyId: company.id } },
        update: {},
        create: { code: '400-TEST', name: 'Sales Account', type: 'INCOME', isPosting: true, companyId: company.id }
    });
    const arAccount = await prisma.account.upsert({
        where: { companyId_code: { code: '110-TEST', companyId: company.id } },
        update: {},
        create: { code: '110-TEST', name: 'AR Account', type: 'ASSET', isPosting: true, companyId: company.id }
    });
    const cogsAccount = await prisma.account.upsert({
        where: { companyId_code: { code: '500-TEST', companyId: company.id } },
        update: {},
        create: { code: '500-TEST', name: 'COGS Account', type: 'EXPENSE', isPosting: true, companyId: company.id }
    });
    const inventoryAccount = await prisma.account.upsert({
        where: { companyId_code: { code: '120-TEST', companyId: company.id } },
        update: {},
        create: { code: '120-TEST', name: 'Inventory Account', type: 'ASSET', isPosting: true, companyId: company.id }
    });
    const payableAccount = await prisma.account.upsert({
        where: { companyId_code: { code: '200-TEST', companyId: company.id } },
        update: {},
        create: { code: '200-TEST', name: 'Payable Account', type: 'LIABILITY', isPosting: true, companyId: company.id }
    });

    // Create Warehouse
    const warehouse = await prisma.warehouse.upsert({
        where: { code: 'WH-TEST' },
        update: {},
        create: { code: 'WH-TEST', name: 'Test Warehouse', address: 'Test Loc' }
    });

    // Create Unit via Upsert because code must be unique
    const unit = await prisma.unit.upsert({
        where: { code: 'PCS-TEST' },
        update: {},
        create: { code: 'PCS-TEST', name: 'Pieces' }
    });

    // Create Product
    const product = await prisma.product.create({
        data: {
            name: `Test Product ${Date.now()}`,
            code: `PROD-${Date.now()}`,
            baseUnitId: unit.id,
            salesAccountId: salesAccount.id,
            purchaseAccountId: cogsAccount.id, // simplified
            inventoryAccountId: inventoryAccount.id,
            cogsAccountId: cogsAccount.id
        }
    });

    // Create Variant
    const variant = await VariantService.createVariant({
        productId: product.id,
        name: 'Red/XL',
        sku: `SKU-${Date.now()}`,
        price: 100
    });

    // Create Supplier
    const supplier = await prisma.supplier.create({
        data: {
            code: `SUP-${Date.now()}`,
            name: `Test Supplier ${Date.now()}`,
            currencyCode: 'USD',
            payableAccountId: payableAccount.id
        }
    });

    // Create Customer Linked to AR Account
    const customer = await prisma.customer.create({
        data: {
            code: `CUS-${Date.now()}`,
            name: `Test Customer ${Date.now()}`,
            currencyCode: 'USD',
            receivableAccountId: arAccount.id
        }
    });

    console.log("   -> Master Data Created.");

    // 2. Add Stock (via Purchase)
    console.log("2. Adding Initial Stock...");

    await PurchaseService.createGRN({
        grnNo: `GRN-${Date.now()}`,
        poId: undefined, // Add optional fields
        supplierId: supplier.id,
        warehouseId: warehouse.id,
        date: new Date(),
        items: [{
            productId: product.id,
            variantId: variant.id,
            qtyReceived: 10,
            rate: 50
        }]
    });

    // Create PI to establish cost
    const pi = await PurchaseService.createPurchaseInvoice({
        invoiceNo: `PI-${Date.now()}`,
        supplierId: supplier.id,
        date: new Date(),
        items: [{
            productId: product.id,
            variantId: variant.id,
            qty: 10,
            rate: 50
        }]
    });
    console.log("   -> Stock Added (10 qty @ 50).");

    // 3. Test Sales Flow with Account ID (Parity Check)
    console.log("3. Testing Sales Order with Account ID Lookup...");

    // Pass arAccount.id instead of customer.id to test resolveCustomer
    const so = await SalesService.createOrder({
        orderNo: `SO-${Date.now()}`,
        customerId: arAccount.id, // <--- TESTING FEATURE PARITY HERE
        warehouseId: warehouse.id,
        date: new Date(),
        items: [{
            productId: product.id,
            variantId: variant.id,
            qty: 5,
            rate: 100
        }]
    });
    console.log(`   -> SO Created: ${so.orderNo} for Customer: ${so.customerId} (Should match ${customer.id})`);
    if (so.customerId !== customer.id) throw new Error("Failed to resolve customer from Account ID");

    // 4. Test Sales Invoice (Stock Update + GL)
    console.log("4. Testing Sales Invoice...");
    const inv = await SalesService.createSalesInvoice({
        invoiceNo: `INV-${Date.now()}`,
        customerId: customer.id, // Using direct ID here, already tested resolution
        warehouseId: warehouse.id,
        date: new Date(),
        items: [{
            productId: product.id,
            variantId: variant.id,
            qty: 5,
            rate: 100
        }]
    });
    console.log(`   -> Invoice Created: ${inv.invoiceNo}`);

    // Verify Stock Ledger
    const ledger = await prisma.stockLedger.findFirst({
        where: { refId: inv.id, refType: 'SALES_INVOICE' }
    });
    if (!ledger || ledger.qtyOut.toNumber() !== 5 || ledger.variantId !== variant.id) {
        throw new Error("Stock Ledger failed for Sales Invoice");
    }
    console.log("   -> Stock Ledger Verified.");

    // 5. Test Sales Return (Variant Matching)
    console.log("5. Testing Sales Return...");
    const ret = await SalesService.createSalesReturn({
        invoiceId: inv.id,
        date: new Date(),
        items: [{
            productId: product.id,
            variantId: variant.id,
            qty: 1,
            rate: 100
        }]
    });
    console.log(`   -> Return Created: ${ret.returnId}`);

    // Verify Return Ledger
    const retLedger = await prisma.stockLedger.findFirst({
        where: { refId: ret.returnId, refType: 'SALES_RETURN' }
    });
    if (!retLedger || retLedger.qtyIn.toNumber() !== 1 || retLedger.variantId !== variant.id) {
        throw new Error("Stock Ledger failed for Sales Return");
    }
    console.log("   -> Return Ledger Verified.");

    console.log("SUCCESS: Sales Module Parity Verified!");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
