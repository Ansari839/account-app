import prisma from "@/lib/prisma";
import { JournalService } from "./journal.service";
import { GlobalSettingsService } from "./settings.service";
import { SalesQuotation, SalesOrder, DeliveryOrder, SalesInvoice } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

export interface SalesQuotationInput {
    quoteNo: string;
    customerId: string;
    date: Date;
    validUntil?: Date;
    items: {
        productId: string;
        variantId?: string;
        unitId?: string;
        qty: number;
        rate: number;
        taxCodeId?: string;
    }[];
}

export interface SalesOrderInput {
    orderNo?: string;
    customerId: string;
    warehouseId?: string;
    date: Date;
    expectedDate?: Date;
    quoteId?: string;
    items: {
        productId: string;
        variantId?: string;
        unitId?: string;
        qty: number;
        rate: number;
        taxCodeId?: string;
    }[];
}

export interface DeliveryOrderInput {
    doNo?: string;
    orderId?: string;
    customerId: string;
    warehouseId: string;
    date: Date;
    remarks?: string;
    items: {
        productId: string;
        variantId?: string;
        unitId?: string;
        orderItemId?: string;
        qtyShipped: number;
    }[];
}

export interface SalesInvoiceInput {
    invoiceNo?: string;
    customerId: string;
    warehouseId?: string;
    date: Date;
    dueDate?: Date;
    doId?: string;
    orderId?: string;
    items: {
        productId: string;
        variantId?: string;
        unitId?: string;
        soItemId?: string;
        qty: number;
        rate: number;
        taxCodeId?: string;
    }[];
}

export class SalesService {
    /**
     * Resolves customer from ID or Account ID (Strict Lookup)
     */
    private static async resolveCustomer(tx: any, id: string) {
        let customer = await tx.customer.findUnique({
            where: { id },
            include: { receivableAccount: true }
        });

        if (!customer) {
            customer = await tx.customer.findFirst({
                where: { receivableAccountId: id },
                include: { receivableAccount: true }
            });
        }
        return customer;
    }

    /**
     * Creates a Sales Quotation (No inventory/accounting impact)
     */
    static async createQuotation(data: SalesQuotationInput) {
        return await prisma.$transaction(async (tx) => {
            const customer = await this.resolveCustomer(tx, data.customerId);
            if (!customer) throw new Error("Customer not found.");

            let totalAmount = 0;
            const items = data.items.map(item => {
                const total = item.qty * item.rate;
                totalAmount += total;
                return {
                    productId: item.productId,
                    variantId: item.variantId || null,
                    unitId: item.unitId || null,
                    qty: item.qty,
                    rate: item.rate,
                    taxCodeId: item.taxCodeId,
                    total: total
                };
            });

            return await tx.salesQuotation.create({
                data: {
                    quoteNo: data.quoteNo,
                    customerId: customer.id,
                    date: data.date,
                    validUntil: data.validUntil,
                    totalAmount: totalAmount,
                    items: {
                        create: items
                    }
                },
                include: { items: true }
            });
        });
    }

    /**
     * Creates a Sales Order (No inventory/accounting impact)
     * Matches PurchaseService.createOrder structure.
     */
    static async createOrder(data: SalesOrderInput) {
        return await prisma.$transaction(async (tx) => {
            const customer = await this.resolveCustomer(tx, data.customerId);
            if (!customer) throw new Error("Customer not found.");

            // Auto-generate Order No if not provided
            let orderNo = data.orderNo;
            if (!orderNo) {
                const lastOrder = await tx.salesOrder.findFirst({
                    where: { orderNo: { startsWith: `SO-${new Date().getFullYear()}-` } },
                    orderBy: { orderNo: 'desc' }
                });
                let nextSeq = 1;
                if (lastOrder) {
                    const parts = lastOrder.orderNo.split('-');
                    const lastSeq = parseInt(parts[parts.length - 1]);
                    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
                }
                orderNo = `SO-${new Date().getFullYear()}-${nextSeq.toString().padStart(4, '0')}`;
            }

            let totalAmount = 0;
            const items = data.items.map(item => {
                const total = item.qty * item.rate;
                totalAmount += total;
                return {
                    productId: item.productId,
                    variantId: item.variantId || null,
                    unitId: item.unitId || null,
                    qty: item.qty,
                    rate: item.rate,
                    taxCodeId: item.taxCodeId,
                    total: total
                };
            });

            return await tx.salesOrder.create({
                data: {
                    orderNo: orderNo,
                    customerId: customer.id,
                    warehouseId: data.warehouseId,
                    date: data.date,
                    expectedDate: data.expectedDate,
                    quoteId: data.quoteId,
                    totalAmount: totalAmount,
                    items: {
                        create: items
                    }
                },
                include: { items: true }
            });
        });
    }

