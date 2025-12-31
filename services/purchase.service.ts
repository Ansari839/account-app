import prisma from "@/lib/prisma";
import { JournalService } from "./journal.service";
import { GlobalSettingsService } from "./settings.service";
import { Prisma } from "@/app/generated/prisma/client";

export interface PurchaseRequestInput {
    reqNo: string;
    date: Date;
    remarks?: string;
    items: {
        productId: string;
        qty: number;
        description?: string;
    }[];
}

export interface POItemInput {
    productId: string;
    qty: number;
    rate: number;
    taxCodeId?: string;
}

export interface POInput {
    poNo: string;
    supplierId: string;
    warehouseId: string;
    date: Date;
    expectedDate?: Date;
    items: POItemInput[];
}

export interface GRNItemInput {
    productId: string;
    poItemId?: string;
    qtyReceived: number;
    qtyRejected?: number;
}

export interface GRNInput {
    grnNo: string;
    poId?: string;
    supplierId: string;
    warehouseId: string;
    date: Date;
    remarks?: string;
    items: GRNItemInput[];
}

export interface InvoiceItemInput {
    productId: string;
    qty: number;
    rate: number;
    taxCodeId?: string;
}

export interface InvoiceInput {
    invoiceNo: string;
    supplierId: string;
    date: Date;
    dueDate?: Date;
    grnId?: string;
    poId?: string;
    items: InvoiceItemInput[];
}

export class PurchaseService {
    /**
     * Creates a Purchase Request (Internal only, no financial impact)
     */
    static async createRequest(data: PurchaseRequestInput) {
        return await prisma.purchaseRequest.create({
            data: {
                reqNo: data.reqNo,
                date: data.date,
                remarks: data.remarks,
                items: {
                    create: data.items.map(item => ({
                        productId: item.productId,
                        qty: item.qty,
                        description: item.description
                    }))
                }
            },
            include: { items: true }
        });
    }

    /**
     * Creates a Purchase Order (Tracking only, no financial impact)
     */
    static async createPO(data: POInput) {
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

        return await prisma.purchaseOrder.create({
            data: {
                poNo: data.poNo,
                supplierId: data.supplierId,
                warehouseId: data.warehouseId,
                date: data.date,
                expectedDate: data.expectedDate,
                totalAmount: totalAmount,
                items: {
                    create: items
                }
            },
            include: { items: true }
        });
    }

    /**
     * Creates a GRN (Goods Receipt Note) and updates Stock Ledger
     */
    static async createGRN(data: GRNInput) {
        return await prisma.$transaction(async (tx) => {
            // 1. Create GRN
            const grn = await tx.gRN.create({
                data: {
                    grnNo: data.grnNo,
                    poId: data.poId,
                    supplierId: data.supplierId,
                    warehouseId: data.warehouseId,
                    date: data.date,
                    remarks: data.remarks,
                    items: {
                        create: data.items.map(item => ({
                            productId: item.productId,
                            poItemId: item.poItemId,
                            qtyReceived: item.qtyReceived,
                            qtyRejected: item.qtyRejected || 0
                        }))
                    }
                },
                include: { items: true }
            });

            // 2. Update Stock Ledger
            for (const item of data.items) {
                await tx.stockLedger.create({
                    data: {
                        productId: item.productId,
                        warehouseId: data.warehouseId,
                        date: data.date,
                        qtyIn: item.qtyReceived,
                        qtyOut: 0,
                        costRate: 0, // Valuation logic later
                        refType: "GRN",
                        refId: grn.id
                    }
                });
            }

            return grn;
        });
    }

