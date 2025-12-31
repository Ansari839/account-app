import prisma from "@/lib/prisma";
import { JournalService } from "./journal.service";
import { GlobalSettingsService } from "./settings.service";
import { Prisma } from "@/app/generated/prisma/client";

export interface SalesQuotationInput {
    quoteNo: string;
    customerId: string;
    date: Date;
    validUntil?: Date;
    items: {
        productId: string;
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
        qty: number;
        rate: number;
        taxCodeId?: string;
    }[];
}

export class SalesService {
    /**
     * Creates a Sales Quotation (No inventory/accounting impact)
     */
    static async createQuotation(data: SalesQuotationInput) {
        let totalAmount = 0;
        const items = data.items.map(item => {
            const total = item.qty * item.rate;
            totalAmount += total;
            return {
                productId: item.productId,
                qty: item.qty,
                rate: item.rate,
                taxCodeId: item.taxCodeId,
                total: total
            };
        });

        return await prisma.salesQuotation.create({
            data: {
                quoteNo: data.quoteNo,
                customerId: data.customerId,
                date: data.date,
                validUntil: data.validUntil,
                totalAmount: totalAmount,
                items: {
                    create: items
                }
            },
            include: { items: true }
        });
    }

    /**
     * Creates a Sales Order (No inventory/accounting impact yet)
     */
    static async createOrder(data: SalesOrderInput) {
        let totalAmount = 0;
        const items = data.items.map(item => {
            const total = item.qty * item.rate;
            totalAmount += total;
            return {
                productId: item.productId,
                qty: item.qty,
                rate: item.rate,
                taxCodeId: item.taxCodeId,
                total: total
            };
        });

        return await prisma.salesOrder.create({
            data: {
                orderNo: data.orderNo,
                customerId: data.customerId,
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
    }

    /**
     * Creates a Delivery Order (DO) and updates Stock Ledger
     */
    static async createDO(data: DeliveryOrderInput) {
        return await prisma.$transaction(async (tx) => {
            // 1. Create DO
            const deliveryOrder = await tx.deliveryOrder.create({
                data: {
                    doNo: data.doNo,
                    orderId: data.orderId,
                    customerId: data.customerId,
                    warehouseId: data.warehouseId,
                    date: data.date,
                    remarks: data.remarks,
                    items: {
                        create: data.items.map(item => ({
                            productId: item.productId,
                            orderItemId: item.orderItemId,
                            qtyShipped: item.qtyShipped
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
                    qty: item.qty,
                    rate: item.rate,
                    taxCodeId: item.taxCodeId,
                    taxAmount: taxAmount,
                    total: total + taxAmount
                });
            }

            const totalAmount = subtotal + totalTax;

            // 3. Create Sales Invoice
            const invoice = await tx.salesInvoice.create({
                data: {
                    invoiceNo: data.invoiceNo,
                    customerId: data.customerId,
                    warehouseId: data.warehouseId,
                    date: data.date,
                    dueDate: data.dueDate,
                    doId: data.doId,
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
                    where: { productId: item.productId },
                    orderBy: { invoice: { date: 'desc' } }
                });
                const costRate = lastPurchase ? Number(lastPurchase.rate) : 0;
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
        items: {
            productId: string;
            qty: number;
            rate: number;
        }[];
    }) {
        return await prisma.$transaction(async (tx) => {
            // 1. Fetch original invoice and items for tax/account info
            const originalInvoice = await tx.salesInvoice.findUnique({
                where: { id: data.invoiceId },
                include: { items: { include: { product: true, taxCode: true } }, customer: true }
            });

            if (!originalInvoice) throw new Error("Original Sales Invoice not found.");

            // 2. Calculate Return Totals
            let returnSubtotal = 0;
            let returnTax = 0;
            const returnItemsData = [];

            for (const item of data.items) {
                const origItem = originalInvoice.items.find(i => i.productId === item.productId);
                if (!origItem) throw new Error(`Product ${item.productId} not found in original invoice.`);

                const total = item.qty * item.rate;
                returnSubtotal += total;

                let taxAmount = 0;
                if (origItem.taxCodeId) {
                    taxAmount = (total * Number(origItem.taxCode!.rate)) / 100;
                    returnTax += taxAmount;
                }

                returnItemsData.push({
                    productId: item.productId,
                    qty: item.qty,
                    rate: item.rate,
                    taxAmount: taxAmount,
                    total: total + taxAmount
                });
            }

            const returnTotalAmount = returnSubtotal + returnTax;

            // 3. Create Sales Return
            const salesReturn = await tx.salesReturn.create({
                data: {
                    returnNo: `SR-${Date.now()}`,
                    invoiceId: data.invoiceId,
                    customerId: originalInvoice.customerId,
                    date: data.date,
                    totalAmount: returnTotalAmount,
                    taxAmount: returnTax,
                    remarks: data.remarks,
                    items: {
                        create: returnItemsData
                    }
                },
                include: { items: { include: { product: true } } }
            });

            // 4. Update Stock Ledger (Qty In)
            // Note: Returns increase stock
            for (const item of data.items) {
                await tx.stockLedger.create({
                    data: {
                        productId: item.productId,
                        warehouseId: originalInvoice.warehouseId || (await tx.warehouse.findFirst({ where: { isDefault: true } }))?.id || "",
                        date: data.date,
                        qtyIn: item.qty,
                        qtyOut: 0,
                        refType: "SALES_RETURN",
                        refId: salesReturn.id
                    }
                });
            }

            // 5. Generate Reversal Journal Entry
            // Reversal Lines:
            // 1. DR Sales Revenue
            // 2. DR Output Tax
            // 3. CR Accounts Receivable (Customer)
            // 4. DR Inventory (Re-entry)
            // 5. CR COGS (Reversal)

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
                const origItem = originalInvoice.items.find(i => i.productId === item.productId);
                if (origItem?.taxCodeId && origItem.taxCode?.accountId) {
                    jvLines.push({
                        accountId: origItem.taxCode.accountId,
                        debit: Number(item.taxAmount),
                        credit: 0,
                        narration: `Tax Reversal on ${item.product.name}`
                    });
                }

                // 4 & 5. Inventory/COGS Reversal
                // Find last purchase for costing reversal
                const lastPurchase = await tx.purchaseInvoiceItem.findFirst({
                    where: { productId: item.productId },
                    orderBy: { invoice: { date: 'desc' } }
                });
                const costRate = lastPurchase ? Number(lastPurchase.rate) : 0;
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
