import prisma from "@/lib/prisma";
import { JournalService } from "./journal.service";
import { GlobalSettingsService } from "./settings.service";
import { PurchaseOrder, GRN, PurchaseInvoice } from '@prisma/client';

export interface PurchaseRequestInput {
    reqNo: string;
    date: Date;
    remarks?: string;
    items: {
        productId: string;
        variantId?: string;
        qty: number;
        description?: string;
    }[];
}

export interface POItemInput {
    productId: string;
    variantId?: string;
    unitId?: string;
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
    variantId?: string;
    unitId?: string;
    poItemId?: string;
    qtyReceived: number;
    qtyRejected?: number;
    rate?: number;
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
    variantId?: string;
    unitId?: string;
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
                        variantId: item.variantId || null,
                        qty: item.qty,
                        description: item.description
                    }))
                }
            },
            include: { items: true }
        });
    }

    /**
     * Resolves supplier from ID or Account ID
     */
    private static async resolveSupplier(tx: any, supplierId: string) {
        let supplier = await tx.supplier.findUnique({
            where: { id: supplierId },
            include: { payableAccount: true }
        });

        if (!supplier) {
            supplier = await tx.supplier.findFirst({
                where: { payableAccountId: supplierId },
                include: { payableAccount: true }
            });
        }
        return supplier;
    }

    /**
     * Creates a Purchase Order (Tracking only, no financial impact)
     */
    static async createOrder(data: POInput) {
        return await prisma.$transaction(async (tx) => {
            const supplier = await this.resolveSupplier(tx, data.supplierId);
            if (!supplier) throw new Error("Supplier not found.");

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

            return await tx.purchaseOrder.create({
                data: {
                    poNo: data.poNo,
                    supplierId: supplier.id,
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
        });
    }

    /**
     * Creates a Goods Received Note (GRN) and updates Stock Ledger
     */
    static async createGRN(data: GRNInput) {
        return await prisma.$transaction(async (tx) => {
            const supplier = await this.resolveSupplier(tx, data.supplierId);
            if (!supplier) throw new Error("Supplier not found.");

            // 1. Create GRN
            const grn = await tx.gRN.create({
                data: {
                    grnNo: data.grnNo,
                    poId: data.poId,
                    supplierId: supplier.id,
                    warehouseId: data.warehouseId,
                    date: data.date,
                    remarks: data.remarks,
                    items: {
                        create: data.items.map(item => ({
                            productId: item.productId,
                            variantId: item.variantId || null,
                            unitId: item.unitId || null,
                            poItemId: item.poItemId,
                            qtyReceived: item.qtyReceived,
                            qtyRejected: item.qtyRejected || 0,
                            rate: item.rate || 0
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
                        variantId: item.variantId || null,
                        warehouseId: data.warehouseId,
                        date: data.date,
                        qtyIn: item.qtyReceived,
                        qtyOut: 0,
                        costRate: item.rate || 0,
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

            // Fetch supplier to get Payable account using helper
            const supplier = await this.resolveSupplier(tx, data.supplierId);
            if (!supplier?.payableAccountId) throw new Error("Supplier not found or linked Payable Account is missing.");

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

            // 4. Update Stock Ledger (Precedence: Invoice > GRN)
            if (data.grnId) {
                // If GRN exists, update existing stock ledger entries to point to Invoice
                for (const item of data.items) {
                    await tx.stockLedger.updateMany({
                        where: {
                            refType: "GRN",
                            refId: data.grnId,
                            productId: item.productId,
                            variantId: item.variantId || null
                        },
                        data: {
                            refType: "INVOICE",
                            refId: invoice.id,
                            costRate: item.rate
                        }
                    });
                }
            } else {
                // If NO GRN was used, create new stock entries
                for (const item of data.items) {
                    const defaultWH = await tx.warehouse.findFirst({ where: { isDefault: true } });
                    if (!defaultWH && !data.poId) throw new Error("No default warehouse found to post stock for invoice without GRN.");

                    // If PO is linked, try to get warehouse from PO
                    let warehouseId = defaultWH?.id;
                    if (data.poId) {
                        const po = await tx.purchaseOrder.findUnique({ where: { id: data.poId } });
                        if (po?.warehouseId) warehouseId = po.warehouseId;
                    }

                    if (!warehouseId) throw new Error("Warehouse ID could not be determined for stock posting.");

                    await tx.stockLedger.create({
                        data: {
                            productId: item.productId,
                            variantId: item.variantId || null,
                            warehouseId: warehouseId,
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
        purchaseInvoiceId?: string;
        supplierId: string;
        warehouseId: string;
        date: Date;
        remarks?: string;
        items: {
            productId: string;
            variantId?: string;
            unitId?: string;
            qty: number;
            rate: number;
        }[];
    }) {
        // 0. Validate Stock Availability
        const { StockService } = await import("./stock.service");
        await StockService.validateStockAvailability(data.warehouseId, data.items);

        return await prisma.$transaction(async (tx) => {
            // 1. Validate & Fetch Data
            let invoice;
            if (data.purchaseInvoiceId) {
                invoice = await tx.purchaseInvoice.findUnique({
                    where: { id: data.purchaseInvoiceId },
                    include: {
                        supplier: { include: { payableAccount: true } },
                        items: true
                    }
                });
                if (!invoice) throw new Error("Purchase Invoice not found.");
            }

            let supplier = invoice?.supplier || await this.resolveSupplier(tx, data.supplierId);
            if (!supplier) throw new Error("Supplier not found.");
            if (!supplier.payableAccount) throw new Error("Supplier Payable Account not configured.");

            const warehouse = await tx.warehouse.findUnique({ where: { id: data.warehouseId } });
            if (!warehouse) throw new Error("Warehouse not found.");

            // 2. Generate Return No
            const lastReturn = await tx.purchaseReturn.findFirst({
                where: { returnNo: { startsWith: `PRT-${new Date().getFullYear()}-` } },
                orderBy: { returnNo: 'desc' }
            });
            let nextSeq = 1;
            if (lastReturn) {
                const parts = lastReturn.returnNo.split('-');
                const lastSeq = parseInt(parts[parts.length - 1]);
                if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
            }
            const returnNo = `PRT-${new Date().getFullYear()}-${nextSeq.toString().padStart(4, '0')}`;

            // 3. Process Items
            const journalLines = [];
            let totalReturnAmount = 0;
            const returnItemsData = [];

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
                    narration: `Purchase Return - ${product?.name}`
                });

                // Prepare Item Data
                // Prepare Item Data
                // @ts-ignore
                const originalItem = invoice?.items.find(i => i.productId === item.productId && i.variantId === (item.variantId || null));

                returnItemsData.push({
                    productId: item.productId,
                    variantId: item.variantId || null,
                    unitId: item.unitId || null,
                    invoiceItemId: originalItem?.id || null,
                    qty: item.qty,
                    rate: item.rate,
                    total: subtotal
                });
            }

            // DR Supplier (reversal)
            journalLines.push({
                accountId: supplier.payableAccountId!,
                debit: totalReturnAmount,
                narration: `Debit to ${supplier.name} for Return`
            });

            // 4. Create Reversal Journal Entry
            const voucherNo = `PRRTV-${Date.now()}`;
            const journalEntry = await tx.journalEntry.create({
                data: {
                    number: voucherNo,
                    date: data.date,
                    type: "PURCHASE_RETURN",
                    reference: returnNo,
                    narration: `Purchase Return ${returnNo} from ${supplier.name}. ${data.remarks || ""}`,
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

            // 5. Create Purchase Return Record
            const purchaseReturn = await tx.purchaseReturn.create({
                data: {
                    returnNo,
                    date: data.date,
                    supplierId: supplier.id,
                    warehouseId: warehouse.id,
                    invoiceId: invoice?.id,
                    totalAmount: totalReturnAmount,
                    journalEntryId: journalEntry.id,
                    remarks: data.remarks,
                    items: {
                        create: returnItemsData
                    }
                }
            });

            // 6. Stock Out (Re-insert with correct RefID)
            for (const item of data.items) {
                await tx.stockLedger.create({
                    data: {
                        productId: item.productId,
                        variantId: item.variantId || null,
                        warehouseId: warehouse.id,
                        date: data.date,
                        qtyIn: 0,
                        qtyOut: item.qty,
                        costRate: item.rate,
                        refType: "RETURN",
                        refId: purchaseReturn.id
                    }
                });
            }

            return purchaseReturn;
        });
    }
}