    /**
     * Creates a Delivery Order (DO) and updates Stock Ledger (Qty Out)
     * Mirrors PurchaseService.createGRN
     */
    static async createDO(data: DeliveryOrderInput) {
        // 0. Validate Stock Availability
        const { StockService } = await import("./stock.service");
        // Only validate if we are shipping out real items
        await StockService.validateStockAvailability(data.warehouseId, data.items.map(i => ({ productId: i.productId, variantId: i.variantId, qty: i.qtyShipped })));

        return await prisma.$transaction(async (tx) => {
            const customer = await this.resolveCustomer(tx, data.customerId);
            if (!customer) throw new Error("Customer not found.");

            // Auto-generate DO No if not provided
            let doNo = data.doNo;
            if (!doNo) {
                const lastDO = await tx.deliveryOrder.findFirst({
                    where: { doNo: { startsWith: `DO-${new Date().getFullYear()}-` } },
                    orderBy: { doNo: 'desc' }
                });
                let nextSeq = 1;
                if (lastDO) {
                    const parts = lastDO.doNo.split('-');
                    const lastSeq = parseInt(parts[parts.length - 1]);
                    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
                }
                doNo = `DO-${new Date().getFullYear()}-${nextSeq.toString().padStart(4, '0')}`;
            }

            // 1. Create DO
            const deliveryOrder = await tx.deliveryOrder.create({
                data: {
                    doNo: doNo,
                    orderId: data.orderId,
                    customerId: customer.id,
                    warehouseId: data.warehouseId,
                    date: data.date,
                    remarks: data.remarks,
                    items: {
                        create: data.items.map(item => ({
                            productId: item.productId,
                            variantId: item.variantId || null,
                            unitId: item.unitId || null,
                            soItemId: item.orderItemId || null,
                            qty: item.qtyShipped
                        }))
                    }
                },
                include: { items: true }
            });

            // 2. Update Stock Ledger (Qty Out)
            for (const item of data.items) {
                await tx.stockLedger.create({
                    data: {
                        productId: item.productId,
                        variantId: item.variantId || null,
                        warehouseId: data.warehouseId,
                        date: data.date,
                        qtyOut: item.qtyShipped,
                        qtyIn: 0,
                        refType: "DO",
                        refId: deliveryOrder.id
                    }
                });

                // Update fulfilledQty in SalesOrderItem if linked
                if (item.orderItemId) {
                    await tx.salesOrderItem.update({
                        where: { id: item.orderItemId },
                        data: { fulfilledQty: { increment: item.qtyShipped } }
                    });
                }
            }

            return deliveryOrder;
        });
    }