    /**
     * Creates a Purchase Invoice, updates Stock (if no GRN), and generates Auto JV
     */
    static async createPurchaseInvoice(data: InvoiceInput) {
        const isGrnMandatory = await GlobalSettingsService.getBoolean("GRN_MANDATORY", false);
        if (isGrnMandatory && !data.grnId) {
            throw new Error("GRN is mandatory for purchase invoices according to system settings.");
        }

        return await prisma.$transaction(async (tx) => {
            // 1. Calculate totals and gather account info
            let totalTaxAmount = 0;
            let totalSubtotal = 0;
            const journalLines = [];

            // Fetch supplier to get Payable account
            const supplier = await tx.supplier.findUnique({
                where: { id: data.supplierId },
                include: { payableAccount: true }
            });
            if (!supplier?.payableAccountId) throw new Error("Supplier does not have a linked Payable Account.");

            const invoiceItems = [];
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
                                debit: taxAmount,
                                narration: `Tax for ${data.invoiceNo}`
                            });
                        }
                    }
                }

                // Handle Product Account Mapping (DR Inventory/Expense)
                const product = await tx.product.findUnique({ where: { id: item.productId } });
                const debitAccount = product?.purchaseAccountId || product?.inventoryAccountId;
                if (!debitAccount) throw new Error(`Product ${item.productId} is missing Purchase/Inventory Account mapping.`);

                journalLines.push({
                    accountId: debitAccount,
                    debit: subtotal,
                    narration: `Purchase of ${product.name}`
                });

                invoiceItems.push({
                    productId: item.productId,
                    qty: item.qty,
                    rate: item.rate,
                    taxCodeId: item.taxCodeId,
                    taxAmount: taxAmount,
                    total: subtotal + taxAmount
                });
            }

            const totalInvoiceAmount = totalSubtotal + totalTaxAmount;

            // CR Supplier Payable
            journalLines.push({
                accountId: supplier.payableAccountId,
                credit: totalInvoiceAmount,
                narration: `Payable to ${supplier.name} for ${data.invoiceNo}`
            });

            // 2. Create Journal Entry (Voucher)
            // Generate a simple voucher number for now (VCH-...)
            const voucherNo = `PURV-${Date.now()}`;
            const journalEntry = await tx.journalEntry.create({
                data: {
                    number: voucherNo,
                    date: data.date,
                    type: "PURCHASE",
                    reference: data.invoiceNo,
                    narration: `Auto generated for Invoice ${data.invoiceNo}`,
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

            // 3. Create Purchase Invoice
            const invoice = await tx.purchaseInvoice.create({
                data: {
                    invoiceNo: data.invoiceNo,
                    supplierId: data.supplierId,
                    date: data.date,
                    dueDate: data.dueDate,
                    totalAmount: totalInvoiceAmount,
                    taxAmount: totalTaxAmount,
                    grnId: data.grnId,
                    poId: data.poId,
                    journalEntryId: journalEntry.id,
                    items: {
                        create: invoiceItems
                    }
                },
                include: { items: true }
            });

            // 4. Update Stock Ledger if NO GRN was used
            if (!data.grnId) {
                for (const item of data.items) {
                    // We need a warehouse. If not provided in input, we might need a default or error out.
                    // For now, let's assume either we have a default warehouse or we require simplified input.
                    // Requirement says: If GRN not used -> stock in here.
                    // I will add warehouseId to InvoiceInput or fetch default.
                    const defaultWH = await tx.warehouse.findFirst({ where: { isDefault: true } });
                    if (!defaultWH) throw new Error("No default warehouse found to post stock for invoice without GRN.");

                    await tx.stockLedger.create({
                        data: {
                            productId: item.productId,
                            warehouseId: defaultWH.id,
                            date: data.date,
                            qtyIn: item.qty,
                            qtyOut: 0,
                            costRate: item.rate,
                            refType: "INVOICE",
                            refId: invoice.id
                        }
                    });
                }
            }

            return invoice;
        });
    }

    /**
     * Creates a Purchase Return, updates Stock, and generates reversal JV
     */
    static async createReturn(data: {
        purchaseInvoiceId: string,
        date: Date,
        remarks?: string,
        items: { productId: string, qty: number, rate: number }[]
    }) {
        return await prisma.$transaction(async (tx) => {
            const invoice = await tx.purchaseInvoice.findUnique({
                where: { id: data.purchaseInvoiceId },
                include: { supplier: true }
            });
            if (!invoice) throw new Error("Purchase Invoice not found.");

            // 1. Calculate reversal impact
            const journalLines = [];
            let totalReturnAmount = 0;

            for (const item of data.items) {
                const subtotal = item.qty * item.rate;
                totalReturnAmount += subtotal;

                // CR Inventory/Expense (reversal)
                const product = await tx.product.findUnique({ where: { id: item.productId } });
                const creditAccount = product?.purchaseAccountId || product?.inventoryAccountId;
                if (!creditAccount) throw new Error(`Product ${item.productId} missing mapping.`);

                journalLines.push({
                    accountId: creditAccount,
                    credit: subtotal,
                    narration: `Purchase Return for ${invoice.invoiceNo}`
                });

                // Stock Out
                // Fetch default warehouse for stock out
                const defaultWH = await tx.warehouse.findFirst({ where: { isDefault: true } });
                if (!defaultWH) throw new Error("No default warehouse found for return stock move.");

                await tx.stockLedger.create({
                    data: {
                        productId: item.productId,
                        warehouseId: defaultWH.id,
                        date: data.date,
                        qtyIn: 0,
                        qtyOut: item.qty,
                        costRate: item.rate,
                        refType: "RETURN",
                        refId: invoice.id // Referencing the invoice it's returning against
                    }
                });
            }

            // DR Supplier (reversal)
            journalLines.push({
                accountId: invoice.supplier.payableAccountId!,
                debit: totalReturnAmount,
                narration: `Debit to ${invoice.supplier.name} for Return of ${invoice.invoiceNo}`
            });

            // 2. Create Reversal Journal Entry
            const voucherNo = `PRRTV-${Date.now()}`;
            await tx.journalEntry.create({
                data: {
                    number: voucherNo,
                    date: data.date,
                    type: "JOURNAL",
                    reference: invoice.invoiceNo,
                    narration: `Purchase Return for Invoice ${invoice.invoiceNo}. ${data.remarks || ""}`,
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

            return { success: true, amount: totalReturnAmount };
        });
    }
}
