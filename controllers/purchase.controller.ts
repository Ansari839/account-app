import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { AuthUtils } from '@/lib/auth-utils';

async function getAuthUser(req: Request) {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) return null;
    return AuthUtils.verifyToken(token);
}

export class PurchaseController {
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
                    items: true
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
                    items: true
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
                    items: true
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

            // Generate PO Number
            const count = await prisma.purchaseOrder.count() + 1;
            const poNo = `PO-${new Date().getFullYear()}-${count.toString().padStart(4, '0')}`;

            const order = await prisma.purchaseOrder.create({
                data: {
                    poNo,
                    supplierId: body.supplierId,
                    warehouseId: body.warehouseId,
                    date: new Date(body.date),
                    expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
                    totalAmount: body.items.reduce((acc: number, item: any) => acc + (item.qty * item.rate), 0),
                    status: 'OPEN',
                    items: {
                        create: body.items.map((item: any) => ({
                            productId: item.productId,
                            qty: item.qty,
                            rate: item.rate,
                            total: item.qty * item.rate,
                            receivedQty: 0,
                            invoicedQty: 0
                        }))
                    }
                }
            });

            return NextResponse.json({ success: true, data: order });
        } catch (error: any) {
            console.error("Create PO Error:", error);
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
            const count = await prisma.gRN.count() + 1;
            const grnNo = `GRN-${new Date().getFullYear()}-${count.toString().padStart(4, '0')}`;

            // Transaction to ensure atomic updates
            const result = await prisma.$transaction(async (tx) => {
                // 1. Create GRN
                // Filter items that have received or rejected quantity
                const validItems = items.filter((item: any) => (item.qtyReceived > 0 || item.qtyRejected > 0));

                if (validItems.length === 0) {
                    throw new Error("No items to receive");
                }

                const grn = await tx.gRN.create({
                    data: {
                        grnNo,
                        poId,
                        supplierId,
                        warehouseId,
                        date: new Date(date),
                        items: {
                            create: validItems.map((item: any) => ({
                                productId: item.productId,
                                poItemId: item.poItemId,
                                qtyReceived: item.qtyReceived,
                                qtyRejected: item.qtyRejected
                            }))
                        }
                    }
                });

                // 2. Update PO Items (receivedQty) & Create Stock Ledger
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

                        // 3. Create Stock Ledger Entry (Increase Stock)
                        await tx.stockLedger.create({
                            data: {
                                productId: item.productId,
                                warehouseId,
                                date: new Date(date),
                                qtyIn: item.qtyReceived,
                                qtyOut: 0,
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
     * Create Purchase Invoice
     */
    static async createPurchaseInvoice(req: Request) {
        try {
            const user = await getAuthUser(req);
            if (!user?.companyId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

            const body = await req.json();
            const { poId, grnId, supplierId, date, dueDate, items } = body;

            // Generate Invoice Number
            const count = await prisma.purchaseInvoice.count() + 1;
            const invoiceNo = `PI-${new Date().getFullYear()}-${count.toString().padStart(4, '0')}`;

            const result = await prisma.$transaction(async (tx) => {
                const totalAmount = items.reduce((sum: number, item: any) => sum + (item.qty * item.rate), 0);

                // 1. Create Invoice
                const invoice = await tx.purchaseInvoice.create({
                    data: {
                        invoiceNo,
                        supplierId,
                        poId: poId || undefined,
                        grnId: grnId || undefined,
                        date: new Date(date),
                        dueDate: dueDate ? new Date(dueDate) : null,
                        totalAmount,
                        items: {
                            create: items.map((item: any) => ({
                                productId: item.productId,
                                poItemId: item.poItemId,
                                grnItemId: item.grnItemId,
                                qty: item.qty,
                                rate: item.rate,
                                total: item.qty * item.rate
                            }))
                        }
                    }
                });

                // 2. Update PO Items (invoicedQty) - if linked to PO
                for (const item of items) {
                    if (item.poItemId) {
                        await tx.purchaseOrderItem.update({
                            where: { id: item.poItemId },
                            data: {
                                invoicedQty: { increment: item.qty }
                            }
                        });
                    }
                }

                // 3. Create Journal Entry (AP)
                // Credit Supplier (Payable)
                // Fetch Supplier to get Payable Account
                const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });

                if (!supplier?.payableAccountId) {
                    // Fallback or warning? For now proceed but this is a config issue
                    console.warn("Supplier missing payable account", supplierId);
                }

                await tx.journalEntry.create({
                    data: {
                        number: `JV-${invoiceNo}`,
                        date: new Date(date),
                        type: 'PURCHASE',
                        reference: invoiceNo,
                        narration: `Purchase Invoice ${invoiceNo}`,
                        lines: {
                            create: [
                                {
                                    // Credit Supplier
                                    accountId: supplier?.payableAccountId || '', // WARNING: Needs verification
                                    credit: totalAmount,
                                    debit: 0
                                },
                                {
                                    // Debit Purchase (Placeholder - typically would be Inventory or Expense)
                                    // ideally sum up by product category accounts
                                    // For now, let's assume we have a "Purchase Account" on the first product or use a global default
                                    // FIXME: Use proper Purchase/Inventory Account from Product
                                    accountId: supplier?.payableAccountId || '', // FIXME: BAD Placeholder
                                    credit: 0,
                                    debit: totalAmount
                                }
                            ]
                        },
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
}