    /**
     * Creates a Sales Invoice, updates Stock (if no DO), and generates Auto JV
     * Mirrors PurchaseService.createPurchaseInvoice exactly.
     */
    static async createSalesInvoice(data: SalesInvoiceInput) {
        const isDOMandatory = await GlobalSettingsService.getBoolean('DO_MANDATORY', false);
        if (isDOMandatory && !data.doId) {
            throw new Error("Delivery Order is mandatory for Sales Invoicing.");
        }

        if (!data.doId && !data.warehouseId) {
            // If no DO, we need warehouse to deduct stock
            throw new Error("Warehouse is required for Direct Sales Invoices.");
        }

        if (!data.doId && data.warehouseId) {
            const { StockService } = await import("./stock.service");
            await StockService.validateStockAvailability(data.warehouseId, data.items);
        }

        try {
            return await prisma.$transaction(async (tx) => {
                // Auto-generate Invoice No if not provided
                let invoiceNo = data.invoiceNo;
                if (!invoiceNo) {
                    const lastInvoice = await tx.salesInvoice.findFirst({
                        where: { invoiceNo: { startsWith: `SI-${new Date().getFullYear()}-` } },
                        orderBy: { invoiceNo: 'desc' }
                    });
                    let nextSeq = 1;
                    if (lastInvoice) {
                        const parts = lastInvoice.invoiceNo.split('-');
                        const lastSeq = parseInt(parts[parts.length - 1]);
                        if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
                    }
                    invoiceNo = `SI-${new Date().getFullYear()}-${nextSeq.toString().padStart(4, '0')}`;
                }

                // 1. Calculate totals and gather account info
                let totalTaxAmount = 0;
                let totalSubtotal = 0;
                const journalLines = [];

                const customer = await this.resolveCustomer(tx, data.customerId);
                if (!customer?.receivableAccountId) throw new Error("Customer not found or Linked Receivable Account is missing.");

                const invoiceItems = [];

                // Helper to get Product for Account Mapping
                for (const item of data.items) {
                    const subtotal = item.qty * item.rate;
                    totalSubtotal += subtotal;

                    // Handle Tax
                    let taxAmount = 0;
                    if (item.taxCodeId) {
                        const taxCode = await tx.taxCode.findUnique({ where: { id: item.taxCodeId } });
                        if (taxCode) {
                            taxAmount = subtotal * (Number(taxCode.rate) / 100);
                            totalTaxAmount += taxAmount;

                            if (taxCode.accountId) {
                                journalLines.push({
                                    accountId: taxCode.accountId,
                                    credit: taxAmount, // Liability
                                    narration: `Tax for ${data.invoiceNo}`
                                });
                            }
                        }
                    }

                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    if (!product) throw new Error(`Product ${item.productId} not found.`);

                    // REVENUE (Sales) - Credit
                    const salesAccount = product.salesAccountId;
                    if (!salesAccount) throw new Error(`Product ${product.name} missing Sales Account mapping.`);

                    journalLines.push({
                        accountId: salesAccount,
                        credit: subtotal,
                        narration: `Sales of ${product.name}`
                    });

                    // COGS / INVENTORY (Perpetual Inventory)
                    // PurchaseService does NOT do COGS/Inventory entry on Invoice if it's just "Purchase".
                    // However, Sales DOES need it to balance inventory.
                    // We will keep it because without it, Inventory Asset account never decreases.

                    let costRate = 0;
                    // Logic to find cost... 
                    if (product.inventoryAccountId && product.cogsAccountId) {
                        const lastStock = await tx.stockLedger.findFirst({
                            where: { productId: item.productId, qtyIn: { gt: 0 }, costRate: { gt: 0 } },
                            orderBy: { date: 'desc' }
                        });
                        costRate = lastStock ? Number(lastStock.costRate) : 0;
                        const costAmount = item.qty * costRate;

                        if (costAmount > 0) {
                            journalLines.push({
                                accountId: product.cogsAccountId,
                                debit: costAmount,
                                narration: `COGS for ${product.name}`
                            });
                            journalLines.push({
                                accountId: product.inventoryAccountId,
                                credit: costAmount,
                                narration: `Stock Out for ${product.name}`
                            });
                        }
                    }

                    invoiceItems.push({
                        productId: item.productId,
                        variantId: item.variantId || null,
                        unitId: item.unitId || null,
                        qty: item.qty,
                        rate: item.rate,
                        taxCodeId: item.taxCodeId,
                        taxAmount: taxAmount,
                        total: subtotal + taxAmount
                    });
                }

                const totalInvoiceAmount = totalSubtotal + totalTaxAmount;

                // DEBIT Customer Receivable
                journalLines.push({
                    accountId: customer.receivableAccountId,
                    debit: totalInvoiceAmount,
                    narration: `Receivable from ${customer.name} for ${data.invoiceNo}`
                });

                // 2. Create Journal Entry (Voucher) - BEFORE Invoice
                const voucherNo = `SALV-${Date.now()}`;
                const journalEntry = await tx.journalEntry.create({
                    data: {
                        number: voucherNo,
                        date: data.date,
                        type: "SALES",
                        reference: data.invoiceNo,
                        narration: `Auto generated for Sales Invoice ${data.invoiceNo}`,
                        lines: {
                            create: journalLines.map(line => ({
                                accountId: line.accountId,
                                debit: line.debit || 0,
                                credit: line.credit || 0,
                                narration: line.narration
                            }))
                        }
                    }
                });

                // 3. Create Sales Invoice (Linked to JE)
                const invoice = await tx.salesInvoice.create({
                    data: {
                        invoiceNo: invoiceNo,
                        customerId: customer.id,
                        warehouseId: data.warehouseId,
                        orderId: data.orderId || null,
                        date: data.date,
                        dueDate: data.dueDate,
                        totalAmount: totalInvoiceAmount,
                        taxAmount: totalTaxAmount,
                        doId: data.doId,
                        journalEntryId: journalEntry.id, // Linked Here
                        items: {
                            create: invoiceItems
                        }
                    },
                    include: { items: true }
                });

                // 4. Update Stock Ledger & Track Quantities
                if (data.doId) {
                    // Update exisiting DO entries to point to Invoice (Mirroring Purchase)
                    for (const item of data.items) {
                        // Get cost rate for this specific item
                        const product = await tx.product.findUnique({ where: { id: item.productId } });
                        let itemCostRate = 0;
                        if (product?.inventoryAccountId && product?.cogsAccountId) {
                            const lastStock = await tx.stockLedger.findFirst({
                                where: { productId: item.productId, qtyIn: { gt: 0 }, costRate: { gt: 0 } },
                                orderBy: { date: 'desc' }
                            });
                            itemCostRate = lastStock ? Number(lastStock.costRate) : 0;
                        }

                        await tx.stockLedger.updateMany({
                            where: {
                                refType: "DO",
                                refId: data.doId,
                                productId: item.productId,
                                variantId: item.variantId || null
                            },
                            data: {
                                refType: "SALES_INVOICE",
                                refId: invoice.id,
                                costRate: itemCostRate
                            }
                        });

                        // Track Invoiced Qty in SO Items
                        if (item.soItemId) {
                            await tx.salesOrderItem.update({
                                where: { id: item.soItemId },
                                data: { invoicedQty: { increment: item.qty } }
                            });
                        }
                    }
                } else {
                    // Create new entries
                    for (const item of data.items) {
                        // Get cost rate for this specific item
                        const product = await tx.product.findUnique({ where: { id: item.productId } });
                        let itemCostRate = 0;
                        if (product?.inventoryAccountId && product?.cogsAccountId) {
                            const lastStock = await tx.stockLedger.findFirst({
                                where: { productId: item.productId, qtyIn: { gt: 0 }, costRate: { gt: 0 } },
                                orderBy: { date: 'desc' }
                            });
                            itemCostRate = lastStock ? Number(lastStock.costRate) : 0;
                        }

                        await tx.stockLedger.create({
                            data: {
                                productId: item.productId,
                                variantId: item.variantId || null,
                                warehouseId: data.warehouseId!,
                                date: data.date,
                                qtyOut: item.qty, // OUT for Sales
                                qtyIn: 0,
                                costRate: itemCostRate,
                                refType: "SALES_INVOICE",
                                refId: invoice.id
                            }
                        });

                        // Track Invoiced Qty in SO Items
                        if (item.soItemId) {
                            await tx.salesOrderItem.update({
                                where: { id: item.soItemId },
                                data: { invoicedQty: { increment: item.qty } }
                            });
                        }
                    }
                }

                // 5. Automatic Order Status Update
                const orderId = data.orderId || (data.doId ? (await tx.deliveryOrder.findUnique({ where: { id: data.doId } }))?.orderId : null);
                if (orderId) {
                    const orderItems = await tx.salesOrderItem.findMany({ where: { orderId } });
                    const isFullyInvoiced = orderItems.every(it => Number(it.invoicedQty) >= Number(it.qty));
                    if (isFullyInvoiced) {
                        await tx.salesOrder.update({
                            where: { id: orderId },
                            data: { status: "CLOSED" }
                        });
                    }
                }

                return invoice;
            });
        } catch (error: any) {
            const logPath = path.join(process.cwd(), 'sales-error.log');
            const logEntry = `[${new Date().toISOString()}] Error in createSalesInvoice: ${error.message}\nStack: ${error.stack}\nData: ${JSON.stringify(data)}\n\n`;
            fs.appendFileSync(logPath, logEntry);
            throw error;
        }
    }

