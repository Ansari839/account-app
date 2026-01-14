import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { AuthUtils } from '@/lib/auth-utils';
import { AccountType } from '@prisma/client';

async function getAuthUser(req: Request) {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) return null;
    return AuthUtils.verifyToken(token);
}

export class PurchaseController {
    /**
     * Helper to find a default account by name and type
     */
    private static async findDefaultAccount(name: string, type: AccountType) {
        return prisma.account.findFirst({
            where: {
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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const invoices = await prisma.purchaseInvoice.findMany({
                where: {
                    supplier: {
                        payableAccount: {
                            companyId: user.companyId
                        }
                    }
                },
                include: {
                    supplier: true,
                    items: { include: { product: true, unit: true } }
                },
                orderBy: { date: 'desc' }
            });

            return NextResponse.json({ success: true, data: invoices });
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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const orders = await prisma.purchaseOrder.findMany({
                where: {
                    supplier: {
                        payableAccount: {
                            companyId: user.companyId
                        }
                    }
                },
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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const grns = await prisma.gRN.findMany({
                where: {
                    supplier: {
                        payableAccount: {
                            companyId: user.companyId
                        }
                    }
                },
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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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
                    supplier = await prisma.supplier.create({
                        data: {
                            code: `SUP-${nextSupSeq.toString().padStart(4, '0')}`,
                            name: account.name,
                            currencyCode: 'PKR', // Default currency
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
                    poNo,
                    supplier: { connect: { id: supplierId } },
                    warehouse: body.warehouseId ? { connect: { id: body.warehouseId } } : undefined,
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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const invoice = await prisma.purchaseInvoice.findUnique({
                where: { id },
                include: {
                    supplier: true,
                    po: true,
                    grn: true,
                    journalEntry: { include: { lines: { include: { account: true } } } },
                    items: {
                        include: { product: true, poItem: true, unit: true }
                    }
                }
            });

            if (!invoice) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
            return NextResponse.json({ success: true, data: invoice });
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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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

                // 3. Delete Items and Invoice
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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const body = await req.json();
            const { poId, grnId, warehouseId, date, dueDate, items } = body;
            let supplierId = body.supplierId;

            // Resolve Account ID to Supplier ID (Same logic as createOrder)
            const account = await prisma.account.findUnique({ where: { id: supplierId } });
            if (account) {
                let supplier = await prisma.supplier.findFirst({
                    where: { payableAccountId: account.id }
                });

                if (!supplier) {
                    const lastSupplier = await prisma.supplier.findFirst({
                        where: { code: { startsWith: 'SUP-' } },
                        orderBy: { code: 'desc' }
                    });
                    let nextSupSeq = 1;
                    if (lastSupplier) {
                        const lastNum = parseInt(lastSupplier.code.split('-')[1]);
                        if (!isNaN(lastNum)) nextSupSeq = lastNum + 1;
                    }
                    supplier = await prisma.supplier.create({
                        data: {
                            code: `SUP-${nextSupSeq.toString().padStart(4, '0')}`,
                            name: account.name,
                            currencyCode: 'PKR',
                            payableAccountId: account.id
                        }
                    });
                }
                supplierId = supplier.id;
            }

            // 1. Fetch Setting: GRN Mandatory
            const setting = await prisma.globalSetting.findFirst({
                where: { key: 'INVENTORY_GRN_MANDATORY' }
            });
            const grnMandatory = setting?.value === 'true';

            if (grnMandatory && !grnId) {
                return NextResponse.json({ success: false, error: "GRN is mandatory for creating Purchase Invoices." }, { status: 400 });
            }

            // Enforce Warehouse for Direct Invoices (No GRN)
            if (!grnId && !warehouseId) {
                return NextResponse.json({ success: false, error: "Warehouse is required for Direct Purchase Invoices to update inventory." }, { status: 400 });
            }

            // Generate Invoice Number
            const lastInvoice = await prisma.purchaseInvoice.findFirst({
                where: { invoiceNo: { startsWith: `PI-${new Date().getFullYear()}-` } },
                orderBy: { invoiceNo: 'desc' }
            });
            let nextInvoiceSeq = 1;
            if (lastInvoice) {
                const parts = lastInvoice.invoiceNo.split('-');
                const lastSeq = parseInt(parts[parts.length - 1]);
                if (!isNaN(lastSeq)) nextInvoiceSeq = lastSeq + 1;
            }
            const invoiceNo = `PI-${new Date().getFullYear()}-${nextInvoiceSeq.toString().padStart(4, '0')}`;

            const result = await prisma.$transaction(async (tx) => {
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

                // 3. Create Invoice
                const invoice = await tx.purchaseInvoice.create({
                    data: {
                        invoiceNo,
                        supplierId,
                        poId: poId || null,
                        grnId: grnId || null,
                        warehouseId: warehouseId || null,
                        date: new Date(date),
                        dueDate: dueDate ? new Date(dueDate) : null,
                        totalAmount,
                        items: {
                            create: items.map((item: any) => ({
                                productId: item.productId,
                                variantId: item.variantId || null,
                                unitId: item.unitId || null,
                                poItemId: item.poItemId || null,
                                grnItemId: item.grnItemId || null,
                                qty: item.qty,
                                rate: item.rate,
                                total: Number(item.qty) * Number(item.rate)
                            }))
                        }
                    }
                });

                // 3.1 Handle Stock for Direct Invoices (No GRN)
                if (!grnId && warehouseId) {
                    for (const item of items) {
                        await tx.stockLedger.create({
                            data: {
                                productId: item.productId,
                                variantId: item.variantId || null,
                                warehouseId,
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

                const journalNo = `JV-${invoiceNo}`;

                // Group items by their purchase account
                const lines = [];
                // Credit Supplier (Payable)
                lines.push({
                    accountId: supplier.payableAccountId,
                    credit: totalAmount,
                    debit: 0,
                    narration: `Purchase Invoice ${invoiceNo} - Total payable to ${supplier.name}`
                });

                // Debit Purchase/Inventory Accounts
                for (const item of items) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    let purchaseAccount = product?.inventoryAccountId || product?.purchaseAccountId;

                    if (!purchaseAccount) {
                        // Fallback to default Inventory or Purchase account
                        const defInv = await this.findDefaultAccount('Inventory', 'ASSET');
                        const defPur = await this.findDefaultAccount('Purchase', 'EXPENSE');
                        purchaseAccount = defInv?.id || defPur?.id;

                        if (!purchaseAccount) {
                            throw new Error(`Product '${product?.name || item.productId}' is not linked to a Purchase or Inventory Account and no default accounts were found.`);
                        }
                    }

                    lines.push({
                        accountId: purchaseAccount,
                        credit: 0,
                        debit: Number(item.qty) * Number(item.rate),
                        narration: `Purchase of ${product?.name} (${item.qty} @ ${item.rate})`
                    });
                }

                await tx.journalEntry.create({
                    data: {
                        number: journalNo,
                        date: new Date(date),
                        type: 'PURCHASE',
                        reference: invoiceNo,
                        narration: `Purchase Invoice ${invoiceNo} for ${supplier.name} ${poId ? 'against PO' : ''}`,
                        lines: { create: lines },
                        purchaseInvoice: { connect: { id: invoice.id } }
                    }
                });

                return invoice;
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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const body = await req.json();
            const { date, dueDate, warehouseId, items } = body;

            const existing = await prisma.purchaseInvoice.findUnique({
                where: { id },
                include: { items: true, journalEntry: true }
            });

            if (!existing) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });

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
                            const defInv = await this.findDefaultAccount('Inventory', 'ASSET');
                            const defPur = await this.findDefaultAccount('Purchase', 'EXPENSE');
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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const body = await req.json();
            const { date, remarks, warehouseId, items } = body;

            // 1. Fetch Existing
            const existing = await prisma.purchaseReturn.findUnique({
                where: { id },
                include: { items: true }
            });

            if (!existing) return NextResponse.json({ success: false, error: "Return not found" }, { status: 404 });

            // 2. Validate Invoice
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
                        const defInv = await prisma.account.findFirst({ where: { name: 'Inventory', type: 'ASSET' } });
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
                            totalAmount: returnTotalAmount, // If JV has total
                            lines: { create: jvLines }
                        }
                    });
                } else {
                    // Create if missing (edge case)
                    const je = await tx.journalEntry.create({
                        data: {
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
}
