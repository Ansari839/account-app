// @ts-nocheck
import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { AuthUtils } from '@/lib/auth-utils';
import { AccountType } from '@prisma/client';

export class PurchaseController {
    /**
     * Helper to find a default account by name and type
     */
    private static async findDefaultAccount(companyId: string, name: string, type: AccountType) {
        return prisma.account.findFirst({
            where: {
                companyId,
                name: { contains: name, mode: 'insensitive' },
                type: type,
                isPosting: true
            }
        });
    }
    /**
     * List Purchase Invoices (Filtered by Company via Supplier -> Account)
     */
    static async listInvoices(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const invoices = await prisma.purchaseInvoice.findMany({
                where: { companyId },
                include: {
                    Supplier: true,
                    Warehouse: true,
                    PurchaseOrder: { select: { poNo: true } },
                    GRN: { select: { grnNo: true } },
                    items: {
                        include: { Product: true, Unit: true }
                    }
                },
                orderBy: { date: 'desc' }
            });

            const mappedInvoices = invoices.map(inv => ({
                ...inv,
                supplier: inv.Supplier,
                warehouse: inv.Warehouse,
                po: inv.PurchaseOrder,
                grn: inv.GRN,
                items: (inv.items || []).map(it => ({
                    ...it,
                    product: it.Product,
                    unit: it.Unit
                }))
            }));

            return NextResponse.json({ success: true, data: mappedInvoices });
        } catch (error: any) {
            console.error("List Invoices Error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * List Purchase Orders (Filtered)
     */
    static async listOrders(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const orders = await prisma.purchaseOrder.findMany({
                where: { companyId },
                include: {
                    supplier: true,
                    items: { include: { product: true, unit: true } }
                },
                orderBy: { date: 'desc' }
            });

            return NextResponse.json({ success: true, data: orders });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * List GRNs (Filtered)
     */
    static async listGRNs(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const grns = await prisma.gRN.findMany({
                where: { companyId },
                include: {
                    supplier: true,
                    items: { include: { product: true, unit: true } },
                    invoices: { select: { id: true, invoiceNo: true } },
                    warehouse: true,
                    po: { select: { poNo: true } }
                },
                orderBy: { date: 'desc' }
            });

            return NextResponse.json({ success: true, data: grns });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Create Purchase Order
     */
    static async createOrder(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();

            // If supplierId is an Account ID, find or create corresponding Supplier
            let supplierId = body.supplierId;

            // Check if this is an Account ID (not a Supplier ID)
            const account = await prisma.account.findUnique({ where: { id: body.supplierId } });

            if (account) {
                // This is an Account, find or create Supplier
                let supplier = await prisma.supplier.findFirst({
                    where: { payableAccountId: account.id }
                });

                if (!supplier) {
                    // Create new Supplier from Account
                    const lastSupplier = await prisma.supplier.findFirst({
                        where: { code: { startsWith: 'SUP-' } },
                        orderBy: { code: 'desc' }
                    });
                    let nextSupSeq = 1;
                    if (lastSupplier) {
                        const lastNum = parseInt(lastSupplier.code.split('-')[1]);
                        if (!isNaN(lastNum)) nextSupSeq = lastNum + 1;
                    }
                    const baseCurr = await prisma.currency.findFirst({ where: { companyId, isBase: true } }) 
                            || await prisma.currency.findFirst({ where: { companyId } });
                    if (!baseCurr) {
                        throw new Error("No currency found. Please configure a currency in settings first.");
                    }

                    supplier = await prisma.supplier.create({
                        data: {
                            companyId,
                            code: `SUP-${nextSupSeq.toString().padStart(4, '0')}`,
                            name: account.name,
                            currencyCode: baseCurr.id,
                            payableAccountId: account.id
                        }
                    });
                }

                supplierId = supplier.id;
            }

            // Generate PO Number
            const lastPo = await prisma.purchaseOrder.findFirst({
                where: { poNo: { startsWith: `PO-${new Date().getFullYear()}-` } },
                orderBy: { poNo: 'desc' }
            });
            let nextPoSeq = 1;
            if (lastPo) {
                const parts = lastPo.poNo.split('-');
                const lastSeq = parseInt(parts[parts.length - 1]);
                if (!isNaN(lastSeq)) nextPoSeq = lastSeq + 1;
            }
            const poNo = `PO-${new Date().getFullYear()}-${nextPoSeq.toString().padStart(4, '0')}`;

            const order = await prisma.purchaseOrder.create({
                data: {
                    companyId,
                    poNo,
                    supplierId,
                    warehouseId: body.warehouseId || null,
                    date: new Date(body.date),
                    expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
                    totalAmount: body.items.reduce((acc: number, item: any) => acc + (Number(item.qty || 0) * Number(item.rate || 0)), 0),
                    status: 'OPEN',
                    items: {
                        create: body.items.map((item: any) => ({
                            productId: item.productId,
                            variantId: item.variantId || null,
                            unitId: item.unitId || null,
                            qty: Number(item.qty || 0),
                            rate: Number(item.rate || 0),
                            total: Number(item.qty || 0) * Number(item.rate || 0),
                            receivedQty: 0,
                            invoicedQty: 0
                        }))
                    }
                },
                include: {
                    supplier: true,
                    items: { include: { product: true, unit: true } }
                }
            });

            return NextResponse.json({ success: true, data: order });
        } catch (error: any) {
            console.error("Create PO Error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Get Single Purchase Order Detail (with GRNs and Invoices)
     */
    static async getOrder(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;


            const order = await prisma.purchaseOrder.findUnique({
                where: { id },
                include: {
                    supplier: true,
                    warehouse: true,
                    items: { include: { product: true, unit: true } },
                    grns: {
                        include: { items: { include: { product: true, unit: true } } }
                    },
                    invoices: {
                        include: { items: true }
                    }
                }
            });

            if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });

            return NextResponse.json({ success: true, data: order });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Update Purchase Order
     */
    static async updateOrder(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;

            const body = await req.json();

            // Transaction for items update
            const result = await prisma.$transaction(async (tx) => {
                // Remove existing items
                await tx.purchaseOrderItem.deleteMany({ where: { poId: id } });

                // Update Header
                return await tx.purchaseOrder.update({
                    where: { id },
                    data: {
                        date: new Date(body.date),
                        expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
                        totalAmount: body.items.reduce((acc: number, item: any) => acc + (Number(item.qty || 0) * Number(item.rate || 0)), 0),
                        status: body.status || 'OPEN',
                        items: {
                            create: body.items.map((item: any) => ({
                                productId: item.productId,
                                variantId: item.variantId || null,
                                unitId: item.unitId || null,
                                qty: Number(item.qty || 0),
                                rate: Number(item.rate || 0),
                                total: Number(item.qty || 0) * Number(item.rate || 0),
                                receivedQty: item.receivedQty || 0,
                                invoicedQty: item.invoicedQty || 0
                            }))
                        }
                    },
                    include: { items: { include: { product: true, unit: true } } }
                });
            });

            return NextResponse.json({ success: true, data: result });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Delete Purchase Order
     */
    static async deleteOrder(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;

            // Check if PO has GRNs or Invoices
            const order = await prisma.purchaseOrder.findUnique({
                where: { id },
                include: { _count: { select: { grns: true, invoices: true } } }
            });

            if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
            if (order._count.grns > 0 || order._count.invoices > 0) {
                return NextResponse.json({ success: false, error: "Cannot delete PO with linked GRNs or Invoices" }, { status: 400 });
            }

            await prisma.purchaseOrder.delete({ where: { id } });
            return NextResponse.json({ success: true });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Create GRN
     */
    static async createGRN(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const { poId, supplierId, warehouseId, date, items } = body;

            // Generate GRN Number
            // Generate GRN Number
            const lastGrn = await prisma.gRN.findFirst({
                where: { grnNo: { startsWith: `GRN-${new Date().getFullYear()}-` } },
                orderBy: { grnNo: 'desc' }
            });
            let nextGrnSeq = 1;
            if (lastGrn) {
                const parts = lastGrn.grnNo.split('-');
                const lastSeq = parseInt(parts[parts.length - 1]);
                if (!isNaN(lastSeq)) nextGrnSeq = lastSeq + 1;
            }
            const grnNo = `GRN-${new Date().getFullYear()}-${nextGrnSeq.toString().padStart(4, '0')}`;

            // Transaction to ensure atomic updates
            const result = await prisma.$transaction(async (tx) => {
                // 1. Create GRN
                const validItems = items.filter((item: any) => (item.qtyReceived > 0 || item.qtyRejected > 0));

                if (validItems.length === 0) {
                    throw new Error("No items to receive");
                }

                const grn = await tx.gRN.create({
                    data: {
                        companyId,
                        grnNo,
                        poId: poId || null,
                        supplierId,
                        warehouseId: warehouseId || null,
                        date: new Date(date),
                        items: {
                            create: validItems.map((item: any) => ({
                                productId: item.productId,
                                variantId: item.variantId || null,
                                unitId: item.unitId || null,
                                poItemId: item.poItemId || null,
                                qtyReceived: item.qtyReceived,
                                qtyRejected: item.qtyRejected,
                                rate: Number(item.rate || 0)
                            }))
                        }
                    }
                });

                // 2. Handle Over-fulfillment (Addendum PO)
                if (poId) {
                    for (const item of validItems) {
                        if (item.poItemId) {
                            const poItem = await tx.purchaseOrderItem.findUnique({ where: { id: item.poItemId } });
                            if (poItem) {
                                const remaining = Number(poItem.qty) - Number(poItem.receivedQty);
                                if (Number(item.qtyReceived) > remaining) {
                                    const excess = Number(item.qtyReceived) - remaining;
                                    const lastAddendum = await tx.purchaseOrder.findFirst({
                                        where: { poNo: { startsWith: `PO-ADD-${new Date().getFullYear()}-` } },
                                        orderBy: { poNo: 'desc' }
                                    });
                                    let nextAddendumSeq = 1;
                                    if (lastAddendum) {
                                        const parts = lastAddendum.poNo.split('-');
                                        const lastSeq = parseInt(parts[parts.length - 1]);
                                        if (!isNaN(lastSeq)) nextAddendumSeq = lastSeq + 1;
                                    }
                                    const addendumNo = `PO-ADD-${new Date().getFullYear()}-${nextAddendumSeq}`;
                                    await tx.purchaseOrder.create({
                                        data: {
                                            companyId,
                                            poNo: addendumNo,
                                            supplierId,
                                            date: new Date(),
                                            status: 'OPEN',
                                            totalAmount: excess * Number(poItem.rate),
                                            items: {
                                                create: [{
                                                    productId: item.productId,
                                                    unitId: item.unitId || null,
                                                    qty: excess,
                                                    rate: poItem.rate,
                                                    total: excess * Number(poItem.rate),
                                                    invoicedQty: 0,
                                                    receivedQty: 0
                                                }]
                                            }
                                        }
                                    });
                                }
                            }
                        }
                    }
                }

                // 3. Update PO Items (receivedQty) & Create Stock Ledger
                for (const item of validItems) {
                    if (item.qtyReceived > 0) {
                        if (item.poItemId) {
                            await tx.purchaseOrderItem.update({
                                where: { id: item.poItemId },
                                data: {
                                    receivedQty: { increment: item.qtyReceived }
                                }
                            });
                        }

                        // 4. Create Stock Ledger Entry (Increase Stock)
                        const poItem = item.poItemId ? await tx.purchaseOrderItem.findUnique({ where: { id: item.poItemId } }) : null;
                        await tx.stockLedger.create({
                            data: {
                                companyId,
                                productId: item.productId,
                                variantId: item.variantId || null,
                                warehouseId,
                                date: new Date(date),
                                qtyIn: item.qtyReceived,
                                qtyOut: 0,
                                costRate: item.rate ? Number(item.rate) : (poItem ? Number(poItem.rate) : 0),
                                refType: 'GRN',
                                refId: grn.id
                            }
                        });
                    }
                }

                return grn;
            });

            return NextResponse.json({ success: true, data: result });
        } catch (error: any) {
            console.error("Create GRN Error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Get Single GRN Detail
     */
    static async getGRN(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;

            const grn = await prisma.gRN.findUnique({
                where: { id },
                include: {
                    supplier: true,
                    warehouse: true,
                    po: true,
                    items: {
                        include: { product: true, poItem: true, unit: true }
                    }
                }
            });

            if (!grn) return NextResponse.json({ success: false, error: "GRN not found" }, { status: 404 });
            return NextResponse.json({ success: true, data: grn });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Delete GRN (with stock and PO reversion)
     */
    static async deleteGRN(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;

            const grn = await prisma.gRN.findUnique({
                where: { id },
                include: {
                    items: true,
                    _count: { select: { invoices: true } } // This relation exists in schema? Let me check.
                }
            });

            if (!grn) return NextResponse.json({ success: false, error: "GRN not found" }, { status: 404 });

            // Check if invoiced (in schema? GRN has invoices relation?)
            // If not direct relation, check via GRNItems linked to PurchaseInvoiceItem
            const invoicedCount = await prisma.purchaseInvoiceItem.count({
                where: { grnItemId: { in: grn.items.map(i => i.id) } }
            });

            if (invoicedCount > 0) {
                return NextResponse.json({ success: false, error: "Cannot delete GRN already partially or fully invoiced" }, { status: 400 });
            }

            await prisma.$transaction(async (tx) => {
                // 1. Revert PO item received quantities & Remove Stock Ledger
                for (const item of grn.items) {
                    if (Number(item.qtyReceived) > 0) {
                        if (item.poItemId) {
                            await tx.purchaseOrderItem.update({
                                where: { id: item.poItemId },
                                data: { receivedQty: { decrement: item.qtyReceived } }
                            });
                        }

                        await tx.stockLedger.deleteMany({
                            where: { refType: 'GRN', refId: grn.id, productId: item.productId }
                        });
                    }
                }

                // 2. Delete Items and GRN
                await tx.gRNItem.deleteMany({ where: { grnId: id } });
                await tx.gRN.delete({ where: { id } });
            });

            return NextResponse.json({ success: true });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }


    /**
     * Get Single Purchase Invoice Detail
     */
    static async getInvoice(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;

            const invoice = await prisma.purchaseInvoice.findUnique({
                where: { id },
                include: {
                    Supplier: true,
                    PurchaseOrder: true,
                    GRN: true,
                    Warehouse: true,
                    JournalEntry: { include: { lines: { include: { Account: true } } } },
                    items: {
                        include: { Product: true, PurchaseOrderItem: true, Unit: true }
                    },
                    taxes: true
                }
            });

            if (!invoice) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });

            const mapped = {
                ...invoice,
                supplier: invoice.Supplier,
                po: invoice.PurchaseOrder,
                grn: invoice.GRN,
                warehouse: invoice.Warehouse,
                journalEntry: invoice.JournalEntry ? {
                    ...invoice.JournalEntry,
                    lines: (invoice.JournalEntry.lines || []).map((l: any) => ({
                        ...l,
                        account: l.Account || l.account
                    }))
                } : null,
                items: (invoice.items || []).map(it => ({
                    ...it,
                    product: it.Product,
                    unit: it.Unit,
                    poItem: it.PurchaseOrderItem
                }))
            };

            return NextResponse.json({ success: true, data: mapped });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Delete Purchase Invoice
     */
    static async deleteInvoice(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;

            const invoice = await prisma.purchaseInvoice.findUnique({
                where: { id },
                include: { items: true }
            });

            if (!invoice) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });

            await prisma.$transaction(async (tx) => {
                // 1. Revert invoiced quantities in PO items
                for (const item of invoice.items) {
                    if (item.poItemId) {
                        await tx.purchaseOrderItem.update({
                            where: { id: item.poItemId },
                            data: { invoicedQty: { decrement: item.qty } }
                        });
                    }
                }

                // 2. Delete Journal Entry
                if (invoice.journalEntryId) {
                    await tx.journalLine.deleteMany({ where: { entryId: invoice.journalEntryId } });
                    await tx.journalEntry.delete({ where: { id: invoice.journalEntryId } });
                }

                // 3. Delete Stock Ledger entries
                await tx.stockLedger.deleteMany({
                    where: {
                        refType: { in: ['IMPORT_INVOICE', 'INVOICE', 'PURCHASE'] },
                        refId: id
                    }
                });

                // 4. Delete Invoice Taxes
                await tx.purchaseInvoiceTax.deleteMany({ where: { invoiceId: id } });

                // 5. Delete Items and Invoice
                await tx.purchaseInvoiceItem.deleteMany({ where: { invoiceId: id } });
                await tx.purchaseInvoice.delete({ where: { id } });
            });

            return NextResponse.json({ success: true });
        } catch (error: any) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Create Purchase Invoice
     */
    static async createPurchaseInvoice(req: Request) {
        try {
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const { poId, grnId, warehouseId, date, dueDate, items, taxes, hasDiscount, discountAmount, discountType } = body;
            let supplierId = body.supplierId;

            // Resolve Account ID to Supplier ID (Moved inside transaction to utilize maxWait and timeout)

            // Generate Invoice Number (Moved inside transaction)

            const result = await prisma.$transaction(async (tx) => {
                // 1. Fetch Setting: GRN Mandatory (per company)
                const setting = await tx.companySetting.findUnique({
                    where: { companyId_key: { companyId, key: 'INVENTORY_GRN_MANDATORY' } }
                });
                const grnMandatory = setting?.value === 'true';

                if (grnMandatory && !grnId) {
                    throw new Error("GRN is mandatory for creating Purchase Invoices.");
                }

                // Generate Invoice Number
                const lastInvoice = await tx.purchaseInvoice.findFirst({
                    where: { invoiceNo: { startsWith: `PI-${new Date().getFullYear()}-` } },
                    orderBy: { invoiceNo: 'desc' }
                });
                let txNextInvoiceSeq = 1;
                if (lastInvoice) {
                    const parts = lastInvoice.invoiceNo.split('-');
                    const lastSeq = parseInt(parts[parts.length - 1]);
                    if (!isNaN(lastSeq)) txNextInvoiceSeq = lastSeq + 1;
                }
                const txInvoiceNo = `PI-${new Date().getFullYear()}-${txNextInvoiceSeq.toString().padStart(4, '0')}`;
                // Resolve Account ID to Supplier ID (Same logic as createOrder)
                const account = await tx.account.findUnique({ where: { id: supplierId } });
                if (account) {
                    let supplier = await tx.supplier.findFirst({
                        where: { payableAccountId: account.id }
                    });

                    if (!supplier) {
                        // Try to find generic supplier first to avoid creating duplicates
                        supplier = await tx.supplier.findFirst({
                            where: { name: account.name }
                        });

                        if (!supplier) {
                            const baseCurr = await tx.currency.findFirst({ where: { companyId, isBase: true } }) 
                                    || await tx.currency.findFirst({ where: { companyId } });
                            if (!baseCurr) {
                                throw new Error("No currency found. Please configure a currency in settings first.");
                            }

                            try {
                                const lastSupplier = await tx.supplier.findFirst({
                                    where: { code: { startsWith: 'SUP-' } },
                                    orderBy: { code: 'desc' }
                                });
                                let nextSupSeq = 1;
                                if (lastSupplier) {
                                    const lastNum = parseInt(lastSupplier.code.split('-')[1]);
                                    if (!isNaN(lastNum)) nextSupSeq = lastNum + 1;
                                }

                                // Use upsert-like logic or randomized code on fail
                                supplier = await tx.supplier.create({
                                    data: {
                                        companyId,
                                        code: `SUP-${nextSupSeq.toString().padStart(4, '0')}`,
                                        name: account.name,
                                        currencyCode: baseCurr.id,
                                        payableAccountId: account.id
                                    }
                                });
                            } catch (e) {
                                // Fallback with random code
                                supplier = await tx.supplier.create({
                                    data: {
                                        companyId,
                                        code: `SUP-${Date.now()}`,
                                        name: account.name,
                                        currencyCode: baseCurr.id,
                                        payableAccountId: account.id
                                    }
                                });
                            }
                        }
                    }
                    supplierId = supplier.id;
                }

                const totalAmount = items.reduce((sum: number, item: any) => sum + (Number(item.qty || 0) * Number(item.rate || 0)), 0);

                // 2. Handle Over-fulfillment (Addendum PO)
                // If any item qty > PO remaining qty, create an Addendum PO
                if (poId) {
                    for (const item of items) {
                        if (item.poItemId) {
                            const poItem = await tx.purchaseOrderItem.findUnique({ where: { id: item.poItemId } });
                            if (poItem) {
                                const remaining = Number(poItem.qty) - Number(poItem.invoicedQty);
                                if (Number(item.qty) > remaining) {
                                    const excess = Number(item.qty) - remaining;
                                    // Create Addendum PO
                                    const lastAddendum = await tx.purchaseOrder.findFirst({
                                        where: { poNo: { startsWith: `PO-ADD-${new Date().getFullYear()}-` } },
                                        orderBy: { poNo: 'desc' }
                                    });
                                    let nextAddendumSeq = 1;
                                    if (lastAddendum) {
                                        const parts = lastAddendum.poNo.split('-');
                                        const lastSeq = parseInt(parts[parts.length - 1]);
                                        if (!isNaN(lastSeq)) nextAddendumSeq = lastSeq + 1;
                                    }
                                    const addendumNo = `PO-ADD-${new Date().getFullYear()}-${nextAddendumSeq}`;
                                    const addendumPo = await tx.purchaseOrder.create({
                                        data: {
                                            companyId,
                                            poNo: addendumNo,
                                            supplierId,
                                            date: new Date(),
                                            status: 'OPEN',
                                            totalAmount: excess * Number(item.rate),
                                            items: {
                                                create: [{
                                                    productId: item.productId,
                                                    unitId: item.unitId || null,
                                                    qty: excess,
                                                    rate: item.rate,
                                                    total: excess * Number(item.rate),
                                                    invoicedQty: 0,
                                                    receivedQty: 0
                                                }]
                                            }
                                        }
                                    });
                                    // Note: In a real system, you might want to link this back or notify
                                }
                            }
                        }
                    }
                }

                // Calculate totals
                const subtotal = items.reduce((sum: number, item: any) => sum + (Number(item.qty || 0) * Number(item.rate || 0)), 0);
                const discount = hasDiscount ? Number(discountAmount || 0) : 0;
                
                let currentTotal = subtotal - discount;
                let totalTaxAmount = 0;
                
                const calculatedTaxes = (taxes || []).map((tax: any) => {
                    const baseAmount = tax.calculation === 'PREVIOUS_TOTAL' ? currentTotal : (subtotal - discount);
                    const rate = Number(tax.rate) || 0;
                    const taxAmt = rate > 0 ? (baseAmount * (rate / 100)) : (Number(tax.taxAmount) || 0);
                    
                    totalTaxAmount += taxAmt;
                    currentTotal += taxAmt;
                    return {
                        taxCodeId: tax.taxCodeId === 'MANUAL' ? null : (tax.taxCodeId || null),
                        // Fetching accountId is hard in map since it's sync. We will do it before create or let it fail if schema requires it. Wait, Prisma schema currently requires `accountId`.
                        // I will set it to a placeholder or resolve it later. Or let me just fetch it here.
                        // Actually, I can just use a Promise.all before this map, but I will just remove accountId from Prisma schema instead.
                        taxName: tax.taxName || 'Tax/Charge',
                        calculation: tax.calculation || 'NET_TOTAL',
                        rate: rate,
                        baseAmount,
                        taxAmount: taxAmt
                    };
                });
                
                const grandTotal = subtotal - discount + totalTaxAmount;

                // 3. Create Invoice
                const invoice = await tx.purchaseInvoice.create({
                    data: {
                        companyId,
                        invoiceNo: txInvoiceNo,
                        supplierId,
                        poId: poId || null,
                        grnId: grnId || null,
                        warehouseId: warehouseId || null,
                        date: new Date(date),
                        dueDate: dueDate ? new Date(dueDate) : null,
                        totalAmount: grandTotal,
                        taxAmount: totalTaxAmount,
                        hasDiscount: hasDiscount || false,
                        discountAmount: discount,
                        discountType: discountType || null,
                        items: {
                            create: items.map((item: any) => {
                                const itemTotal = Number(item.qty) * Number(item.rate);
                                const itemRatio = subtotal > 0 ? (itemTotal / subtotal) : 0;
                                const itemTax = totalTaxAmount * itemRatio;
                                
                                return {
                                    productId: item.productId,
                                    variantId: item.variantId || null,
                                    unitId: item.unitId || null,
                                    poItemId: item.poItemId || null,
                                    grnItemId: item.grnItemId || null,
                                    qty: item.qty,
                                    rate: item.rate,
                                    total: itemTotal,
                                    taxAmount: itemTax
                                };
                            })
                        },
                        taxes: {
                            create: calculatedTaxes
                        }
                    }
                });

                // 3.1 Handle Stock for Direct Invoices (No GRN)
                if (!grnId) {
                    // Try to get warehouseId
                    let finalWarehouseId = warehouseId;
                    if (!finalWarehouseId) {
                        const defaultWH = await tx.warehouse.findFirst({ where: { companyId, isDefault: true } });
                        if (defaultWH) finalWarehouseId = defaultWH.id;
                    }

                    if (finalWarehouseId) {
                        for (const item of items) {
                            const product = await tx.product.findUnique({ where: { id: item.productId } });
                            if (product && !product.isService) {
                                await tx.stockLedger.create({
                                    data: {
                                        companyId,
                                        productId: item.productId,
                                        variantId: item.variantId || null,
                                        warehouseId: finalWarehouseId,
                                        date: new Date(date),
                                        qtyIn: item.qty,
                                        qtyOut: 0,
                                        costRate: Number(item.rate),
                                        refType: 'INVOICE',
                                        refId: invoice.id
                                    }
                                });
                            }
                        }
                    }
                }

                // 4. Update PO Items (invoicedQty)
                for (const item of items) {
                    if (item.poItemId) {
                        await tx.purchaseOrderItem.update({
                            where: { id: item.poItemId },
                            data: { invoicedQty: { increment: item.qty } }
                        });
                    }
                }

                // 5. Create Journal Entry
                const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
                if (!supplier?.payableAccountId) {
                    throw new Error(`Supplier '${supplier?.name || supplierId}' is not linked to a Payable Account. Please check supplier settings.`);
                }

                const journalNo = `JV-${txInvoiceNo}`;

                // Group items by their purchase account
                const lines = [];
                // Credit Supplier (Payable) with grand total
                lines.push({
                    accountId: supplier.payableAccountId,
                    credit: grandTotal,
                    debit: 0,
                    narration: `Purchase Invoice ${txInvoiceNo} - Total payable to ${supplier.name}`
                });

                // Credit Purchase Discount if applicable
                if (discount > 0) {
                    const discountAcc = await tx.account.findFirst({
                        where: {
                            companyId,
                            name: { contains: 'Purchase Discount', mode: 'insensitive' },
                            type: 'INCOME',
                            isPosting: true
                        }
                    });
                    if (discountAcc) {
                        lines.push({
                            accountId: discountAcc.id,
                            credit: discount,
                            debit: 0,
                            narration: `Discount on Purchase Invoice ${txInvoiceNo}`
                        });
                    } else {
                        // If no discount account, subtract it from the supplier credit
                        // Wait, accounting principles say we should credit the discount account. Let's just create a generic one or throw.
                        throw new Error("No default 'Purchase Discount' account found to record discount.");
                    }
                }

                // Debit Purchase/Inventory Accounts for items
                for (const item of items) {
                    const product = await tx.product.findUnique({ 
                        where: { id: item.productId },
                        include: { category: true }
                    });
                    
                    let purchaseAccount = product?.inventoryAccountId || product?.purchaseAccountId;

                    // If it's a service and has a WIP account linked to its category, use that
                    if (!purchaseAccount && product?.category?.isService && product.category.wipAccountId) {
                        purchaseAccount = product.category.wipAccountId;
                    }

                    if (!purchaseAccount) {
                        const defInv = await tx.account.findFirst({
                            where: { companyId, name: { contains: 'Inventory', mode: 'insensitive' }, type: 'ASSET', isPosting: true }
                        });
                        const defPur = await tx.account.findFirst({
                            where: { companyId, name: { contains: 'Purchase', mode: 'insensitive' }, type: 'EXPENSE', isPosting: true }
                        });
                        purchaseAccount = defInv?.id || defPur?.id;

                        if (!purchaseAccount) {
                            throw new Error(`Product '${product?.name || item.productId}' is not linked to a Purchase or Inventory Account.`);
                        }
                    }

                    lines.push({
                        accountId: purchaseAccount,
                        credit: 0,
                        debit: Number(item.qty) * Number(item.rate),
                        narration: `Purchase of ${product?.name} (${item.qty} @ ${item.rate})`
                    });
                }

                // Debit Tax Accounts
                for (const tax of calculatedTaxes) {
                    if (tax.taxAmount > 0) {
                        let taxAccId = null;
                        if (tax.taxCodeId) {
                            const tc = await tx.taxCode.findUnique({ where: { id: tax.taxCodeId } });
                            taxAccId = tc?.accountId;
                        }
                        
                        if (!taxAccId) {
                            const defTax = await tx.account.findFirst({
                                where: { companyId, name: { contains: 'Tax', mode: 'insensitive' }, type: 'ASSET', isPosting: true }
                            });
                            taxAccId = defTax?.id;
                        }

                        if (!taxAccId) {
                            throw new Error(`No account linked to tax '${tax.taxName}' and no default tax account found.`);
                        }

                        lines.push({
                            accountId: taxAccId,
                            credit: 0,
                            debit: tax.taxAmount,
                            narration: `Tax applied: ${tax.taxName} on Invoice ${txInvoiceNo}`
                        });
                    }
                }

                await tx.journalEntry.create({
                    data: {
                        companyId,
                        number: journalNo,
                        date: new Date(date),
                        type: 'PURCHASE',
                        reference: txInvoiceNo,
                        narration: `Purchase Invoice ${txInvoiceNo} for ${supplier.name} ${poId ? 'against PO' : ''}`,
                        lines: { create: lines },
                        purchaseInvoice: { connect: { id: invoice.id } }
                    }
                });

                return invoice;
            }, {
                maxWait: 20000, // 20 seconds max wait for connection
                timeout: 60000, // 60 seconds max transaction duration
            });

            return NextResponse.json({ success: true, data: result });
        } catch (error: any) {
            console.error("Create PI Error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
    /**
     * Update GRN (reverts old stock/PO and applies new)
     */
    static async updateGRN(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const { date, warehouseId, items } = body;

            const existing = await prisma.gRN.findUnique({
                where: { id },
                include: { items: true }
            });

            if (!existing) return NextResponse.json({ success: false, error: "GRN not found" }, { status: 404 });

            // Check if invoiced
            const invoiced = await prisma.purchaseInvoiceItem.count({
                where: { grnItemId: { in: existing.items.map(i => i.id) } }
            });
            if (invoiced > 0) return NextResponse.json({ success: false, error: "Cannot edit GRN that is already invoiced" }, { status: 400 });

            const result = await prisma.$transaction(async (tx) => {
                // 1. Revert Old Stock & PO Quantities
                for (const item of existing.items) {
                    if (item.poItemId) {
                        await tx.purchaseOrderItem.update({
                            where: { id: item.poItemId },
                            data: { receivedQty: { decrement: item.qtyReceived } }
                        });
                    }
                    // Delete old stock entries for this GRN
                    await tx.stockLedger.deleteMany({
                        where: { refType: 'GRN', refId: id, productId: item.productId, variantId: item.variantId || null }
                    });
                }

                // 2. Delete existing items
                await tx.gRNItem.deleteMany({ where: { grnId: id } });

                // 3. Update Header
                await tx.gRN.update({
                    where: { id },
                    data: {
                        date: new Date(date),
                        warehouseId
                    }
                });

                // 4. Create New Items & Apply Stock/PO
                const validItems = items.filter((item: any) => (Number(item.qtyReceived) > 0 || Number(item.qtyRejected) > 0));
                for (const item of validItems) {
                    await tx.gRNItem.create({
                        data: {
                            grnId: id,
                            productId: item.productId,
                            variantId: item.variantId || null,
                            unitId: item.unitId || null,
                            poItemId: item.poItemId,
                            qtyReceived: item.qtyReceived,
                            qtyRejected: item.qtyRejected,
                            rate: Number(item.rate || 0)
                        }
                    });

                    if (item.poItemId) {
                        await tx.purchaseOrderItem.update({
                            where: { id: item.poItemId },
                            data: { receivedQty: { increment: item.qtyReceived } }
                        });
                    }

                    if (Number(item.qtyReceived) > 0) {
                        await tx.stockLedger.create({
                            data: {
                                companyId,
                                productId: item.productId,
                                variantId: item.variantId || null,
                                warehouseId,
                                date: new Date(date),
                                qtyIn: item.qtyReceived,
                                qtyOut: 0,
                                refType: 'GRN',
                                refId: id
                            }
                        });
                    }
                }
            });

            return NextResponse.json({ success: true, data: result });
        } catch (error: any) {
            console.error("Update GRN Error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Update Purchase Invoice
     */
    static async updatePurchaseInvoice(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const { date, dueDate, warehouseId, items } = body;

            const existing = await prisma.purchaseInvoice.findUnique({
                where: { id },
                include: { items: true, journalEntry: true }
            });

            if (!existing) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });

            if (existing.isImport) {
                return this.updateImportInvoice(req, { params }, body);
            }

            const result = await prisma.$transaction(async (tx) => {
                // 1. Revert PO Invoiced Quantities
                for (const item of existing.items) {
                    if (item.poItemId) {
                        await tx.purchaseOrderItem.update({
                            where: { id: item.poItemId },
                            data: { invoicedQty: { decrement: item.qty } }
                        });
                    }
                }

                // 2. Delete old items & stock ledger (if direct)
                await tx.purchaseInvoiceItem.deleteMany({ where: { invoiceId: id } });
                await tx.stockLedger.deleteMany({
                    where: {
                        refType: { in: ['INVOICE', 'PURCHASE'] },
                        refId: id
                    }
                });

                // 3. Update Header
                const totalAmount = items.reduce((sum: number, item: any) => sum + (Number(item.qty || 0) * Number(item.rate || 0)), 0);
                const invoice = await tx.purchaseInvoice.update({
                    where: { id },
                    data: {
                        date: new Date(date),
                        dueDate: dueDate ? new Date(dueDate) : null,
                        warehouseId: warehouseId || null,
                        totalAmount
                    }
                });

                // 4. Create New Items
                for (const item of items) {
                    await tx.purchaseInvoiceItem.create({
                        data: {
                            invoiceId: id,
                            productId: item.productId,
                            variantId: item.variantId || null,
                            unitId: item.unitId || null,
                            poItemId: item.poItemId || null,
                            grnItemId: item.grnItemId || null,
                            qty: item.qty,
                            rate: item.rate,
                            total: Number(item.qty) * Number(item.rate)
                        }
                    });

                    if (item.poItemId) {
                        await tx.purchaseOrderItem.update({
                            where: { id: item.poItemId },
                            data: { invoicedQty: { increment: item.qty } }
                        });
                    }
                }

                // 4.1 Handle Stock for Direct Invoices (No GRN)
                if (!existing.grnId && warehouseId) {
                    for (const item of items) {
                        await tx.stockLedger.create({
                            data: {
                                companyId,
                                productId: item.productId,
                                variantId: item.variantId || null,
                                warehouseId,
                                date: new Date(date),
                                qtyIn: item.qty,
                                qtyOut: 0,
                                refType: 'INVOICE',
                                refId: id
                            }
                        });
                    }
                }

                // 5. Update Journal Entry
                if (existing.journalEntryId) {
                    await tx.journalLine.deleteMany({ where: { entryId: existing.journalEntryId } });

                    const supplier = await tx.supplier.findUnique({ where: { id: existing.supplierId } });
                    const lines = [];
                    lines.push({ accountId: supplier?.payableAccountId || '', credit: totalAmount, debit: 0 });

                    for (const item of items) {
                        const product = await tx.product.findUnique({ where: { id: item.productId } });
                        let pAcc = product?.purchaseAccountId || product?.inventoryAccountId;

                        if (!pAcc) {
                            const defInv = await this.findDefaultAccount(companyId, 'Inventory', 'ASSET');
                            const defPur = await this.findDefaultAccount(companyId, 'Purchase', 'EXPENSE');
                            pAcc = defInv?.id || defPur?.id || '';
                        }

                        lines.push({
                            accountId: pAcc,
                            credit: 0,
                            debit: Number(item.qty) * Number(item.rate)
                        });
                    }

                    await tx.journalEntry.update({
                        where: { id: existing.journalEntryId },
                        data: {
                            date: new Date(date),
                            lines: { create: lines }
                        }
                    });
                }

                return invoice;
            });

            return NextResponse.json({ success: true, data: result });
        } catch (error: any) {
            console.error("Update PI Error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
    /**
     * Delete Purchase Return
     */
    static async deleteReturn(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;

            const existing = await prisma.purchaseReturn.findUnique({
                where: { id },
                include: { items: true }
            });

            if (!existing) return NextResponse.json({ success: false, error: "Return not found" }, { status: 404 });

            await prisma.$transaction(async (tx) => {
                // 1. Delete Stock Ledger Entries (Reverses Stock Out)
                await tx.stockLedger.deleteMany({
                    where: { refType: 'PURCHASE_RETURN', refId: id }
                });

                // 2. Delete Journal Entry
                if (existing.journalEntryId) {
                    await tx.journalLine.deleteMany({ where: { entryId: existing.journalEntryId } });
                    await tx.journalEntry.delete({ where: { id: existing.journalEntryId } });
                }

                // 3. Delete Items & Header
                await tx.purchaseReturnItem.deleteMany({ where: { returnId: id } });
                await tx.purchaseReturn.delete({ where: { id } });
            });

            return NextResponse.json({ success: true, message: "Purchase Return deleted successfully" });
        } catch (error: any) {
            console.error("Delete Return Error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Update Purchase Return
     */
    static async updateReturn(req: Request, { params }: { params: Promise<{ id: string }> }) {
        try {
            const { id } = await params;
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const { date, remarks, warehouseId, items } = body;

            // 1. Fetch Existing
            const existing = await prisma.purchaseReturn.findUnique({
                where: { id },
                include: { items: true }
            });

            if (!existing) return NextResponse.json({ success: false, error: "Return not found" }, { status: 404 });

            // 2. Validate Invoice
            if (!existing.invoiceId) {
                return NextResponse.json({ success: false, error: "Return has no associated invoice" }, { status: 400 });
            }

            const invoice = await prisma.purchaseInvoice.findUnique({
                where: { id: existing.invoiceId },
                include: { items: { include: { product: true, taxCode: true } }, supplier: true }
            });
            if (!invoice) return NextResponse.json({ success: false, error: "Original Invoice not found" }, { status: 400 });

            const result = await prisma.$transaction(async (tx) => {
                // 3. Revert Old Effects (Stock & Journal)
                await tx.stockLedger.deleteMany({
                    where: { refType: 'PURCHASE_RETURN', refId: id }
                });

                if (existing.journalEntryId) {
                    await tx.journalLine.deleteMany({ where: { entryId: existing.journalEntryId } });
                    // We will update the existing journal entry instead of deleting/recreating to keep ID stable, 
                    // OR delete/recreate. Recreating is safer for complex logic. Let's delete lines and update header/lines.
                }

                // 4. Delete Old Items
                await tx.purchaseReturnItem.deleteMany({ where: { returnId: id } });

                // 5. Calculate New Totals
                let returnSubtotal = 0;
                let returnTax = 0;
                const returnItemsData = [];

                for (const item of items) {
                    const origItem = invoice.items.find(i => i.productId === item.productId && i.variantId === (item.variantId || null));
                    if (!origItem) throw new Error(`Product ${item.productId} not found in original invoice.`);

                    const total = Number(item.qty) * Number(item.rate);
                    returnSubtotal += total;

                    let taxAmount = 0;
                    if (origItem.taxCodeId) {
                        taxAmount = (total * Number(origItem.taxCode!.rate)) / 100;
                        returnTax += taxAmount;
                    }

                    returnItemsData.push({
                        returnId: id,
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

                // 6. Update Header & Items
                const updatedReturn = await tx.purchaseReturn.update({
                    where: { id },
                    data: {
                        date: new Date(date),
                        warehouseId,
                        remarks,
                        totalAmount: returnTotalAmount,
                        items: { createMany: { data: returnItemsData } } // Use createMany for speed if possible, or create loop
                    }
                });

                // 7. Apply New Stock Effects
                for (const item of items) {
                    await tx.stockLedger.create({
                        data: {
                            companyId,
                            productId: item.productId,
                            variantId: item.variantId || null,
                            warehouseId: warehouseId,
                            date: new Date(date),
                            qtyOut: item.qty, // Purchase Return = Stock OUT
                            qtyIn: 0,
                            refType: 'PURCHASE_RETURN',
                            refId: id
                        }
                    });
                }

                // 8. Apply New Journal Effects
                const jvLines = [];
                // 8.1 Debit Payable (Decrease Liability)
                if (invoice.supplier.payableAccountId) {
                    jvLines.push({
                        accountId: invoice.supplier.payableAccountId,
                        debit: returnTotalAmount,
                        credit: 0,
                        narration: `Purchase Return ${updatedReturn.returnNo}`
                    });
                }

                for (const item of returnItemsData) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    // 8.2 Credit Inventory/Purchase (Decrease Asset/Expense)
                    let creditAccount = product?.inventoryAccountId || product?.purchaseAccountId;
                    // Fallback handled in original creation, assuming exists here or use same logic
                    if (!creditAccount) {
                        // Basic fallback
                        const defInv = await prisma.account.findFirst({ where: { companyId, name: 'Inventory', type: 'ASSET' } });
                        creditAccount = defInv?.id;
                    }

                    if (creditAccount) {
                        jvLines.push({
                            accountId: creditAccount,
                            debit: 0,
                            credit: item.total - item.taxAmount, // Net Amount
                            narration: `Return of ${product?.name}`
                        });
                    }
                }

                // Update Journal Entry
                if (existing.journalEntryId) {
                    await tx.journalEntry.update({
                        where: { id: existing.journalEntryId },
                        data: {
                            date: new Date(date),
                            lines: { create: jvLines }
                        }
                    });
                } else {
                    // Create if missing (edge case)
                    const je = await tx.journalEntry.create({
                        data: {
                            companyId,
                            number: `PRJV-${Date.now()}`,
                            date: new Date(date),
                            type: 'PURCHASE',
                            reference: updatedReturn.returnNo,
                            narration: `Purchase Return ${updatedReturn.returnNo}`,
                            lines: { create: jvLines }
                        }
                    });
                    await tx.purchaseReturn.update({ where: { id }, data: { journalEntryId: je.id } });
                }

                return updatedReturn;
            });

            return NextResponse.json({ success: true, data: result });
        } catch (error: any) {
            console.error("Update Return Error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Create Import Purchase Invoice (with EFS and GD Taxes)
     */
    static async createImportInvoice(req: Request) {
        try {
            const crypto = require('crypto');
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            const body = await req.json();
            const { 
                supplierId, 
                warehouseId, 
                date, 
                dueDate, 
                items, 
                gdTaxes, 
                exchangeRate, 
                docExchangeRate,
                customsExchangeRate,
                beneficiaryName,
                gdNumber,
                blNumber,
                hasDiscount, 
                discountAmount, 
                discountType, 
                foreignTotal 
            } = body;

            const result = await prisma.$transaction(async (tx) => {
                // Generate Invoice Number
                const lastInvoice = await tx.purchaseInvoice.findFirst({
                    where: { invoiceNo: { startsWith: `IMP-${new Date().getFullYear()}-` } },
                    orderBy: { invoiceNo: 'desc' }
                });
                let nextInvoiceSeq = 1;
                if (lastInvoice) {
                    const parts = lastInvoice.invoiceNo.split('-');
                    const lastSeq = parseInt(parts[parts.length - 1]);
                    if (!isNaN(lastSeq)) nextInvoiceSeq = lastSeq + 1;
                }
                const invoiceNo = `IMP-${new Date().getFullYear()}-${nextInvoiceSeq.toString().padStart(4, '0')}`;

                let supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
                let payableAccountId = supplier?.payableAccountId;

                let baseCurr = await tx.currency.findFirst({ where: { companyId, isBase: true } });
                if (!baseCurr) baseCurr = await tx.currency.findFirst({ where: { companyId } });
                if (!baseCurr) baseCurr = await tx.currency.findFirst();
                const currId = baseCurr?.id || 'PKR';

                if (!supplier) {
                    // Check if supplierId is an Account ID (e.g. 2111 - Import Account)
                    const directAccount = await tx.account.findUnique({ where: { id: supplierId } });
                    if (directAccount) {
                        payableAccountId = directAccount.id;
                        supplier = await tx.supplier.findFirst({
                            where: { companyId, payableAccountId: directAccount.id }
                        });
                        if (!supplier) {
                            supplier = await tx.supplier.create({
                                data: {
                                    id: crypto.randomUUID(),
                                    companyId,
                                    currencyCode: currId,
                                    name: beneficiaryName || directAccount.name,
                                    code: `IMP-${directAccount.code}`,
                                    payableAccountId: directAccount.id
                                }
                            });
                        }
                    }
                }

                if (!supplier) {
                    // Fallback: create default Import Supplier linked to 2111 Import Account
                    let importAcc = await tx.account.findFirst({
                        where: { companyId, code: '2111', isPosting: true }
                    });
                    if (!importAcc) {
                        importAcc = await tx.account.findFirst({
                            where: { companyId, name: { contains: 'Import', mode: 'insensitive' }, isPosting: true }
                        });
                    }
                    if (!importAcc) {
                        importAcc = await tx.account.findFirst({
                            where: { companyId, name: { contains: 'Accounts Payable', mode: 'insensitive' }, type: 'LIABILITY', isPosting: true }
                        });
                    }

                    supplier = await tx.supplier.create({
                        data: {
                            id: crypto.randomUUID(),
                            companyId,
                            currencyCode: currId,
                            name: beneficiaryName || 'Commercial Import Supplier',
                            code: 'SUP-IMP-001',
                            payableAccountId: importAcc?.id || null
                        }
                    });
                    payableAccountId = importAcc?.id;
                }

                if (!payableAccountId) {
                    payableAccountId = supplier.payableAccountId;
                }
                if (!payableAccountId) {
                    const fallbackAcc = await tx.account.findFirst({
                        where: { companyId, OR: [{ code: '2111' }, { code: '2110' }, { name: { contains: 'Accounts Payable', mode: 'insensitive' } }], isPosting: true }
                    });
                    payableAccountId = fallbackAcc?.id;
                }

                const docRate = Number(docExchangeRate || exchangeRate || 1.0);
                const customsRate = Number(customsExchangeRate || exchangeRate || 1.0);
                let subtotalPKR = 0;

                // Process Items
                const processedItems = items.map((item: any) => {
                    const fRate = Number(item.foreignRate) || 0;
                    const qty = Number(item.qty) || 0;
                    const fTotal = fRate * qty;
                    const pkrRate = fRate * docRate;
                    const pkrTotal = fTotal * docRate;

                    subtotalPKR += pkrTotal;

                    // Assessed Value and ITP Calculations:
                    // Assessed Value = Assessed Rate X Qty X GD Rate + Insurance + Landing
                    // ITP Rate = (Assessed Value PKR + RD + CD + ACD) / QTY
                    const assessedRate = Number(item.assessedRate) || 0;
                    const assessedValuePKR = Number(item.assessedValuePKR) > 0 
                        ? Math.round(Number(item.assessedValuePKR))
                        : Math.round((assessedRate * qty) * customsRate);
                    const cdAmount = Number(item.cdAmount) || 0;
                    const rdAmount = Number(item.rdAmount) || 0;
                    const acdAmount = Number(item.acdAmount) || 0;
                    const itpRate = qty > 0 ? ((assessedValuePKR + rdAmount + cdAmount + acdAmount) / qty) : 0;

                    return {
                        productId: item.productId,
                        variantId: item.variantId || null,
                        unitId: item.unitId || null,
                        qty: qty,
                        foreignRate: fRate,
                        foreignAmount: fTotal,
                        rate: pkrRate,
                        total: pkrTotal,
                        isEFS: Boolean(item.isEFS),
                        assessedRate,
                        assessedValuePKR,
                        cdAmount,
                        rdAmount,
                        acdAmount,
                        itpRate
                    };
                });

                const discount = hasDiscount ? Number(discountAmount || 0) * docRate : 0;
                
                // Customs Assessed Value of all items combined (as per GD)
                const totalAssessedPKR = Math.round(processedItems.reduce((sum: number, it: any) => sum + (Number(it.assessedValuePKR) || 0), 0));
                
                // Find Insurance and Landing Charges amounts if passed
                const insTax = (gdTaxes || []).find((t: any) => (t.taxName || '').toLowerCase().includes('insurance'));
                const landTax = (gdTaxes || []).find((t: any) => (t.taxName || '').toLowerCase().includes('landing'));
                const insAmountPKR = Math.round(Number(insTax?.taxAmount || 0));
                const landAmountPKR = Math.round(Number(landTax?.taxAmount || 0));

                // Pakistan Customs Base for CD, RD, ACD is directly the Customs Assessed Value!
                const customsBasePKR = totalAssessedPKR > 0
                    ? totalAssessedPKR
                    : (subtotalPKR - discount + insAmountPKR + landAmountPKR);

                let runningTotalPKR = subtotalPKR - discount;
                let runningDutiesPKR = 0;
                let runningSalesTaxesPKR = 0;
                let totalTaxAmount = 0;
                let totalCapitalizedTaxes = 0;

                const processedTaxes = (gdTaxes || []).map((tax: any) => {
                    let baseAmount = customsBasePKR;

                    if (tax.calculation === 'ASSESSED_VALUE') {
                        // CD, RD, ACD: Base is directly Customs Assessed Value
                        baseAmount = customsBasePKR;
                    } else if (tax.calculation === 'ASSESSED_PLUS_DUTIES') {
                        baseAmount = customsBasePKR + runningDutiesPKR;
                    } else if (tax.calculation === 'ASSESSED_PLUS_ALL') {
                        baseAmount = customsBasePKR + runningDutiesPKR + runningSalesTaxesPKR;
                    } else if (tax.calculation === 'PREVIOUS_TOTAL') {
                        baseAmount = runningTotalPKR;
                    } else if (tax.calculation === 'NET_TOTAL') {
                        baseAmount = subtotalPKR - discount;
                    } else if (tax.calculation === 'OTHER_EXPENSE') {
                        baseAmount = Number(tax.taxAmount || tax.baseAmount || 0);
                    }

                    baseAmount = Math.round(baseAmount);
                    const rate = Number(tax.rate) || 0;
                    const taxAmt = rate > 0 ? Math.round(baseAmount * (rate / 100)) : Math.round(Number(tax.taxAmount) || 0);
                    
                    totalTaxAmount += taxAmt;
                    runningTotalPKR += taxAmt;

                    const tName = (tax.taxName || '').toLowerCase();
                    if (tax.calculation !== 'OTHER_EXPENSE') {
                        if (tax.isCapitalized || tName.includes('duty') || tName.includes('cd') || tName.includes('rd') || tName.includes('acd')) {
                            runningDutiesPKR += taxAmt;
                        } else if (tName.includes('sales') || tName.includes('st') || tName.includes('ast')) {
                            runningSalesTaxesPKR += taxAmt;
                        }
                    }

                    if (tax.isCapitalized) {
                        totalCapitalizedTaxes += taxAmt;
                    }

                    return {
                        taxCodeId: tax.taxCodeId === 'MANUAL' ? null : (tax.taxCodeId || null),
                        taxName: tax.taxName || 'GD Tax/Duty',
                        calculation: tax.calculation || 'ASSESSED_VALUE',
                        rate: rate,
                        baseAmount,
                        taxAmount: taxAmt,
                        isCapitalized: Boolean(tax.isCapitalized),
                        accountId: tax.accountId, // Used later for Journal
                        expenseAccountId: tax.expenseAccountId || null
                    };
                });

                const grandTotalPKR = subtotalPKR - discount + totalTaxAmount;

                // Create Invoice
                const invoice = await tx.purchaseInvoice.create({
                    data: {
                        id: crypto.randomUUID(),
                        companyId,
                        invoiceNo: invoiceNo,
                        supplierId: supplier.id,
                        warehouseId: (warehouseId && warehouseId.trim() !== '') ? warehouseId : null,
                        date: new Date(date),
                        dueDate: (dueDate && dueDate.trim() !== '') ? new Date(dueDate) : null,
                        totalAmount: grandTotalPKR,
                        taxAmount: totalTaxAmount,
                        hasDiscount: hasDiscount || false,
                        discountAmount: discount,
                        discountType: discountType || null,
                        isImport: true,
                        exchangeRate: docRate,
                        docExchangeRate: docRate,
                        customsExchangeRate: customsRate,
                        beneficiaryName: beneficiaryName || null,
                        gdNumber: gdNumber || null,
                        blNumber: blNumber || null,
                        foreignTotal: Number(foreignTotal) || processedItems.reduce((acc: number, item: any) => acc + item.foreignAmount, 0),
                        items: {
                            create: processedItems.map((item: any) => {
                                // Add proportion of capitalized taxes to item cost
                                const itemRatio = subtotalPKR > 0 ? (item.total / subtotalPKR) : 0;
                                const itemCapitalizedTax = totalCapitalizedTaxes * itemRatio;
                                const itemTotalTax = totalTaxAmount * itemRatio;

                                return {
                                    id: crypto.randomUUID(),
                                    productId: item.productId,
                                    variantId: (item.variantId && typeof item.variantId === 'string' && item.variantId.trim() !== '') ? item.variantId : null,
                                    unitId: (item.unitId && typeof item.unitId === 'string' && item.unitId.trim() !== '') ? item.unitId : null,
                                    qty: item.qty,
                                    foreignRate: item.foreignRate,
                                    foreignAmount: item.foreignAmount,
                                    rate: item.rate,
                                    total: item.total + itemCapitalizedTax, // Include capitalized tax in total for stock value
                                    taxAmount: itemTotalTax,
                                    isEFS: item.isEFS,
                                    assessedRate: item.assessedRate,
                                    assessedValuePKR: item.assessedValuePKR,
                                    cdAmount: item.cdAmount,
                                    rdAmount: item.rdAmount,
                                    acdAmount: item.acdAmount,
                                    itpRate: item.itpRate
                                };
                            })
                        },
                        taxes: {
                            create: processedTaxes.map((tax: any) => ({
                                id: crypto.randomUUID(),
                                taxCodeId: (tax.taxCodeId && tax.taxCodeId !== 'MANUAL' && typeof tax.taxCodeId === 'string' && tax.taxCodeId.trim() !== '') ? tax.taxCodeId : null,
                                taxName: tax.taxName,
                                calculation: tax.calculation,
                                rate: tax.rate,
                                baseAmount: tax.baseAmount,
                                taxAmount: tax.taxAmount,
                                isCapitalized: tax.isCapitalized
                            }))
                        }
                    },
                    include: { items: true, taxes: true }
                });

                // Update Stock Ledger
                let finalWarehouseId = (warehouseId && typeof warehouseId === 'string' && warehouseId.trim() !== '') ? warehouseId : null;
                if (!finalWarehouseId) {
                    const defaultWH = await tx.warehouse.findFirst({ where: { companyId, isDefault: true } })
                        || await tx.warehouse.findFirst({ where: { companyId } });
                    if (defaultWH) finalWarehouseId = defaultWH.id;
                }

                if (finalWarehouseId) {
                    for (const item of invoice.items) {
                        const product = await tx.product.findUnique({ where: { id: item.productId } });
                        if (product && !product.isService) {
                            await tx.stockLedger.create({
                                data: {
                                    id: crypto.randomUUID(),
                                    companyId,
                                    productId: item.productId,
                                    variantId: item.variantId || null,
                                    warehouseId: finalWarehouseId,
                                    date: new Date(date),
                                    qtyIn: item.qty,
                                    qtyOut: 0,
                                    costRate: Number(item.total) / Number(item.qty || 1), // Capitalized cost rate
                                    itpRate: Number(item.itpRate || 0),
                                    batchNo: invoice.gdNumber || null,
                                    refType: 'IMPORT_INVOICE',
                                    refId: invoice.id,
                                    isEFS: item.isEFS
                                }
                            });
                        }
                    }
                }

                // Journal Entry
                if (!payableAccountId) {
                    throw new Error(`Import Supplier '${supplier.name}' is not linked to a Payable Account. Please map an account.`);
                }

                const lines = [];
                const descBeneficiary = beneficiaryName ? ` (Beneficiary: ${beneficiaryName})` : '';
                const descGD = gdNumber ? ` [GD: ${gdNumber}]` : '';
                // Credit Supplier for Goods Value (Subtotal - Discount)
                lines.push({
                    accountId: payableAccountId,
                    credit: subtotalPKR - discount,
                    debit: 0,
                    narration: `Import Invoice ${invoiceNo}${descGD}${descBeneficiary} - Goods Value payable to ${supplier.name}`
                });

                // Debit Inventory for Items
                for (const item of invoice.items) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    let purchaseAccount = product?.inventoryAccountId || product?.purchaseAccountId;
                    if (!purchaseAccount) {
                        const defInv = await tx.account.findFirst({ where: { companyId, name: { contains: 'Inventory', mode: 'insensitive' }, type: 'ASSET' } });
                        purchaseAccount = defInv?.id;
                    }
                    if (!purchaseAccount) throw new Error(`Product '${product?.name}' missing inventory account.`);

                    lines.push({
                        accountId: purchaseAccount,
                        credit: 0,
                        debit: Number(item.total), // This includes capitalized tax
                        narration: `Import of ${product?.name} (Qty: ${item.qty})`
                    });
                }

                // Handle Taxes & Landed Charges Journal Entries
                const customsAcc = await tx.account.findFirst({
                    where: { 
                        companyId, 
                        OR: [
                            { code: '2170' },
                            { name: { contains: 'Customs Duties', mode: 'insensitive' } },
                            { name: { contains: 'Customs Payable', mode: 'insensitive' } }
                        ],
                        type: 'LIABILITY',
                        isPosting: true
                    }
                });

                const insuranceAcc = await tx.account.findFirst({
                    where: {
                        companyId,
                        OR: [
                            { code: '2180' },
                            { name: { contains: 'Marine Insurance', mode: 'insensitive' } },
                            { name: { contains: 'Insurance Payable', mode: 'insensitive' } }
                        ],
                        type: 'LIABILITY',
                        isPosting: true
                    }
                });

                const portAcc = await tx.account.findFirst({
                    where: {
                        companyId,
                        OR: [
                            { code: '2190' },
                            { name: { contains: 'Port Charges', mode: 'insensitive' } },
                            { name: { contains: 'Clearing Agent', mode: 'insensitive' } }
                        ],
                        type: 'LIABILITY',
                        isPosting: true
                    }
                });

                const fallbackAp = await tx.account.findFirst({
                    where: { companyId, name: { contains: 'Accounts Payable', mode: 'insensitive' }, type: 'LIABILITY', isPosting: true }
                });

                const defaultExpenseAcc = await tx.account.findFirst({
                    where: {
                        companyId,
                        OR: [
                            { code: '5140' },
                            { code: '5100' },
                            { name: { contains: 'Freight', mode: 'insensitive' } },
                            { name: { contains: 'Direct', mode: 'insensitive' } }
                        ],
                        type: 'EXPENSE',
                        isPosting: true
                    }
                }) || await tx.account.findFirst({
                    where: { companyId, type: 'EXPENSE', isPosting: true }
                });

                const defaultCustomsPayableId = customsAcc?.id || fallbackAp?.id;

                for (const tax of processedTaxes) {
                    if (tax.taxAmount > 0) {
                        const taxNameLower = (tax.taxName || '').toLowerCase();

                        if (!tax.isCapitalized) {
                            // Non-capitalized taxes or period expenses (Sales Tax, Advance Income Tax Sec 148, or uncapitalized insurance/landing/other expenses)
                            let taxDebitAccId = tax.expenseAccountId || tax.accountId;
                            if (!taxDebitAccId && tax.taxCodeId) {
                                const tc = await tx.taxCode.findUnique({ where: { id: tax.taxCodeId } });
                                taxDebitAccId = tc?.accountId;
                            }
                            if (!taxDebitAccId) {
                                if (taxNameLower.includes('income') || taxNameLower.includes('148') || taxNameLower.includes('wht')) {
                                    const incTaxAcc = await tx.account.findFirst({ 
                                        where: { companyId, name: { contains: 'Advance Income Tax', mode: 'insensitive' }, type: 'ASSET', isPosting: true } 
                                    });
                                    taxDebitAccId = incTaxAcc?.id;
                                } else if (taxNameLower.includes('insurance') || taxNameLower.includes('landing') || taxNameLower.includes('port') || tax.calculation === 'OTHER_EXPENSE') {
                                    taxDebitAccId = defaultExpenseAcc?.id;
                                } else {
                                    const stAcc = await tx.account.findFirst({ 
                                        where: { companyId, name: { contains: 'Input Tax', mode: 'insensitive' }, type: 'ASSET', isPosting: true } 
                                    });
                                    taxDebitAccId = stAcc?.id;
                                }
                            }
                            if (!taxDebitAccId) {
                                const defTax = await tx.account.findFirst({ where: { companyId, name: { contains: 'Tax', mode: 'insensitive' }, type: 'ASSET', isPosting: true } });
                                taxDebitAccId = defTax?.id;
                            }
                            if (!taxDebitAccId) taxDebitAccId = defaultExpenseAcc?.id;
                            if (!taxDebitAccId) throw new Error(`No account linked to tax/expense '${tax.taxName}'.`);

                            lines.push({
                                accountId: taxDebitAccId,
                                credit: 0,
                                debit: tax.taxAmount,
                                narration: `GD Non-Capitalized / Expense: ${tax.taxName} on ${invoiceNo}`
                            });

                            // CREDIT: Dedicated Payable / Cash / Customs Account
                            let creditAccId = null;
                            if (taxNameLower.includes('insurance')) {
                                creditAccId = tax.accountId || insuranceAcc?.id || defaultCustomsPayableId;
                            } else if (taxNameLower.includes('landing') || taxNameLower.includes('port') || taxNameLower.includes('clearing') || tax.calculation === 'OTHER_EXPENSE') {
                                creditAccId = tax.accountId || portAcc?.id || defaultCustomsPayableId;
                            } else {
                                creditAccId = defaultCustomsPayableId;
                            }

                            lines.push({
                                accountId: creditAccId!,
                                credit: tax.taxAmount,
                                debit: 0,
                                narration: `Payable for ${tax.taxName} on ${invoiceNo}`
                            });
                        } else {
                            // Capitalized Charges (CD, RD, ACD, Marine Insurance, Landing Charges, Other Landed Expenses)
                            // (DEBIT is already booked into Inventory Asset Account above pro-rata across items)
                            // CREDIT: Dedicated Liability / Payable / Bank Account
                            let creditAccId = null;

                            if (taxNameLower.includes('insurance')) {
                                creditAccId = tax.accountId || insuranceAcc?.id || defaultCustomsPayableId;
                            } else if (taxNameLower.includes('landing') || taxNameLower.includes('port') || taxNameLower.includes('clearing') || tax.calculation === 'OTHER_EXPENSE') {
                                creditAccId = tax.accountId || portAcc?.id || defaultCustomsPayableId;
                            } else {
                                // CD, RD, ACD, etc.
                                creditAccId = tax.accountId || defaultCustomsPayableId;
                            }

                            lines.push({
                                accountId: creditAccId!,
                                credit: tax.taxAmount,
                                debit: 0,
                                narration: `Payable for ${tax.taxName} on ${invoiceNo}`
                            });
                        }
                    }
                }

                const je = await tx.journalEntry.create({
                    data: {
                        id: crypto.randomUUID(),
                        companyId,
                        number: `JV-${invoiceNo}`,
                        date: new Date(date),
                        type: 'PURCHASE',
                        reference: invoiceNo,
                        narration: `Import Purchase Invoice ${invoiceNo}`,
                        lines: { create: lines.map((line: any) => ({ ...line, id: crypto.randomUUID() })) }
                    }
                });

                await tx.purchaseInvoice.update({
                    where: { id: invoice.id },
                    data: { journalEntryId: je.id }
                });

                return invoice;
            }, {
                maxWait: 10000, // default: 2000
                timeout: 30000  // default: 5000
            });

            return NextResponse.json({ success: true, data: result });
        } catch (error: any) {
            console.error("Create Import Invoice Error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    /**
     * Update Import Purchase Invoice (with EFS, GD Taxes, Stock Ledger & Journal Reversal)
     */
    static async updateImportInvoice(req: Request, options?: { params?: Promise<{ id: string }> }, existingBody?: any) {
        try {
            const crypto = require('crypto');
            const { companyId, error } = AuthUtils.getCompanyId(req);
            if (error) return error;

            let invoiceId: string | null = null;
            if (options?.params) {
                const p = await options.params;
                invoiceId = p?.id || null;
            }
            if (!invoiceId) {
                try {
                    const url = new URL(req.url);
                    invoiceId = url.searchParams.get('id');
                } catch (e) {}
            }

            const body = existingBody || await req.json();
            if (!invoiceId) invoiceId = body.id;

            if (!invoiceId) {
                return NextResponse.json({ success: false, error: "Invoice ID is required for update" }, { status: 400 });
            }

            const existing = await prisma.purchaseInvoice.findUnique({
                where: { id: invoiceId },
                include: { items: true, taxes: true, JournalEntry: true }
            });

            if (!existing || existing.companyId !== companyId) {
                return NextResponse.json({ success: false, error: "Import Invoice not found" }, { status: 404 });
            }

            const { 
                supplierId, 
                warehouseId, 
                date, 
                dueDate, 
                items, 
                gdTaxes, 
                exchangeRate, 
                docExchangeRate,
                customsExchangeRate,
                beneficiaryName,
                gdNumber,
                blNumber,
                hasDiscount, 
                discountAmount, 
                discountType,
                foreignTotal
            } = body;

            const result = await prisma.$transaction(async (tx) => {
                // 1. Delete previous stock ledger entries for this invoice
                await tx.stockLedger.deleteMany({
                    where: {
                        refType: { in: ['IMPORT_INVOICE', 'INVOICE', 'PURCHASE'] },
                        refId: invoiceId
                    }
                });

                // 2. Delete previous items and taxes
                await tx.purchaseInvoiceItem.deleteMany({ where: { invoiceId: invoiceId } });
                await tx.purchaseInvoiceTax.deleteMany({ where: { invoiceId: invoiceId } });

                // 3. Clear previous journal lines if journalEntry exists
                if (existing.journalEntryId) {
                    await tx.journalLine.deleteMany({ where: { entryId: existing.journalEntryId } });
                }

                // 4. Resolve supplier & payable account
                let supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
                let payableAccountId = supplier?.payableAccountId;

                let baseCurr = await tx.currency.findFirst({ where: { companyId, isBase: true } });
                if (!baseCurr) baseCurr = await tx.currency.findFirst({ where: { companyId } });
                if (!baseCurr) baseCurr = await tx.currency.findFirst();
                const currId = baseCurr?.id || 'PKR';

                if (!supplier) {
                    const directAccount = await tx.account.findUnique({ where: { id: supplierId } });
                    if (directAccount) {
                        payableAccountId = directAccount.id;
                        supplier = await tx.supplier.findFirst({
                            where: { companyId, payableAccountId: directAccount.id }
                        });
                        if (!supplier) {
                            supplier = await tx.supplier.create({
                                data: {
                                    id: crypto.randomUUID(),
                                    companyId,
                                    currencyCode: currId,
                                    name: beneficiaryName || directAccount.name,
                                    code: `IMP-${directAccount.code}`,
                                    payableAccountId: directAccount.id
                                }
                            });
                        }
                    }
                }

                if (!supplier) {
                    supplier = await tx.supplier.findUnique({ where: { id: existing.supplierId } });
                    payableAccountId = supplier?.payableAccountId;
                }

                if (!payableAccountId && supplier) {
                    payableAccountId = supplier.payableAccountId;
                }
                if (!payableAccountId) {
                    const fallbackAcc = await tx.account.findFirst({
                        where: { companyId, OR: [{ code: '2111' }, { code: '2110' }, { name: { contains: 'Accounts Payable', mode: 'insensitive' } }], isPosting: true }
                    });
                    payableAccountId = fallbackAcc?.id;
                }

                const docRate = Number(docExchangeRate || exchangeRate || 1.0);
                const customsRate = Number(customsExchangeRate || exchangeRate || 1.0);
                let subtotalPKR = 0;

                // Process Items
                const processedItems = (items || []).map((item: any) => {
                    const fRate = Number(item.foreignRate) || 0;
                    const qty = Number(item.qty) || 0;
                    const fTotal = fRate * qty;
                    const pkrRate = fRate * docRate;
                    const pkrTotal = fTotal * docRate;

                    subtotalPKR += pkrTotal;

                    const assessedRate = Number(item.assessedRate) || 0;
                    const assessedValuePKR = Number(item.assessedValuePKR) > 0 
                        ? Math.round(Number(item.assessedValuePKR))
                        : Math.round((assessedRate * qty) * customsRate);
                    const cdAmount = Number(item.cdAmount) || 0;
                    const rdAmount = Number(item.rdAmount) || 0;
                    const acdAmount = Number(item.acdAmount) || 0;
                    const itpRate = qty > 0 ? ((assessedValuePKR + rdAmount + cdAmount + acdAmount) / qty) : 0;

                    return {
                        productId: item.productId,
                        variantId: item.variantId || null,
                        unitId: item.unitId || null,
                        qty: qty,
                        foreignRate: fRate,
                        foreignAmount: fTotal,
                        rate: pkrRate,
                        total: pkrTotal,
                        isEFS: Boolean(item.isEFS),
                        assessedRate,
                        assessedValuePKR,
                        cdAmount,
                        rdAmount,
                        acdAmount,
                        itpRate
                    };
                });

                const discount = hasDiscount ? Number(discountAmount || 0) * docRate : 0;
                const totalAssessedPKR = Math.round(processedItems.reduce((sum: number, it: any) => sum + (Number(it.assessedValuePKR) || 0), 0));

                const insTax = (gdTaxes || []).find((t: any) => (t.taxName || '').toLowerCase().includes('insurance'));
                const landTax = (gdTaxes || []).find((t: any) => (t.taxName || '').toLowerCase().includes('landing'));
                const insAmountPKR = Math.round(Number(insTax?.taxAmount || 0));
                const landAmountPKR = Math.round(Number(landTax?.taxAmount || 0));

                const customsBasePKR = totalAssessedPKR > 0
                    ? totalAssessedPKR
                    : (subtotalPKR - discount + insAmountPKR + landAmountPKR);

                let runningTotalPKR = subtotalPKR - discount;
                let runningDutiesPKR = 0;
                let runningSalesTaxesPKR = 0;
                let totalTaxAmount = 0;
                let totalCapitalizedTaxes = 0;

                const processedTaxes = (gdTaxes || []).map((tax: any) => {
                    let baseAmount = customsBasePKR;

                    if (tax.calculation === 'ASSESSED_VALUE') {
                        baseAmount = customsBasePKR;
                    } else if (tax.calculation === 'ASSESSED_PLUS_DUTIES') {
                        baseAmount = customsBasePKR + runningDutiesPKR;
                    } else if (tax.calculation === 'ASSESSED_PLUS_ALL') {
                        baseAmount = customsBasePKR + runningDutiesPKR + runningSalesTaxesPKR;
                    } else if (tax.calculation === 'PREVIOUS_TOTAL') {
                        baseAmount = runningTotalPKR;
                    } else if (tax.calculation === 'NET_TOTAL') {
                        baseAmount = subtotalPKR - discount;
                    } else if (tax.calculation === 'OTHER_EXPENSE') {
                        baseAmount = Number(tax.taxAmount || tax.baseAmount || 0);
                    }

                    baseAmount = Math.round(baseAmount);
                    const rate = Number(tax.rate) || 0;
                    const taxAmt = rate > 0 ? Math.round(baseAmount * (rate / 100)) : Math.round(Number(tax.taxAmount) || 0);

                    totalTaxAmount += taxAmt;
                    runningTotalPKR += taxAmt;

                    const tName = (tax.taxName || '').toLowerCase();
                    if (tax.calculation !== 'OTHER_EXPENSE') {
                        if (tax.isCapitalized || tName.includes('duty') || tName.includes('cd') || tName.includes('rd') || tName.includes('acd')) {
                            runningDutiesPKR += taxAmt;
                        } else if (tName.includes('sales') || tName.includes('st') || tName.includes('ast')) {
                            runningSalesTaxesPKR += taxAmt;
                        }
                    }

                    if (tax.isCapitalized) {
                        totalCapitalizedTaxes += taxAmt;
                    }

                    return {
                        taxCodeId: tax.taxCodeId === 'MANUAL' ? null : (tax.taxCodeId || null),
                        taxName: tax.taxName || 'GD Tax/Duty',
                        calculation: tax.calculation || 'ASSESSED_VALUE',
                        rate: rate,
                        baseAmount,
                        taxAmount: taxAmt,
                        isCapitalized: Boolean(tax.isCapitalized),
                        accountId: tax.accountId,
                        expenseAccountId: tax.expenseAccountId || null
                    };
                });

                const grandTotalPKR = subtotalPKR - discount + totalTaxAmount;

                // Update PurchaseInvoice record
                const updatedInvoice = await tx.purchaseInvoice.update({
                    where: { id: invoiceId },
                    data: {
                        supplierId: supplier ? supplier.id : existing.supplierId,
                        warehouseId: (warehouseId && warehouseId.trim() !== '') ? warehouseId : null,
                        date: new Date(date),
                        dueDate: (dueDate && dueDate.trim() !== '') ? new Date(dueDate) : null,
                        totalAmount: grandTotalPKR,
                        taxAmount: totalTaxAmount,
                        hasDiscount: hasDiscount || false,
                        discountAmount: discount,
                        discountType: discountType || null,
                        exchangeRate: docRate,
                        docExchangeRate: docRate,
                        customsExchangeRate: customsRate,
                        beneficiaryName: beneficiaryName || null,
                        gdNumber: gdNumber || null,
                        blNumber: blNumber || null,
                        foreignTotal: Number(foreignTotal) || processedItems.reduce((acc: number, item: any) => acc + item.foreignAmount, 0),
                        items: {
                            create: processedItems.map((item: any) => {
                                const itemRatio = subtotalPKR > 0 ? (item.total / subtotalPKR) : 0;
                                const itemCapitalizedTax = totalCapitalizedTaxes * itemRatio;
                                const itemTotalTax = totalTaxAmount * itemRatio;

                                return {
                                    id: crypto.randomUUID(),
                                    productId: item.productId,
                                    variantId: (item.variantId && typeof item.variantId === 'string' && item.variantId.trim() !== '') ? item.variantId : null,
                                    unitId: (item.unitId && typeof item.unitId === 'string' && item.unitId.trim() !== '') ? item.unitId : null,
                                    qty: item.qty,
                                    foreignRate: item.foreignRate,
                                    foreignAmount: item.foreignAmount,
                                    rate: item.rate,
                                    total: item.total + itemCapitalizedTax,
                                    taxAmount: itemTotalTax,
                                    isEFS: item.isEFS,
                                    assessedRate: item.assessedRate,
                                    assessedValuePKR: item.assessedValuePKR,
                                    cdAmount: item.cdAmount,
                                    rdAmount: item.rdAmount,
                                    acdAmount: item.acdAmount,
                                    itpRate: item.itpRate
                                };
                            })
                        },
                        taxes: {
                            create: processedTaxes.map((tax: any) => ({
                                id: crypto.randomUUID(),
                                taxCodeId: (tax.taxCodeId && tax.taxCodeId !== 'MANUAL' && typeof tax.taxCodeId === 'string' && tax.taxCodeId.trim() !== '') ? tax.taxCodeId : null,
                                taxName: tax.taxName,
                                calculation: tax.calculation,
                                rate: tax.rate,
                                baseAmount: tax.baseAmount,
                                taxAmount: tax.taxAmount,
                                isCapitalized: tax.isCapitalized
                            }))
                        }
                    },
                    include: { items: true, taxes: true }
                });

                // Re-create Stock Ledger
                let finalWarehouseId = (warehouseId && typeof warehouseId === 'string' && warehouseId.trim() !== '') ? warehouseId : null;
                if (!finalWarehouseId) {
                    const defaultWH = await tx.warehouse.findFirst({ where: { companyId, isDefault: true } })
                        || await tx.warehouse.findFirst({ where: { companyId } });
                    if (defaultWH) finalWarehouseId = defaultWH.id;
                }

                if (finalWarehouseId) {
                    for (const item of updatedInvoice.items) {
                        const product = await tx.product.findUnique({ where: { id: item.productId } });
                        if (product && !product.isService) {
                            await tx.stockLedger.create({
                                data: {
                                    id: crypto.randomUUID(),
                                    companyId,
                                    productId: item.productId,
                                    variantId: item.variantId || null,
                                    warehouseId: finalWarehouseId,
                                    date: new Date(date),
                                    qtyIn: item.qty,
                                    qtyOut: 0,
                                    costRate: Number(item.total) / Number(item.qty || 1),
                                    itpRate: Number(item.itpRate || 0),
                                    batchNo: updatedInvoice.gdNumber || null,
                                    refType: 'IMPORT_INVOICE',
                                    refId: updatedInvoice.id,
                                    isEFS: item.isEFS
                                }
                            });
                        }
                    }
                }

                // Re-create Journal Entry
                if (!payableAccountId) {
                    throw new Error(`Import Supplier '${supplier?.name}' is not linked to a Payable Account. Please map an account.`);
                }

                const lines = [];
                const descBeneficiary = beneficiaryName ? ` (Beneficiary: ${beneficiaryName})` : '';
                const descGD = gdNumber ? ` [GD: ${gdNumber}]` : '';

                lines.push({
                    accountId: payableAccountId,
                    credit: subtotalPKR - discount,
                    debit: 0,
                    narration: `Import Invoice ${updatedInvoice.invoiceNo}${descGD}${descBeneficiary} - Goods Value payable to ${supplier?.name}`
                });

                for (const item of updatedInvoice.items) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    let purchaseAccount = product?.inventoryAccountId || product?.purchaseAccountId;
                    if (!purchaseAccount) {
                        const defInv = await tx.account.findFirst({ where: { companyId, name: { contains: 'Inventory', mode: 'insensitive' }, type: 'ASSET' } });
                        purchaseAccount = defInv?.id;
                    }
                    if (!purchaseAccount) throw new Error(`Product '${product?.name}' missing inventory account.`);

                    lines.push({
                        accountId: purchaseAccount,
                        credit: 0,
                        debit: Number(item.total),
                        narration: `Import of ${product?.name} (Qty: ${item.qty})`
                    });
                }

                const customsAcc = await tx.account.findFirst({
                    where: { 
                        companyId, 
                        OR: [
                            { code: '2170' },
                            { name: { contains: 'Customs Duties', mode: 'insensitive' } },
                            { name: { contains: 'Customs Payable', mode: 'insensitive' } }
                        ],
                        type: 'LIABILITY',
                        isPosting: true
                    }
                });

                const insuranceAcc = await tx.account.findFirst({
                    where: {
                        companyId,
                        OR: [
                            { code: '2180' },
                            { name: { contains: 'Marine Insurance', mode: 'insensitive' } },
                            { name: { contains: 'Insurance Payable', mode: 'insensitive' } }
                        ],
                        type: 'LIABILITY',
                        isPosting: true
                    }
                });

                const portAcc = await tx.account.findFirst({
                    where: {
                        companyId,
                        OR: [
                            { code: '2190' },
                            { name: { contains: 'Port Charges', mode: 'insensitive' } },
                            { name: { contains: 'Clearing Agent', mode: 'insensitive' } }
                        ],
                        type: 'LIABILITY',
                        isPosting: true
                    }
                });

                const fallbackAp = await tx.account.findFirst({
                    where: { companyId, name: { contains: 'Accounts Payable', mode: 'insensitive' }, type: 'LIABILITY', isPosting: true }
                });

                const defaultExpenseAcc = await tx.account.findFirst({
                    where: {
                        companyId,
                        OR: [
                            { code: '5140' },
                            { code: '5100' },
                            { name: { contains: 'Freight', mode: 'insensitive' } },
                            { name: { contains: 'Direct', mode: 'insensitive' } }
                        ],
                        type: 'EXPENSE',
                        isPosting: true
                    }
                }) || await tx.account.findFirst({
                    where: { companyId, type: 'EXPENSE', isPosting: true }
                });

                const defaultCustomsPayableId = customsAcc?.id || fallbackAp?.id;

                for (const tax of processedTaxes) {
                    if (tax.taxAmount > 0) {
                        const taxNameLower = (tax.taxName || '').toLowerCase();

                        if (!tax.isCapitalized) {
                            let taxDebitAccId = tax.expenseAccountId || tax.accountId;
                            if (!taxDebitAccId && tax.taxCodeId) {
                                const tc = await tx.taxCode.findUnique({ where: { id: tax.taxCodeId } });
                                taxDebitAccId = tc?.accountId;
                            }
                            if (!taxDebitAccId) {
                                if (taxNameLower.includes('income') || taxNameLower.includes('148') || taxNameLower.includes('wht')) {
                                    const incTaxAcc = await tx.account.findFirst({ 
                                        where: { companyId, name: { contains: 'Advance Income Tax', mode: 'insensitive' }, type: 'ASSET', isPosting: true } 
                                    });
                                    taxDebitAccId = incTaxAcc?.id;
                                } else if (taxNameLower.includes('insurance') || taxNameLower.includes('landing') || taxNameLower.includes('port') || tax.calculation === 'OTHER_EXPENSE') {
                                    taxDebitAccId = defaultExpenseAcc?.id;
                                } else {
                                    const stAcc = await tx.account.findFirst({ 
                                        where: { companyId, name: { contains: 'Input Tax', mode: 'insensitive' }, type: 'ASSET', isPosting: true } 
                                    });
                                    taxDebitAccId = stAcc?.id;
                                }
                            }
                            if (!taxDebitAccId) {
                                const defTax = await tx.account.findFirst({ where: { companyId, name: { contains: 'Tax', mode: 'insensitive' }, type: 'ASSET', isPosting: true } });
                                taxDebitAccId = defTax?.id;
                            }
                            if (!taxDebitAccId) taxDebitAccId = defaultExpenseAcc?.id;
                            if (!taxDebitAccId) throw new Error(`No account linked to tax/expense '${tax.taxName}'.`);

                            lines.push({
                                accountId: taxDebitAccId,
                                credit: 0,
                                debit: tax.taxAmount,
                                narration: `GD Non-Capitalized / Expense: ${tax.taxName} on ${updatedInvoice.invoiceNo}`
                            });

                            let creditAccId = null;
                            if (taxNameLower.includes('insurance')) {
                                creditAccId = tax.accountId || insuranceAcc?.id || defaultCustomsPayableId;
                            } else if (taxNameLower.includes('landing') || taxNameLower.includes('port') || taxNameLower.includes('clearing') || tax.calculation === 'OTHER_EXPENSE') {
                                creditAccId = tax.accountId || portAcc?.id || defaultCustomsPayableId;
                            } else {
                                creditAccId = defaultCustomsPayableId;
                            }

                            lines.push({
                                accountId: creditAccId!,
                                credit: tax.taxAmount,
                                debit: 0,
                                narration: `Payable for ${tax.taxName} on ${updatedInvoice.invoiceNo}`
                            });
                        } else {
                            let creditAccId = null;
                            if (taxNameLower.includes('insurance')) {
                                creditAccId = tax.accountId || insuranceAcc?.id || defaultCustomsPayableId;
                            } else if (taxNameLower.includes('landing') || taxNameLower.includes('port') || taxNameLower.includes('clearing') || tax.calculation === 'OTHER_EXPENSE') {
                                creditAccId = tax.accountId || portAcc?.id || defaultCustomsPayableId;
                            } else {
                                creditAccId = tax.accountId || defaultCustomsPayableId;
                            }

                            lines.push({
                                accountId: creditAccId!,
                                credit: tax.taxAmount,
                                debit: 0,
                                narration: `Payable for ${tax.taxName} on ${updatedInvoice.invoiceNo}`
                            });
                        }
                    }
                }

                let jeId = existing.journalEntryId;
                if (jeId) {
                    await tx.journalEntry.update({
                        where: { id: jeId },
                        data: {
                            date: new Date(date),
                            reference: updatedInvoice.invoiceNo,
                            narration: `Import Purchase Invoice ${updatedInvoice.invoiceNo}`,
                            lines: { create: lines.map((line: any) => ({ ...line, id: crypto.randomUUID() })) }
                        }
                    });
                } else {
                    const je = await tx.journalEntry.create({
                        data: {
                            id: crypto.randomUUID(),
                            companyId,
                            number: `JV-${updatedInvoice.invoiceNo}`,
                            date: new Date(date),
                            type: 'PURCHASE',
                            reference: updatedInvoice.invoiceNo,
                            narration: `Import Purchase Invoice ${updatedInvoice.invoiceNo}`,
                            lines: { create: lines.map((line: any) => ({ ...line, id: crypto.randomUUID() })) }
                        }
                    });
                    jeId = je.id;
                    await tx.purchaseInvoice.update({
                        where: { id: updatedInvoice.id },
                        data: { journalEntryId: jeId }
                    });
                }

                return updatedInvoice;
            }, {
                maxWait: 10000,
                timeout: 30000
            });

            return NextResponse.json({ success: true, data: result });
        } catch (error: any) {
            console.error("Update Import Invoice Error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
    }
}