    /**
     * Creates a Sales Return, updates Stock, and generates reversal JV
     * Mirrors PurchaseService.createReturn
     */
    static async createSalesReturn(data: {
        invoiceId?: string;
        customerId: string;
        warehouseId: string;
        date: Date;
        remarks?: string;
        items: {
            productId: string;
            variantId?: string;
            qty: number;
            rate: number;
            unitId?: string;
        }[];
    }) {
        return await prisma.$transaction(async (tx) => {
            // 1. Validate & Fetch Data
            let invoice;
            if (data.invoiceId) {
                invoice = await tx.salesInvoice.findUnique({
                    where: { id: data.invoiceId },
                    include: {
                        customer: { include: { receivableAccount: true } },
                        items: true
                    }
                });
                if (!invoice) throw new Error("Sales Invoice not found.");
            }

            let customer = invoice?.customer || await this.resolveCustomer(tx, data.customerId);
            if (!customer) throw new Error("Customer not found.");
            if (!customer.receivableAccount) throw new Error("Customer Receivable Account not configured.");

            const warehouse = await tx.warehouse.findUnique({ where: { id: data.warehouseId } });
            if (!warehouse) throw new Error("Warehouse not found.");

            // 2. Generate Return No
            // SR-YYYY-XXXX
            const lastReturn = await tx.salesReturn.findFirst({
                where: { returnNo: { startsWith: `SR-${new Date().getFullYear()}-` } },
                orderBy: { returnNo: 'desc' }
            });
            let nextSeq = 1;
            if (lastReturn) {
                const parts = lastReturn.returnNo.split('-');
                const lastSeq = parseInt(parts[parts.length - 1]);
                if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
            }
            const returnNo = `SR-${new Date().getFullYear()}-${nextSeq.toString().padStart(4, '0')}`;

            // 3. Process Items & Journal Lines
            const journalLines = [];
            let totalReturnAmount = 0;
            const returnItemsData = [];

            for (const item of data.items) {
                const subtotal = item.qty * item.rate;
                totalReturnAmount += subtotal;

                const product = await tx.product.findUnique({ where: { id: item.productId } });
                const salesAccount = product?.salesAccountId;
                if (!salesAccount) throw new Error(`Product ${item.productId} missing Sales Account.`);

                // DEBIT Revenue (Reversal)
                journalLines.push({
                    accountId: salesAccount,
                    debit: subtotal,
                    credit: 0,
                    narration: `Sales Return - ${product?.name}`
                });

                // Note: Reversing COGS not implemented to maintain structure simplicity as discussed.

                returnItemsData.push({
                    productId: item.productId,
                    variantId: item.variantId || null,
                    unitId: item.unitId || null,
                    qty: item.qty,
                    rate: item.rate,
                    total: subtotal
                });
            }

            // CREDIT Customer Link (Reversal of Receivable)
            journalLines.push({
                accountId: customer.receivableAccountId!,
                credit: totalReturnAmount,
                narration: `Credit to ${customer.name} for Return`
            });

            // 4. Create Reversal Journal Entry
            const voucherNo = `SRRET-${Date.now()}`;
            const journalEntry = await tx.journalEntry.create({
                data: {
                    number: voucherNo,
                    date: data.date,
                    type: "SALES_RETURN",
                    reference: returnNo,
                    narration: `Sales Return ${returnNo} from ${customer.name}. ${data.remarks || ""}`,
                    lines: {
                        create: journalLines.map(line => ({
                            accountId: line.accountId,
                            debit: line.debit || 0,
                            credit: line.credit || 0,
                            narration: line.narration
                        }))
                    }
                }
            });

            // 5. Create Sales Return
            const salesReturn = await tx.salesReturn.create({
                data: {
                    returnNo,
                    invoiceId: invoice?.id, // Optional link
                    customerId: customer.id,
                    warehouseId: warehouse.id,
                    date: data.date,
                    totalAmount: totalReturnAmount,
                    remarks: data.remarks,
                    journalEntryId: journalEntry.id,
                    items: {
                        create: returnItemsData
                    }
                }
            });

            // 6. Stock In (Return)
            for (const item of data.items) {
                await tx.stockLedger.create({
                    data: {
                        productId: item.productId,
                        variantId: item.variantId || null,
                        warehouseId: warehouse.id,
                        date: data.date,
                        qtyIn: item.qty, // IN for Return
                        qtyOut: 0,
                        refType: "SALES_RETURN", // Correction: Purchase uses "RETURN". Sales uses "SALES_RETURN" to be safe.
                        refId: salesReturn.id
                    }
                });
            }

            return salesReturn;
        });
    }

