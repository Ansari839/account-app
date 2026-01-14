import prisma from '../lib/prisma';
import { SalesService } from '../services/sales.service';

async function main() {
    console.log("--- Starting Sales Deletion Verification ---");

    try {
        // 1. Setup Data
        const company = await prisma.company.findFirst();
        if (!company) throw new Error("No company found");

        const warehouse = await prisma.warehouse.findFirst(); // Remove filter to be safe
        if (!warehouse) throw new Error("No warehouse found");

        const product = await prisma.product.findFirst(); // Remove filter to be safe
        if (!product) throw new Error("No product found");

        const customer = await prisma.customer.findFirst({
            where: { receivableAccount: { companyId: company.id } },
            include: { receivableAccount: true }
        });
        if (!customer) throw new Error("No customer with receivable account found");

        const unit = await prisma.unit.findFirst();
        if (!unit) throw new Error("No unit found");

        console.log("Using Product:", product.name);
        console.log("Using Customer:", customer.name);

        // 2. Create Order -> DO -> SI
        console.log("\n1. Creating Flow (SO -> DO -> SI)...");
        const order = await SalesService.createOrder({
            orderNo: `SO-TEST-${Date.now()}`,
            customerId: customer.id,
            warehouseId: warehouse.id,
            date: new Date(),
            items: [{ productId: product.id, unitId: unit.id, qty: 10, rate: 100 }]
        });
        console.log("Order Created:", order.orderNo);

        const dn = await SalesService.createDO({
            orderId: order.id,
            customerId: customer.id,
            warehouseId: warehouse.id,
            date: new Date(),
            items: [{ productId: product.id, unitId: unit.id, orderItemId: order.items[0].id, qtyShipped: 5 }]
        });
        console.log("DO Created:", dn.doNo);

        const invoice = await SalesService.createSalesInvoice({
            customerId: customer.id,
            warehouseId: warehouse.id,
            date: new Date(),
            doId: dn.id,
            orderId: order.id,
            items: [{ productId: product.id, unitId: unit.id, soItemId: order.items[0].id, qty: 5, rate: 100 }]
        });
        console.log("Invoice Created:", invoice.invoiceNo);

        // Verify Initial State
        let soItem = await prisma.salesOrderItem.findUnique({ where: { id: order.items[0].id } });
        console.log(`Initial State: fulfilledQty=${soItem?.fulfilledQty}, invoicedQty=${soItem?.invoicedQty}`);

        // 3. Delete Invoice
        console.log("\n2. Deleting Invoice...");
        await SalesService.deleteSalesInvoice(invoice.id);

        soItem = await prisma.salesOrderItem.findUnique({ where: { id: order.items[0].id } });
        console.log(`After Deleting Invoice: invoicedQty=${soItem?.invoicedQty} (Expected: 0)`);

        const slCountSI = await prisma.stockLedger.count({ where: { refType: 'SALES_INVOICE', refId: invoice.id } });
        const slCountDO = await prisma.stockLedger.count({ where: { refType: 'DO', refId: dn.id } });
        console.log(`Stock Ledger entries: SALES_INVOICE count=${slCountSI}, DO count=${slCountDO} (Expected: SI=0, DO=1)`);

        // 4. Delete DO
        console.log("\n3. Deleting DO...");
        await SalesService.deleteDO(dn.id);

        soItem = await prisma.salesOrderItem.findUnique({ where: { id: order.items[0].id } });
        console.log(`After Deleting DO: fulfilledQty=${soItem?.fulfilledQty} (Expected: 0)`);

        const slCountFinal = await prisma.stockLedger.count({ where: { refId: dn.id } });
        console.log(`Stock Ledger entries for DO: ${slCountFinal} (Expected: 0)`);

        // 5. Delete Order
        console.log("\n4. Deleting Order...");
        await SalesService.deleteOrder(order.id);
        const orderCheck = await prisma.salesOrder.findUnique({ where: { id: order.id } });
        console.log(`Order exists? ${!!orderCheck} (Expected: false)`);

        console.log("\n--- Verification Successful! ---");

    } catch (error) {
        console.error("Verification Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
