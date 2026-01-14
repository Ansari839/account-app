import prisma from "@/lib/prisma";
import { JournalService } from "./journal.service";
import { GlobalSettingsService } from "./settings.service";
import { SalesQuotation, SalesOrder, DeliveryOrder, SalesInvoice } from '@prisma/client';

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
    orderNo: string;
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
    doNo: string;
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
    invoiceNo: string;
    customerId: string;
    warehouseId?: string;
    date: Date;
    dueDate?: Date;
    doId?: string;
    items: {
        productId: string;
        variantId?: string;
        unitId?: string;
        qty: number;
        rate: number;
        taxCodeId?: string;
    }[];
}

export class SalesService {
    /**
     * Resolves customer from ID or Account ID
     */
    private static async resolveCustomer(tx: any, customerId: string) {
        let customer = await tx.customer.findUnique({
            where: { id: customerId },
            include: { receivableAccount: true }
        });

        if (!customer) {
            customer = await tx.customer.findFirst({
                where: { receivableAccountId: customerId },
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
     * Creates a Sales Order (No inventory/accounting impact yet)
     */
    static async createOrder(data: SalesOrderInput) {
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

            return await tx.salesOrder.create({
                data: {
                    orderNo: data.orderNo,
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
     * Creates a Delivery Order (DO) and updates Stock Ledger
     */
    static async createDO(data: DeliveryOrderInput) {
        // 0. Validate Stock Availability
        const { StockService } = await import("./stock.service");
        await StockService.validateStockAvailability(data.warehouseId, data.items.map(i => ({ productId: i.productId, variantId: i.variantId, qty: i.qtyShipped })));

        return await prisma.$transaction(async (tx) => {
            const customer = await this.resolveCustomer(tx, data.customerId);
            if (!customer) throw new Error("Customer not found.");

            // 1. Create DO
            const deliveryOrder = await tx.deliveryOrder.create({
                data: {
                    doNo: data.doNo,
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
            }

            return deliveryOrder;
        });
    }

    /**
     * Creates a Sales Invoice, generates Auto JV (5 lines), and updates Stock (if no DO)
     */
    static async createSalesInvoice(data: SalesInvoiceInput) {
        // 1. Check Global Settings for DO Mandatory
        const isDOMandatory = await GlobalSettingsService.getBoolean('DO_MANDATORY', false);
        if (isDOMandatory && !data.doId) {
            throw new Error("Delivery Order is mandatory for Sales Invoicing.");
        }

        if (!data.doId && !data.warehouseId) {
            throw new Error("Warehouse is required for Direct Sales Invoices to update inventory.");
        }

        // Validate stock if no DO is used
        if (!data.doId && data.warehouseId) {
            const { StockService } = await import("./stock.service");
            await StockService.validateStockAvailability(data.warehouseId, data.items);
        }

        return await prisma.$transaction(async (tx) => {
            // 2. Calculate Totals and Tax
            let subtotal = 0;
            let totalTax = 0;
            const invoiceItemsData = [];

            for (const item of data.items) {
                const total = item.qty * item.rate;
                subtotal += total;

                let taxAmount = 0;
                if (item.taxCodeId) {
                    const taxCode = await tx.taxCode.findUnique({ where: { id: item.taxCodeId } });
                    if (taxCode) {
                        taxAmount = (total * Number(taxCode.rate)) / 100;
                        totalTax += taxAmount;
                    }
                }

                invoiceItemsData.push({
                    productId: item.productId,
                    variantId: item.variantId || null,
                    unitId: item.unitId || null,
                    qty: item.qty,
                    rate: item.rate,
                    taxCodeId: item.taxCodeId,
                    taxAmount: taxAmount,
                    total: total + taxAmount
                });
            }

            const totalAmount = subtotal + totalTax;

            // Fetch customer carefully
            const customer = await this.resolveCustomer(tx, data.customerId);
            if (!customer) throw new Error("Customer not found.");

            // 3. Create Sales Invoice
            const invoice = await tx.salesInvoice.create({
                data: {
                    invoiceNo: data.invoiceNo,
                    customerId: customer.id,
                    warehouseId: data.warehouseId,
                    date: data.date,
                    dueDate: data.dueDate ? new Date(data.dueDate) : null,
                    doId: data.doId || null,
                    totalAmount: totalAmount,
                    taxAmount: totalTax,
                    items: {
                        create: invoiceItemsData
                    }
                },
                include: { items: { include: { product: true, taxCode: true } }, customer: true }
            });

            // 4. Update Stock Ledger (If no DO)
            if (!data.doId && data.warehouseId) {
                for (const item of data.items) {
                    await tx.stockLedger.create({
                        data: {
                            productId: item.productId,
                            variantId: item.variantId || null,
                            warehouseId: data.warehouseId,
                            date: data.date,
                            qtyOut: item.qty,
                            qtyIn: 0,
                            refType: "SALES_INVOICE",
                            refId: invoice.id
                        }
                    });
                }
            }

            // 5. Generate Automated Journal Entry (5 Lines)
            const jvLines = [];

            // 1. AR Debit
            jvLines.push({
                accountId: invoice.customer.receivableAccountId!,
                debit: totalAmount,
                credit: 0,
                narration: `Sales Invoice ${invoice.invoiceNo}`
            });

            // Iterate items for Revenue, Tax, and COGS/Inventory
            for (const item of invoice.items) {
                // 2. Revenue Credit
                jvLines.push({
                    accountId: item.product.salesAccountId!,
                    debit: 0,
                    credit: Number(item.qty) * Number(item.rate),
                    narration: `Revenue for ${item.product.name}`
                });

                // 3. Tax Credit
                if (item.taxCodeId && item.taxCode?.accountId) {
                    jvLines.push({
                        accountId: item.taxCode.accountId,
                        debit: 0,
                        credit: Number(item.taxAmount),
                        narration: `Tax on ${item.product.name}`
                    });
                }

                // 4 & 5. COGS / Inventory
                const lastPurchase = await tx.purchaseInvoiceItem.findFirst({
                    where: {
                        productId: item.productId,
                        // @ts-ignore
                        variantId: item.variantId ? { equals: item.variantId } : null
                    },
                    orderBy: { invoice: { date: 'desc' } }
                });

                let costRate = lastPurchase ? Number(lastPurchase.rate) : 0;

                // Fallback: If no purchase history (e.g., Opening Stock or Cleaned Data), checks Stock Ledger
                if (costRate === 0) {
                    const lastStockEntry = await tx.stockLedger.findFirst({
                        where: {
                            productId: item.productId,
                            // @ts-ignore
                            variantId: item.variantId ? { equals: item.variantId } : null,
                            qtyIn: { gt: 0 },
                            costRate: { gt: 0 }
                        },
                        orderBy: { date: 'desc' }
                    });
                    if (lastStockEntry) {
                        costRate = Number(lastStockEntry.costRate);
                    }
                }

                const costAmount = Number(item.qty) * costRate;

                if (costAmount > 0) {
                    jvLines.push({
                        accountId: item.product.cogsAccountId!,
                        debit: costAmount,
                        credit: 0,
                        narration: `COGS for ${item.product.name}`
                    });

                    jvLines.push({
                        accountId: item.product.inventoryAccountId!,
                        debit: 0,
                        credit: costAmount,
                        narration: `Stock out for ${item.product.name}`
                    });
                }
            }

            const journalEntry = await JournalService.createEntry({
                number: `SALV-${Date.now()}`,
                date: data.date,
                type: "SALES" as any,
                reference: invoice.invoiceNo,
                narration: `Automated JV for Sales Invoice ${invoice.invoiceNo}`,
                lines: jvLines
            }, tx);

            // Link Invoice to JV
            await tx.salesInvoice.update({
                where: { id: invoice.id },
                data: { journalEntryId: journalEntry.id }
            });

            return { ...invoice, journalEntryId: journalEntry.id };
        });
    }

    /**
     * Creates a Sales Return, reverses accounting and stock impacts
     */
    static async createSalesReturn(data: {
        invoiceId: string;
        date: Date;
        remarks?: string;
        warehouseId?: string;
        items: {
            productId: string;
            variantId?: string;
            qty: number;
            rate: number;
            unitId?: string;
        }[];
    }) {
        return await prisma.$transaction(async (tx) => {
            // 1. Fetch original invoice and items for tax/account info
            const originalInvoice = await tx.salesInvoice.findUnique({
                where: { id: data.invoiceId },
                include: { items: { include: { product: true, taxCode: true } }, customer: true }
            });

            if (!originalInvoice) throw new Error("Original Sales Invoice not found.");

            const warehouseId = data.warehouseId || originalInvoice.warehouseId || (await tx.warehouse.findFirst({ where: { isDefault: true } }))?.id;
            if (!warehouseId) throw new Error("Warehouse is required for return.");

            // 2. Calculate Return Totals
            let returnSubtotal = 0;
            let returnTax = 0;
            const returnItemsData = [];

            for (const item of data.items) {
                // @ts-ignore
                const origItem = originalInvoice.items.find(i => i.productId === item.productId && i.variantId === (item.variantId || null));
                if (!origItem) throw new Error(`Product ${item.productId} not found in original invoice.`);

                const total = Number(item.qty) * Number(item.rate);
                returnSubtotal += total;

                let taxAmount = 0;
                if (origItem.taxCodeId) {
                    taxAmount = (total * Number(origItem.taxCode!.rate)) / 100;
                    returnTax += taxAmount;
                }

                returnItemsData.push({
                    productId: item.productId,
                    variantId: item.variantId || null,
                    unitId: item.unitId || origItem.unitId,
                    qty: item.qty,
                    rate: item.rate,
                    taxAmount: taxAmount,
                    total: total + taxAmount,
                    invoiceItemId: origItem.id
                });
            }

            const returnTotalAmount = returnSubtotal + returnTax;

            // 3. Create Sales Return
            const salesReturn = await tx.salesReturn.create({
                data: {
                    returnNo: `SR-${Date.now()}`,
                    invoiceId: data.invoiceId,
                    customerId: originalInvoice.customerId,
                    warehouseId: warehouseId,
                    date: new Date(data.date),
                    totalAmount: returnTotalAmount,
                    remarks: data.remarks,
                    items: {
                        create: returnItemsData
                    }
                },
                include: { items: { include: { product: true } } }
            });

            // 4. Update Stock Ledger (Qty In)
            for (const item of data.items) {
                await tx.stockLedger.create({
                    data: {
                        productId: item.productId,
                        variantId: item.variantId || null,
                        warehouseId: warehouseId,
                        date: new Date(data.date),
                        qtyIn: item.qty,
                        qtyOut: 0,
                        refType: "SALES_RETURN",
                        refId: salesReturn.id
                    }
                });
            }

            // 5. Generate Reversal Journal Entry
            const jvLines = [];

            // 1. AR Credit
            jvLines.push({
                accountId: originalInvoice.customer.receivableAccountId!,
                debit: 0,
                credit: returnTotalAmount,
                narration: `Sales Return ${salesReturn.returnNo} for INV ${originalInvoice.invoiceNo}`
            });

            for (const item of salesReturn.items) {
                // 2. Sales Debit (Reversal)
                jvLines.push({
                    accountId: item.product.salesAccountId!,
                    debit: Number(item.qty) * Number(item.rate),
                    credit: 0,
                    narration: `Sales Reversal for ${item.product.name}`
                });

                // 3. Tax Debit (Reversal)
                // @ts-ignore
                const origItem = originalInvoice.items.find(i => i.productId === item.productId && i.variantId === (item.variantId || null));
                if (origItem?.taxCodeId && origItem.taxCode?.accountId) {
                    jvLines.push({
                        accountId: origItem.taxCode.accountId,
                        debit: Number(item.taxAmount),
                        credit: 0,
                        narration: `Tax Reversal on ${item.product.name}`
                    });
                }

                // 4 & 5. Inventory/COGS Reversal
                const lastPurchase = await tx.purchaseInvoiceItem.findFirst({
                    where: {
                        productId: item.productId,
                        // @ts-ignore
                        variantId: item.variantId ? { equals: item.variantId } : null
                    },
                    orderBy: { invoice: { date: 'desc' } }
                });

                let costRate = lastPurchase ? Number(lastPurchase.rate) : 0;

                if (costRate === 0) {
                    const lastStockEntry = await tx.stockLedger.findFirst({
                        where: {
                            productId: item.productId,
                            // @ts-ignore
                            variantId: item.variantId ? { equals: item.variantId } : null,
                            qtyIn: { gt: 0 },
                            costRate: { gt: 0 }
                        },
                        orderBy: { date: 'desc' }
                    });
                    if (lastStockEntry) {
                        costRate = Number(lastStockEntry.costRate);
                    }
                }

                const costAmount = Number(item.qty) * costRate;

                if (costAmount > 0) {
                    jvLines.push({
                        accountId: item.product.inventoryAccountId!,
                        debit: costAmount,
                        credit: 0,
                        narration: `Stock return for ${item.product.name}`
                    });

                    jvLines.push({
                        accountId: item.product.cogsAccountId!,
                        debit: 0,
                        credit: costAmount,
                        narration: `COGS Reversal for ${item.product.name}`
                    });
                }
            }

            const journalEntry = await JournalService.createEntry({
                number: `SRJV-${Date.now()}`,
                date: data.date,
                type: "SALES" as any,
                reference: salesReturn.returnNo,
                narration: `Automated Reversal JV for Sales Return ${salesReturn.returnNo}`,
                lines: jvLines
            }, tx);

            // Link Return to JV
            await tx.salesReturn.update({
                where: { id: salesReturn.id },
                data: { journalEntryId: journalEntry.id }
            });

            return { success: true, returnId: salesReturn.id, journalEntryId: journalEntry.id };
        });
    }
}