    /**
     * Delete Sales Order
     */
    static async deleteOrder(id: string) {
        return await prisma.$transaction(async (tx) => {
            const order = await tx.salesOrder.findUnique({
                where: { id },
                include: { _count: { select: { deliveryOrders: true, invoices: true } } }
            });

            if (!order) throw new Error("Sales Order not found.");
            if (order._count.deliveryOrders > 0 || order._count.invoices > 0) {
                throw new Error("Cannot delete Sales Order with linked Delivery Orders or Invoices.");
            }

            await tx.salesOrderItem.deleteMany({ where: { orderId: id } });
            await tx.salesOrder.delete({ where: { id } });
        });
    }

    /**
     * Delete Delivery Order (DO)
     */
    static async deleteDO(id: string) {
        return await prisma.$transaction(async (tx) => {
            const dn = await tx.deliveryOrder.findUnique({
                where: { id },
                include: {
                    items: true,
                    _count: { select: { invoices: true } }
                }
            });

            if (!dn) throw new Error("Delivery Note not found.");
            if (dn._count.invoices > 0) {
                throw new Error("Cannot delete Delivery Note already invoiced.");
            }

            // 1. Revert Fulfilled Qty in SO
            for (const item of dn.items) {
                if (item.soItemId) {
                    await tx.salesOrderItem.update({
                        where: { id: item.soItemId },
                        data: { fulfilledQty: { decrement: item.qty } }
                    });
                }
            }

            // 2. Remove Stock Ledger
            await tx.stockLedger.deleteMany({
                where: { refType: 'DO', refId: id }
            });

            // 3. Delete Items and DO
            await tx.deliveryOrderItem.deleteMany({ where: { doId: id } });
            await tx.deliveryOrder.delete({ where: { id } });
        });
    }

    /**
     * Delete Sales Invoice
     */
    static async deleteSalesInvoice(id: string) {
        return await prisma.$transaction(async (tx) => {
            const invoice = await tx.salesInvoice.findUnique({
                where: { id },
                include: { items: true }
            });

            if (!invoice) throw new Error("Sales Invoice not found.");

            // 1. Revert Invoiced Qty in SO
            for (const item of invoice.items) {
                if (item.soItemId) {
                    await tx.salesOrderItem.update({
                        where: { id: item.soItemId },
                        data: { invoicedQty: { decrement: item.qty } }
                    });

                    // Check if we need to reopen the order
                    const soItem = await tx.salesOrderItem.findUnique({ where: { id: item.soItemId } });
                    if (soItem && soItem.orderId) {
                        await tx.salesOrder.update({
                            where: { id: soItem.orderId },
                            data: { status: "OPEN" }
                        });
                    }
                }
            }

            // 2. Revert Stock Ledger
            // If it was a DO -> Invoice flow, we updated DO ref to INVOICE.
            // When deleting invoice, we should revert it back to DO or Delete if direct.
            if (invoice.doId) {
                await tx.stockLedger.updateMany({
                    where: { refType: 'SALES_INVOICE', refId: id },
                    data: {
                        refType: 'DO',
                        refId: invoice.doId
                    }
                });
            } else {
                await tx.stockLedger.deleteMany({
                    where: { refType: 'SALES_INVOICE', refId: id }
                });
            }

            // 3. Delete Journal Entry
            if (invoice.journalEntryId) {
                await tx.journalLine.deleteMany({ where: { entryId: invoice.journalEntryId } });
                await tx.journalEntry.delete({ where: { id: invoice.journalEntryId } });
            }

            // 4. Delete Items and Invoice
            await tx.salesInvoiceItem.deleteMany({ where: { invoiceId: id } });
            await tx.salesInvoice.delete({ where: { id } });
        });
    }
}
